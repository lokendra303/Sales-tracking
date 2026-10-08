import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { api, apiUpload, isOfflineError } from "./api";
import { persistGet, persistSet } from "./persist";
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
    for (const job of queued) {
      try {
        if (job.fileUri) {
          await apiUpload(job.path, { token: accessToken, fileUri: job.fileUri, fields: (job.body as Record<string, string | number | undefined>) ?? {} });
        } else {
          await api(job.path, {
            method: job.method ?? "POST",
            token: accessToken,
            body: job.body != null ? JSON.stringify(job.body) : undefined,
          });
        }
        setOnline(true);
      } catch (err) {
        if (isOfflineError(err)) {
          setOnline(false);
          remain.push(job, ...queued.slice(queued.indexOf(job) + 1));
          break;
        }
        if (job.tries >= 6) continue;
        remain.push({ ...job, tries: job.tries + 1 });
      }
    }
    await writeJobs(remain);
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
