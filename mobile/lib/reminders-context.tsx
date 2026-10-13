import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { api, type FollowUp } from "./api";
import { promptBackgroundOnce } from "./background-permission";
import { useAuth } from "./auth";
import { persistGet, persistSet } from "./persist";
import { clearOldBackgroundTasks, listenLeadPushes, registerPushToken, watchAssignedLeads, watchPendingLeads } from "./lead-alerts";
import { cancelAllReminders, listenReminderTaps, syncReminders } from "./reminders";
import { isAdmin, isManager, isSales } from "./roles";

type ReminderState = {
  enabled: boolean;
  scheduled: number;
  items: FollowUp[];
  setEnabled: (on: boolean) => Promise<void>;
  refresh: () => Promise<void>;
};

const ReminderContext = createContext<ReminderState | null>(null);

function openFromAlert(leadId: number | null, attempt = 0) {
  setTimeout(() => {
    try {
      if (leadId) router.push(`/lead/${leadId}`);
      else router.push("/notifications");
    } catch {
      if (attempt < 8) openFromAlert(leadId, attempt + 1);
    }
  }, attempt === 0 ? 300 : 700);
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [enabled, setOn] = useState(true);
  const [scheduled, setScheduled] = useState(0);
  const [items, setItems] = useState<FollowUp[]>([]);

  useEffect(() => {
    persistGet("remindersEnabled").then((value) => {
      if (value === "0") setOn(false);
    });
    void clearOldBackgroundTasks();
    const removeTaps = listenReminderTaps(openFromAlert);
    const removePushes = listenLeadPushes();
    return () => {
      removeTaps();
      removePushes();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!accessToken || !user || isAdmin(user.roles)) {
      setItems([]);
      setScheduled(0);
      return;
    }
    try {
      const rows = await api<FollowUp[]>("/follow-ups", { token: accessToken });
      const open = rows.filter((row) => !row.doneAt);
      setItems(open);
      if (enabled) setScheduled(await syncReminders(open));
      else {
        await cancelAllReminders();
        setScheduled(0);
      }
    } catch {
      // Offline: keep last list. GET cache in api() may still populate.
    }
  }, [accessToken, enabled, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!accessToken || !user) return;
    const sales = isSales(user.roles);
    const manager = isManager(user.roles);
    if (!sales && !manager) return;
    let stop = false;
    const tick = () => {
      if (stop) return;
      if (sales) watchAssignedLeads(accessToken, user.id, user.name).catch(() => undefined);
      if (manager) watchPendingLeads(accessToken, user.id).catch(() => undefined);
    };
    tick();
    const register = setTimeout(() => {
      if (stop) return;
      void registerPushToken(accessToken, user.id).finally(() => {
        if (!stop) void promptBackgroundOnce();
      });
    }, 5000);
    const timer = setInterval(tick, 45000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      stop = true;
      clearTimeout(register);
      clearInterval(timer);
      sub.remove();
    };
  }, [accessToken, user?.id, user?.name, user?.roles.join(",")]);

  const value = useMemo<ReminderState>(
    () => ({
      enabled,
      scheduled,
      items,
      setEnabled: async (on) => {
        setOn(on);
        await persistSet("remindersEnabled", on ? "1" : "0");
        if (!on) {
          await cancelAllReminders();
          setScheduled(0);
        } else {
          await refresh();
        }
      },
      refresh,
    }),
    [enabled, scheduled, items, refresh],
  );

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders() {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error("useReminders must be used inside ReminderProvider");
  return ctx;
}
