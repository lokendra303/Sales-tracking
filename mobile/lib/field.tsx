import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, AppState, Platform } from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import { api, ApiError, isOfflineError, type DaySummary, type FieldSession } from "./api";
import { persistGet, persistSet } from "./persist";
import { useAuth } from "./auth";
import { useOffline } from "./offline";
import { isSales } from "./roles";
import { FIELD_LOCATION_TASK } from "./location-task";

type Point = {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  mocked?: boolean;
  capturedAt: string;
};

type FieldState = {
  session: FieldSession | null;
  notice: string;
  weakGps: boolean;
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

async function readQueue() {
  const raw = await persistGet("fieldQueue");
  return raw ? (JSON.parse(raw) as Point[]) : [];
}

async function writeQueue(points: Point[]) {
  await persistSet("fieldQueue", JSON.stringify(points.slice(-200)));
}

export function FieldProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, refreshUser } = useAuth();
  const offline = useOffline();
  const sales = isSales(user?.roles);
  const [session, setSession] = useState<FieldSession | null>(null);
  const [notice, setNotice] = useState("");
  const [weakGps, setWeakGps] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const sessionRef = useRef<FieldSession | null>(null);

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

  const flush = useCallback(async () => {
    const current = sessionRef.current;
    if (!accessToken || !current?.id || current.status !== "ACTIVE") return;
    const queued = await readQueue();
    if (!queued.length) return;
    if (!current.liveStreaming) {
      await writeQueue([]);
      return;
    }
    try {
      const data = await api<{ stored: number; warning: string | null; session: FieldSession }>("/field/points", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ sessionId: current.id, points: queued }),
      });
      await writeQueue([]);
      setWeakGps(data.warning === "WEAK_GPS");
      apply(data.session);
    } catch (err) {
      if (err instanceof ApiError && err.code === "LIVE_OFF") {
        await writeQueue([]);
        setNotice("Admin turned live location Off. Field work is still a clock.");
        apply({ ...current, liveLocationEnabled: false, liveStreaming: false });
        await refreshUser();
        return;
      }
      if (err instanceof ApiError && err.code === "NO_SESSION") {
        await writeQueue([]);
        apply({ ...idle, liveLocationEnabled: current.liveLocationEnabled });
      }
    }
  }, [accessToken, apply, refreshUser]);

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
        const point: Point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? undefined,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
          mocked: "mocked" in position.coords ? Boolean((position.coords as { mocked?: boolean }).mocked) : undefined,
          capturedAt: new Date().toISOString(),
        };
        setWeakGps((position.coords.accuracy ?? 0) > 80);
        const queued = await readQueue();
        queued.push(point);
        await writeQueue(queued);
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
    try {
      const data = await api<FieldSession>("/field/session", { token: accessToken });
      apply(data);
      if (data.liveStreaming) await startWatch(data);
      else await stopWatch();
    } catch {
      // ignore
    }
  }, [accessToken, apply, sales, startWatch, stopWatch]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => {
      clearInterval(poll);
      app.remove();
      stopWatch();
    };
  }, [load, stopWatch]);

  const start = useCallback(async () => {
    if (!accessToken) return;
    const live = user?.liveLocationEnabled ? "On" : "Off";
    const copy =
      live === "On"
        ? "This starts your day clock. Live location is On, so GPS is sent to SalesTrack only until you tap End Field Work. Never 24/7."
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
    const data = await api<FieldSession>("/field/start", { method: "POST", token: accessToken });
    setNotice("");
    apply(data);
    if (data.liveStreaming) await startWatch(data);
  }, [accessToken, apply, startWatch, user?.liveLocationEnabled]);

  const end = useCallback(async () => {
    if (!accessToken) return;
    await stopWatch();
    try {
      await flush();
    } catch {
      // GPS can stay queued.
    }
    let data: FieldSession;
    try {
      data = await api<FieldSession>("/field/end", { method: "POST", token: accessToken });
      await writeQueue([]);
    } catch (err) {
      if (isOfflineError(err)) {
        await offline.enqueue({ kind: "gps", label: "End field work", path: "/field/end" });
        data = {
          ...(sessionRef.current ?? idle),
          status: "ENDED",
          endedAt: new Date().toISOString(),
          endedReason: "USER",
          liveStreaming: false,
        };
        setNotice("Day closed on this phone. We will confirm when you are back on Wi-Fi.");
      } else {
        throw err;
      }
    }
    setWeakGps(false);
    apply(data);
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
  }, [accessToken, apply, flush, offline, stopWatch]);

  const value = useMemo<FieldState>(
    () => ({ session, notice, weakGps, start, end }),
    [session, notice, weakGps, start, end],
  );

  return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>;
}

export function useField() {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error("useField must be used inside FieldProvider");
  return ctx;
}
