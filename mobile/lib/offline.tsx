import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { api, apiUpload, ApiError, isOfflineError } from "./api";
import { persistGet, persistSet } from "./persist";
import { dropPhoto } from "./photos";
import { pruneLocalVisits } from "./local-visits";
import { useAuth } from "./auth";

export type OfflineJob = {
  id: string;
  kind: "lead" | "follow-up" | "check-in" | "visit-complete" | "visit-photo" | "sale" | "sale-bill" | "gps";
  label: string;
  path: string;
  method?: "POST";
  body?: unknown;
  fileUri?: string;
  createdAt: string;
  tries: number;
  /** Do not send until this earlier job has succeeded. */
  afterId?: string;
  /** Job whose server id replaces {visitId} or {saleId}. */
  bindFrom?: string;
  bind?: "visit" | "sale";
};

type OfflineState = {
  pending: number;
  jobs: OfflineJob[];
  online: boolean;
  lastSync: string | null;
  enqueue: (job: Omit<OfflineJob, "id" | "createdAt" | "tries">) => Promise<OfflineJob>;
  flush: () => Promise<void>;
  cacheGet: <T>(key: string) => Promise<T | null>;
  cacheSet: (key: string, value: unknown) => Promise<void>;
};

const OfflineContext = createContext<OfflineState | null>(null);

function jobId() {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readJobs() {
  const raw = await persistGet("queue");
  return raw ? (JSON.parse(raw) as OfflineJob[]) : [];
}

async function writeJobs(jobs: OfflineJob[]) {
  await persistSet("queue", JSON.stringify(jobs.slice(0, 200)));
}

async function readResults() {
  const raw = await persistGet("jobResults");
  return raw ? (JSON.parse(raw) as Record<string, number>) : {};
}

async function writeResults(results: Record<string, number>) {
  const entries = Object.entries(results).slice(-300);
  await persistSet("jobResults", JSON.stringify(Object.fromEntries(entries)));
}

function prepare(job: OfflineJob, done: Record<string, number>): OfflineJob | "wait" | "drop" {
  if (job.afterId) {
    const parent = done[job.afterId];
    if (parent == null) return "wait";
    if (parent < 0) return "drop";
  }
  if (!job.bindFrom || !job.bind) return job;
  const id = done[job.bindFrom];
  if (id == null) return "wait";
  if (id < 0) return "drop";
  const token = job.bind === "sale" ? "{saleId}" : "{visitId}";
  const path = job.path.replace(token, String(id));
  let body = job.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const copy = { ...(body as Record<string, unknown>) };
    if (job.bind === "visit" && "visitId" in copy) copy.visitId = id;
    if (job.bind === "sale" && "saleId" in copy) copy.saleId = id;
    body = copy;
  }
  return { ...job, path, body };
}

function benign(job: OfflineJob, err: unknown) {
  if (!(err instanceof ApiError)) return false;
  if (job.kind === "visit-complete" && /already finished/i.test(err.message)) return true;
  if (job.kind === "gps" && /not running/i.test(err.message)) return true;
  return false;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [jobs, setJobs] = useState<OfflineJob[]>([]);
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await readJobs();
    setJobs(next);
    const sync = await persistGet("lastSync");
    setLastSync(sync);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cacheGet = useCallback(async <T,>(key: string) => {
    const raw = await persistGet(`cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  }, []);

  const cacheSet = useCallback(async (key: string, value: unknown) => {
    await persistSet(`cache:${key}`, JSON.stringify(value));
  }, []);

  const enqueue = useCallback(async (input: Omit<OfflineJob, "id" | "createdAt" | "tries">) => {
    const job: OfflineJob = { ...input, id: jobId(), createdAt: new Date().toISOString(), tries: 0 };
    const next = [...(await readJobs()), job];
    await writeJobs(next);
    setJobs(next);
    return job;
  }, []);

  const flush = useCallback(async () => {
    if (!accessToken) return;
    const queued = await readJobs();
    const done = await readResults();
    if (!queued.length) {
      try {
        await api("/health", { token: accessToken });
        setOnline(true);
        const now = new Date().toISOString();
        await persistSet("lastSync", now);
        setLastSync(now);
      } catch (err) {
        setOnline(!isOfflineError(err));
      }
      return;
    }

    const remain: OfflineJob[] = [];
    let stopped = false;
    for (const job of queued) {
      if (stopped) {
        remain.push(job);
        continue;
      }
      const ready = prepare(job, done);
      if (ready === "wait") {
        remain.push(job);
        continue;
      }
      if (ready === "drop") {
        done[job.id] = -1;
        dropPhoto(job.fileUri);
        continue;
      }
      try {
        const data = ready.fileUri
          ? await apiUpload<{ id?: number }>(ready.path, {
              token: accessToken,
              fileUri: ready.fileUri,
              fields: (ready.body as Record<string, string | number | undefined>) ?? {},
            })
          : await api<{ id?: number }>(ready.path, {
              method: ready.method ?? "POST",
              token: accessToken,
              body: ready.body != null ? JSON.stringify(ready.body) : undefined,
            });
        done[job.id] = typeof data?.id === "number" ? data.id : (ready.bindFrom ? done[ready.bindFrom] ?? 0 : 0);
        dropPhoto(ready.fileUri);
        setOnline(true);
      } catch (err) {
        if (isOfflineError(err)) {
          setOnline(false);
          stopped = true;
          remain.push(job);
          continue;
        }
        if (benign(job, err)) {
          done[job.id] = job.bindFrom ? done[job.bindFrom] ?? 0 : 0;
          dropPhoto(job.fileUri);
          continue;
        }
        if (job.tries >= 6) {
          done[job.id] = -1;
          dropPhoto(job.fileUri);
          continue;
        }
        remain.push({ ...job, tries: job.tries + 1 });
      }
    }
    await writeResults(done);
    await writeJobs(remain);
    await pruneLocalVisits(new Set(remain.map((job) => job.id)), done);
    setJobs(remain);
    if (!remain.length) {
      const now = new Date().toISOString();
      await persistSet("lastSync", now);
      setLastSync(now);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    flush();
    const timer = setInterval(flush, 20000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") flush();
    });
    const onlineListener = () => flush();
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("online", onlineListener);
    }
    return () => {
      clearInterval(timer);
      app.remove();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("online", onlineListener);
      }
    };
  }, [accessToken, flush]);

  const value = useMemo<OfflineState>(
    () => ({
      pending: jobs.length,
      jobs,
      online,
      lastSync,
      enqueue,
      flush,
      cacheGet,
      cacheSet,
    }),
    [jobs, online, lastSync, enqueue, flush, cacheGet, cacheSet],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used inside OfflineProvider");
  return ctx;
}

export function requestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
