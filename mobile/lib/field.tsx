import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, AppState, Platform } from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import { api, ApiError, isOfflineError, type DaySummary, type FieldSession } from "./api";
import { persistGet, persistSet } from "./persist";
import { appendGpsPoints, clearGpsQueue, readGpsQueue, trimGpsQueue, type GpsPoint } from "./gps-queue";
import { useAuth } from "./auth";
import { isSales } from "./roles";
import { FIELD_LOCATION_TASK } from "./location-task";

type FieldState = {
  session: FieldSession | null;
  notice: string;
  weakGps: boolean;
  queuedPoints: number;
  start: () => Promise<void>;
  end: () => Promise<void>;
};

const FieldContext = createContext<FieldState | null>(null);

const idle: FieldSession = {
  id: null,
  status: "IDLE",
  startedAt: null,
  endedAt: null,
  endedReason: null,
  liveLocationEnabled: false,
  liveStreaming: false,
  lastLat: null,
  lastLng: null,
  lastAccuracy: null,
  lastSeenAt: null,
  lastSeenAgeSeconds: null,
  pointCount: 0,
  intervalSeconds: 300,
  autoCloseHours: 12,
  durationMinutes: 0,
};

export function FieldProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, refreshUser } = useAuth();
  const sales = isSales(user?.roles);
  const [session, setSession] = useState<FieldSession | null>(null);
  const [notice, setNotice] = useState("");
  const [weakGps, setWeakGps] = useState(false);
  const [queuedPoints, setQueuedPoints] = useState(0);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const sessionRef = useRef<FieldSession | null>(null);
  const holdRef = useRef(0);
  const flushing = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const apply = useCallback((next: FieldSession) => {
    setSession(next);
    sessionRef.current = next;
    if (next.autoClosed) {
      setNotice("Field work closed after a long day. Start again if you are still out.");
    }
  }, []);

  const rememberCount = useCallback(async () => {
    const queued = await readGpsQueue();
    setQueuedPoints(queued.length);
  }, []);

  const flush = useCallback(async () => {
    if (!accessToken || flushing.current) return;
    if (Date.now() < holdRef.current) return;
    flushing.current = true;
    try {
      let current = sessionRef.current;
      const endPending = (await persistGet("fieldEndPending")) === "1";
      const queued = await readGpsQueue();
      setQueuedPoints(queued.length);
      const localActive = current?.status === "ACTIVE" && !current.id;
      if (!queued.length && !endPending && !localActive) return;

      if (!current?.id || current.status !== "ACTIVE") {
        try {
          const started = await api<FieldSession>("/field/start", { method: "POST", token: accessToken });
          await persistSet("fieldLocal", "0");
          apply(started);
          current = started;
        } catch (err) {
          if (isOfflineError(err)) holdRef.current = Date.now() + 15000;
          return;
        }
      }

      const batch = await readGpsQueue();
      if (batch.length && current?.id && current.liveStreaming) {
        try {
          const data = await api<{ stored: number; warning: string | null; session: FieldSession }>("/field/points", {
            method: "POST",
            token: accessToken,
            body: JSON.stringify({ sessionId: current.id, points: batch }),
          });
          await trimGpsQueue(batch.length);
          setWeakGps(data.warning === "WEAK_GPS");
          apply(data.session);
          current = data.session;
        } catch (err) {
          if (isOfflineError(err)) holdRef.current = Date.now() + 15000;
          if (err instanceof ApiError && err.code === "NO_SESSION") {
            apply({ ...(sessionRef.current ?? current), id: null, status: "ACTIVE" });
          }
          if (err instanceof ApiError && err.code === "LIVE_OFF") {
            await clearGpsQueue();
            setNotice("Admin turned live location Off. Field work is still a clock.");
            apply({ ...current, liveLocationEnabled: false, liveStreaming: false });
            await refreshUser();
          }
          await rememberCount();
          return;
        }
      } else if (batch.length && current && !current.liveLocationEnabled) {
        await clearGpsQueue();
      }

      if ((await persistGet("fieldEndPending")) === "1" && current?.id) {
        try {
          const ended = await api<FieldSession>("/field/end", { method: "POST", token: accessToken });
          await persistSet("fieldEndPending", "0");
          await persistSet("fieldLocal", "0");
          apply(ended);
        } catch (err) {
          if (isOfflineError(err)) holdRef.current = Date.now() + 15000;
          if (err instanceof ApiError && /not running/i.test(err.message)) {
            await persistSet("fieldEndPending", "0");
          }
        }
      }
      await rememberCount();
    } finally {
      flushing.current = false;
    }
  }, [accessToken, apply, refreshUser, rememberCount]);

  const stopWatch = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = null;
    if (Platform.OS !== "web") {
      try {
        const started = await Location.hasStartedLocationUpdatesAsync(FIELD_LOCATION_TASK);
        if (started) await Location.stopLocationUpdatesAsync(FIELD_LOCATION_TASK);
      } catch {
        // web or Expo Go
      }
    }
  }, []);

  const startWatch = useCallback(async (current: FieldSession) => {
    if (!current.liveStreaming) {
      await stopWatch();
      return;
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setNotice("Location is off. Field work is running as a clock only.");
      return;
    }
    await stopWatch();
    const interval = Math.max(15, current.intervalSeconds) * 1000;
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: interval, distanceInterval: 40 },
      async (position) => {
        const point: GpsPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? undefined,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
          mocked: "mocked" in position.coords ? Boolean((position.coords as { mocked?: boolean }).mocked) : undefined,
          capturedAt: new Date().toISOString(),
        };
        setWeakGps((position.coords.accuracy ?? 0) > 80);
        await appendGpsPoints([point]);
        const queued = await readGpsQueue();
        setQueuedPoints(queued.length);
        flush();
      },
    );
    if (Platform.OS === "android") {
      try {
        await Location.startLocationUpdatesAsync(FIELD_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: interval,
          distanceInterval: 40,
          foregroundService: {
            notificationTitle: "Live location is on",
            notificationBody: "SalesTrack is sharing GPS during field work.",
          },
        });
      } catch {
        // Expo web / missing background permission
      }
    }
  }, [flush, stopWatch]);

  const load = useCallback(async () => {
    if (!accessToken || !sales) return;
    if ((await persistGet("fieldLocal")) === "1") {
      await flush();
      return;
    }
    try {
      const data = await api<FieldSession>("/field/session", { token: accessToken });
      apply(data);
      if (data.liveStreaming) await startWatch(data);
      else await stopWatch();
      await flush();
    } catch {
      await flush();
    }
  }, [accessToken, apply, flush, sales, startWatch, stopWatch]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30000);
    const sync = setInterval(() => {
      flush();
    }, 20000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        holdRef.current = 0;
        load();
      }
    });
    return () => {
      clearInterval(poll);
      clearInterval(sync);
      app.remove();
      stopWatch();
    };
  }, [flush, load, stopWatch]);

  const start = useCallback(async () => {
    if (!accessToken) return;
    const live = user?.liveLocationEnabled ? "On" : "Off";
    const copy =
      live === "On"
        ? "This starts your day clock. Live location is On, so GPS is saved during field work and sent when the network is back. Never 24/7."
        : "This starts your day clock. Live location is Off, so we will not stream GPS. Visit check-in still uses one GPS reading at the shop.";
    const ok =
      Platform.OS === "web"
        ? window.confirm(`Start field work\n\n${copy}`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert("Start field work", copy, [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Start", onPress: () => resolve(true) },
            ]);
          });
    if (!ok) return;
    try {
      const data = await api<FieldSession>("/field/start", { method: "POST", token: accessToken });
      await persistSet("fieldLocal", "0");
      setNotice("");
      apply(data);
      if (data.liveStreaming) await startWatch(data);
    } catch (err) {
      if (!isOfflineError(err)) {
        Alert.alert("Could not start", err instanceof Error ? err.message : "Try again.");
        return;
      }
      const local: FieldSession = {
        ...idle,
        status: "ACTIVE",
        startedAt: new Date().toISOString(),
        liveLocationEnabled: Boolean(user?.liveLocationEnabled),
        liveStreaming: Boolean(user?.liveLocationEnabled),
      };
      await persistSet("fieldLocal", "1");
      apply(local);
      setNotice("No network. GPS stays on this phone and uploads when you are back online.");
      if (local.liveStreaming) await startWatch(local);
    }
  }, [accessToken, apply, startWatch, user?.liveLocationEnabled]);

  const end = useCallback(async () => {
    if (!accessToken) return;
    await stopWatch();
    await persistSet("fieldEndPending", "1");
    await persistSet("fieldLocal", "0");
    holdRef.current = 0;
    try {
      await flush();
    } catch {
      // GPS stays queued.
    }
    const stillPending = (await persistGet("fieldEndPending")) === "1";
    if (stillPending) {
      apply({
        ...(sessionRef.current ?? idle),
        status: "ENDED",
        endedAt: new Date().toISOString(),
        endedReason: "USER",
        liveStreaming: false,
      });
      setNotice("Day closed on this phone. GPS and the close will send when the network is back.");
    }
    setWeakGps(false);
    try {
      const summary = await api<DaySummary>("/reports/day-summary", { token: accessToken });
      const lines = `${summary.visits} visits · ₹${summary.salesAmount.toLocaleString("en-IN")} sales · ${summary.missedStops} missed · ${summary.overdueFollowUps} overdue`;
      if (Platform.OS === "web") {
        window.alert(`Day summary\n\n${lines}`);
      } else {
        Alert.alert("Day summary", lines, [
          { text: "OK" },
          { text: "My performance", onPress: () => router.push("/reports") },
        ]);
      }
    } catch {
      // Day is still closed even if the summary fails.
    }
  }, [accessToken, apply, flush, stopWatch]);

  const value = useMemo<FieldState>(
    () => ({ session, notice, weakGps, queuedPoints, start, end }),
    [session, notice, weakGps, queuedPoints, start, end],
  );

  return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>;
}

export function useField() {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error("useField must be used inside FieldProvider");
  return ctx;
}
