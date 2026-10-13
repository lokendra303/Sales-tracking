import { api, type Lead } from "./api";
import { persistGet, persistSet } from "./persist";
import { presentLeadAssigned } from "./reminders";

type NotificationsModule = typeof import("expo-notifications");
type ExtraConfig = { remotePush?: boolean; eas?: { projectId?: string } };

const seenKey = "seen-lead-ids";
const readyKey = "seen-leads-ready";
const remoteKey = "remote-push-user";

function notifications(): NotificationsModule | null {
  try {
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

function appExtra(): ExtraConfig {
  try {
    const loaded = require("expo-constants") as {
      default?: { expoConfig?: { extra?: ExtraConfig } };
      expoConfig?: { extra?: ExtraConfig };
    };
    return (loaded.default ?? loaded).expoConfig?.extra ?? {};
  } catch {
    return {};
  }
}

async function readSeen() {
  try {
    const raw = await persistGet(seenKey);
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    return new Set(ids.filter((id) => Number.isFinite(id)));
  } catch {
    return new Set<number>();
  }
}

async function writeSeen(ids: Set<number>) {
  await persistSet(seenKey, JSON.stringify([...ids].slice(-300)));
}

export async function markLeadSeen(leadId: number) {
  const seen = await readSeen();
  seen.add(leadId);
  await writeSeen(seen);
}

export async function watchAssignedLeads(token: string, userId: number, userName: string) {
  const data = await api<{ leads: Lead[] }>("/leads?filter=all", { token });
  const mine = data.leads.filter((lead) => lead.assigneeId && !(lead.source === "MANUAL" && lead.createdByName === userName));
  const seen = await readSeen();

  const ready = (await persistGet(readyKey)) === "1";
  const remote = (await persistGet(remoteKey)) === String(userId);
  if (!ready || remote) {
    for (const lead of mine) seen.add(lead.id);
    await writeSeen(seen);
    await persistSet(readyKey, "1");
    return;
  }

  for (const lead of mine) {
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    await presentLeadAssigned(lead.id, lead.name);
  }
  await writeSeen(seen);
}

export function listenLeadPushes() {
  const Notifications = notifications();
  if (!Notifications) return () => undefined;
  try {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const leadId = Number(notification.request.content.data?.leadId);
      if (Number.isFinite(leadId) && leadId > 0) void markLeadSeen(leadId).catch(() => undefined);
    });
    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}

export async function clearOldBackgroundTasks() {
  try {
    const TaskManager = require("expo-task-manager") as typeof import("expo-task-manager");
    const tasks = await TaskManager.getRegisteredTasksAsync();
    if (tasks.length) await TaskManager.unregisterAllTasksAsync();
    return true;
  } catch {
    return false;
  }
}

function withTimeout<T>(work: Promise<T>, ms: number) {
  return Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export async function registerPushToken(token: string, userId: number) {
  try {
    const extra = appExtra();
    const projectId = extra.eas?.projectId;
    if (!extra.remotePush || !projectId) return;
    if (!(await clearOldBackgroundTasks())) return;
    const Notifications = notifications();
    if (!Notifications) return;
    await Notifications.setNotificationChannelAsync("leads", {
      name: "New leads",
      importance: Notifications.AndroidImportance.HIGH,
    });
    const current = await Notifications.getPermissionsAsync();
    const allowed = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!allowed.granted) return;
    const push = await withTimeout(Notifications.getExpoPushTokenAsync({ projectId }), 10000);
    if (!push || !("data" in push) || !push.data) return;
    await api("/auth/push-token", {
      method: "POST",
      token,
      body: JSON.stringify({ token: push.data, deviceUid: "salestrack-dev" }),
    });
    await persistSet(remoteKey, String(userId));
  } catch {
    await persistSet(remoteKey, "").catch(() => undefined);
  }
}
