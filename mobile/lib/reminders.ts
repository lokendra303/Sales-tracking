import type { FollowUp } from "./api";
import { persistGet, persistSet } from "./persist";

type NotificationsModule = typeof import("expo-notifications");

let notifications: NotificationsModule | null | undefined;

function loadNotifications() {
  if (notifications !== undefined) return notifications;
  try {
    const mod = require("expo-notifications") as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    notifications = mod;
  } catch {
    notifications = null;
  }
  return notifications;
}

function identifierFor(id: number) {
  return `follow-${id}`;
}

async function overdueKey(id: number) {
  const day = new Date().toISOString().slice(0, 10);
  return `${day}:${id}`;
}

async function readOverdueFired() {
  const raw = await persistGet("reminded-overdue");
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

async function writeOverdueFired(ids: Set<string>) {
  await persistSet("reminded-overdue", JSON.stringify([...ids].slice(-80)));
}

export async function ensureReminderPermission() {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  try {
    await Notifications.setNotificationChannelAsync("follow-ups", {
      name: "Follow-ups",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
    });
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch {
    return false;
  }
}

export async function cancelAllReminders() {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Notifications are optional.
  }
}

export async function syncReminders(items: FollowUp[]) {
  const Notifications = loadNotifications();
  if (!Notifications) return 0;
  try {
    const allowed = await ensureReminderPermission();
    if (!allowed) return 0;

    const open = items.filter((item) => !item.doneAt);
    const keep = new Set(open.map((item) => identifierFor(item.id)));
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.identifier.startsWith("follow-") && !keep.has(item.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }

    const fired = await readOverdueFired();
    let count = 0;
    const now = Date.now();

    for (const item of open) {
      const due = new Date(item.dueAt).getTime();
      const overdue = due <= now;
      const key = await overdueKey(item.id);
      if (overdue && fired.has(key)) continue;

      const when = overdue ? new Date(now + 20_000) : new Date(due);
      const title = overdue ? `Overdue: ${item.name}` : `Follow-up: ${item.name}`;
      const body = [item.type, item.notes].filter(Boolean).join(" · ") || "Open SalesTrack to call or visit.";

      await Notifications.scheduleNotificationAsync({
        identifier: identifierFor(item.id),
        content: {
          title,
          body,
          data: { leadId: item.leadId, followUpId: item.id },
          sound: "default",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: "follow-ups",
        },
      });
      if (overdue) fired.add(key);
      count += 1;
    }

    await writeOverdueFired(fired);
    return count;
  } catch {
    return 0;
  }
}

export function presentLeadAssigned(leadId: number, name: string) {
  return presentLeadAlert(`lead-${leadId}`, leadId, "New lead assigned", name);
}

export async function presentLeadAlert(identifier: string, leadId: number, title: string, body: string) {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync("leads", {
      name: "New leads",
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        data: { leadId },
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 1000),
        channelId: "leads",
      },
    });
  } catch {
    // The lead is still in the list if the phone cannot show a banner.
  }
}

export function listenReminderTaps(onOpen: (leadId: number | null) => void) {
  const Notifications = loadNotifications();
  if (!Notifications) return () => undefined;
  try {
    let lastHandled = "";
    const handle = (response: import("expo-notifications").NotificationResponse | null) => {
      if (!response) return;
      const key = `${response.notification.request.identifier}:${response.notification.date}`;
      if (key === lastHandled) return;
      lastHandled = key;
      const leadId = Number(response.notification.request.content.data?.leadId);
      onOpen(Number.isFinite(leadId) && leadId > 0 ? leadId : null);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        handle(response);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => undefined);
    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}
