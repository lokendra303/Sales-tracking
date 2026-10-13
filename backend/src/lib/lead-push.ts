import { prisma } from "./prisma.js";

type PushTicket = { status: "ok" | "error"; details?: { error?: string } };

export function notifyLeadAssigned(userId: number, lead: { id: number; name: string }) {
  void deliver(userId, lead).catch(() => undefined);
}

async function deliver(userId: number, lead: { id: number; name: string }) {
  const devices = await prisma.device.findMany({
    where: { userId, status: "ACTIVE", pushToken: { not: null } },
    select: { pushToken: true },
  });
  const tokens = [...new Set(devices.map((item) => item.pushToken).filter((token): token is string => Boolean(token)))];
  if (!tokens.length) return;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(
      tokens.map((to) => ({
        to,
        title: "New lead assigned",
        body: lead.name,
        sound: "default",
        priority: "high",
        channelId: "leads",
        data: { leadId: lead.id },
      })),
    ),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return;
  const json = (await response.json()) as { data?: PushTicket[] };
  const dead = (json.data ?? [])
    .map((ticket, index) => (ticket.details?.error === "DeviceNotRegistered" ? tokens[index] : null))
    .filter((token): token is string => Boolean(token));
  if (dead.length) {
    await prisma.device.updateMany({ where: { pushToken: { in: dead } }, data: { pushToken: null } });
  }
}
