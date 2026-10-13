import { api, type Lead } from "./api";
import { persistGet, persistSet } from "./persist";
import { presentLeadAlert, presentLeadAssigned } from "./reminders";

type NotificationsModule = typeof import("expo-notifications");
type ExtraConfig = { remotePush?: boolean; eas?: { projectId?: string } };

const seenKey = "seen-lead-ids";
const readyKey = "seen-leads-ready";
const remoteKey = "remote-push-user";
const myPendingKey = "my-pending-lead-ids";
const pendingSeenKey = "seen-pending-ids";
const pendingReadyKey = "seen-pending-ready";

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

async function readIds(key: string) {
  try {
    const raw = await persistGet(key);
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    return new Set(ids.filter((id) => Number.isFinite(id)));
  } catch {
    return new Set<number>();
  }
}

async function writeIds(key: string, ids: Set<number>) {
  await persistSet(key, JSON.stringify([...ids].slice(-300)));
}

export async function markLeadSeen(leadId: number) {
  const seen = await readIds(seenKey);
  seen.add(leadId);
  await writeIds(seenKey, seen);
}

/** First run on a phone, or push already active for this user: remember what exists, show nothing. */
async function quietRun(readyFlag: string, userId: number) {
  const ready = (await persistGet(readyFlag)) === "1";
  const remote = (await persistGet(remoteKey)) === String(userId);
  if (!ready) await persistSet(readyFlag, "1");
  return !ready || remote;
}

export async function watchAssignedLeads(token: string, userId: number, userName: string) {
  const data = await api<{ leads: Lead[] }>("/leads?filter=all", { token });
  const ownAdded = (lead: Lead) => lead.source === "MANUAL" && lead.createdByName === userName;
  const mine = data.leads.filter((lead) => lead.assigneeId && !ownAdded(lead));
  const seen = await readIds(seenKey);
  const waiting = await readIds(myPendingKey);
  const nowWaiting = new Set(data.leads.filter((lead) => ownAdded(lead) && lead.approvalStatus === "PENDING").map((lead) => lead.id));
  const quiet = await quietRun(readyKey, userId);

  for (const lead of mine) {
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    if (!quiet) await presentLeadAssigned(lead.id, lead.name);
  }
  for (const lead of data.leads) {
    if (!quiet && waiting.has(lead.id) && lead.approvalStatus === "APPROVED") {
      await presentLeadAlert(`approved-${lead.id}`, lead.id, "Lead approved", `${lead.name} · you can visit it now`);
    }
  }
  await writeIds(seenKey, seen);
  await writeIds(myPendingKey, nowWaiting);
}

export async function watchPendingLeads(token: string, userId: number) {
  const data = await api<{ leads: Lead[] }>("/leads?filter=pending", { token });
  const pending = data.leads.filter((lead) => lead.approvalStatus === "PENDING");
  const seen = await readIds(pendingSeenKey);
  const quiet = await quietRun(pendingReadyKey, userId);
  for (const lead of pending) {
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    if (!quiet) {
      const from = lead.createdByName ? ` · added by ${lead.createdByName}` : "";
      await presentLeadAlert(`approval-${lead.id}`, lead.id, "Lead needs approval", `${lead.name}${from}`);
    }
  }
  await writeIds(pendingSeenKey, seen);
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
