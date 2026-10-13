import { prisma } from "./prisma.js";

type PushTicket = { status: "ok" | "error"; details?: { error?: string } };
type PushMessage = { title: string; body: string; data: Record<string, unknown> };

export function notifyLeadAssigned(userId: number, lead: { id: number; name: string }) {
  void deliver([userId], { title: "New lead assigned", body: lead.name, data: { leadId: lead.id } }).catch(() => undefined);
}

export function notifyLeadForApproval(tenantId: number, lead: { id: number; name: string }, fromName: string) {
  void (async () => {
    const managers = await prisma.user.findMany({
      where: { tenantId, status: "ACTIVE", roles: { some: { role: { code: "MANAGER" } } } },
      select: { id: true },
    });
    await deliver(
      managers.map((item) => item.id),
      { title: "Lead needs approval", body: `${lead.name} · added by ${fromName}`, data: { leadId: lead.id, kind: "approval" } },
    );
  })().catch(() => undefined);
}

export function notifyLeadDecision(userId: number, lead: { id: number; name: string }, approved: boolean) {
  void deliver([userId], {
    title: approved ? "Lead approved" : "Lead rejected",
    body: approved ? `${lead.name} · you can visit it now` : lead.name,
    data: { leadId: lead.id, kind: "decision" },
  }).catch(() => undefined);
}

async function deliver(userIds: number[], message: PushMessage) {
  if (!userIds.length) return;
  const devices = await prisma.device.findMany({
    where: { userId: { in: userIds }, status: "ACTIVE", pushToken: { not: null } },
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
        title: message.title,
        body: message.body,
        sound: "default",
        priority: "high",
        channelId: "leads",
        data: message.data,
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
