import { api, type Lead } from "./api";
import { persistGet, persistSet } from "./persist";
import { presentLeadAssigned } from "./reminders";

const seenKey = "seen-lead-ids";
const readyKey = "seen-leads-ready";

async function readSeen() {
  const raw = await persistGet(seenKey);
  const ids = raw ? (JSON.parse(raw) as number[]) : [];
  return new Set(ids.filter((id) => Number.isFinite(id)));
}

async function writeSeen(ids: Set<number>) {
  await persistSet(seenKey, JSON.stringify([...ids].slice(-300)));
}

async function shownLeadIds() {
  const ids = new Set<number>();
  try {
    const Notifications = require("expo-notifications") as typeof import("expo-notifications");
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const item of presented) {
      const leadId = Number(item.request.content.data?.leadId);
      if (Number.isFinite(leadId) && leadId > 0) ids.add(leadId);
    }
  } catch {
    // Notifications are optional.
  }
  return ids;
}

export async function watchAssignedLeads(token: string, userName: string) {
  const data = await api<{ leads: Lead[] }>("/leads?filter=all", { token });
  const mine = data.leads.filter((lead) => lead.assigneeId && !(lead.source === "MANUAL" && lead.createdByName === userName));
  const seen = await readSeen();
  const alreadyShown = await shownLeadIds();
  for (const id of alreadyShown) seen.add(id);

  const ready = (await persistGet(readyKey)) === "1";
  if (!ready) {
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

export async function registerPushToken(token: string) {
  try {
    const Notifications = require("expo-notifications") as typeof import("expo-notifications");
    const loaded = require("expo-constants") as {
      default?: { expoConfig?: { extra?: { eas?: { projectId?: string } } } };
      expoConfig?: { extra?: { eas?: { projectId?: string } } };
    };
    const constants = loaded.default ?? loaded;
    await Notifications.setNotificationChannelAsync("leads", {
      name: "New leads",
      importance: Notifications.AndroidImportance.HIGH,
    });
    const current = await Notifications.getPermissionsAsync();
    const allowed = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!allowed.granted) return;
    const projectId = constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const push = await Promise.race([
      Notifications.getExpoPushTokenAsync({ projectId }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (!push || !("data" in push) || !push.data) return;
    await api("/auth/push-token", {
      method: "POST",
      token,
      body: JSON.stringify({ token: push.data, deviceUid: "salestrack-dev" }),
    });
  } catch {
    // A phone without push setup still gets the alert the next time the app checks.
  }
}
