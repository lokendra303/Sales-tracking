import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { router } from "expo-router";
import { api, type FollowUp } from "./api";
import { useAuth } from "./auth";
import { persistGet, persistSet } from "./persist";
import { cancelAllReminders, listenReminderTaps, syncReminders } from "./reminders";
import { isAdmin } from "./roles";

type ReminderState = {
  enabled: boolean;
  scheduled: number;
  items: FollowUp[];
  setEnabled: (on: boolean) => Promise<void>;
  refresh: () => Promise<void>;
};

const ReminderContext = createContext<ReminderState | null>(null);

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [enabled, setOn] = useState(true);
  const [scheduled, setScheduled] = useState(0);
  const [items, setItems] = useState<FollowUp[]>([]);

  useEffect(() => {
    persistGet("remindersEnabled").then((value) => {
      if (value === "0") setOn(false);
    });
    return listenReminderTaps((leadId) => {
      if (leadId) router.push(`/lead/${leadId}`);
      else router.push("/notifications");
    });
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
