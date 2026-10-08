import type { RoleCode } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { isManager } from "../crm/crm.helpers.js";
import { isoDay, movePlannedTo, parseDay, plannedAtFor, publicStop } from "./beat.helpers.js";

const stopInclude = { lead: true, customer: true };

async function requireSalesUser(tenantId: number, userId: number) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, status: "ACTIVE" },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw notFound("Salesperson not found.");
  const roles = user.roles.map((item) => item.role.code);
  if (!roles.includes("SALES_EXECUTIVE") || roles.includes("ADMIN") || roles.includes("MANAGER")) {
    throw badRequest("Beat planning is only for sales executives.");
  }
  return user;
}

function targetUserId(roles: RoleCode[], selfId: number, requested?: number) {
  if (isManager(roles)) {
    if (!requested) throw badRequest("Pick a salesperson.");
    return requested;
  }
  return selfId;
}

async function stopsForDay(tenantId: number, userId: number, date: string) {
  const { start, end } = parseDay(date);
  return prisma.beatStop.findMany({
    where: { tenantId, userId, plannedAt: { gte: start, lte: end } },
    include: stopInclude,
    orderBy: { sequence: "asc" },
  });
}

export async function overview(tenantId: number, date: string) {
  const { start, end } = parseDay(date);
  const people = await prisma.user.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
      roles: { some: { role: { code: "SALES_EXECUTIVE" } } },
      NOT: { roles: { some: { role: { code: { in: ["ADMIN", "MANAGER"] } } } } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (!people.length) return { date, people: [] };
  const counts = await prisma.beatStop.groupBy({
    by: ["userId"],
    where: { tenantId, plannedAt: { gte: start, lte: end }, userId: { in: people.map((item) => item.id) } },
    _count: { id: true },
  });
  const byUser = new Map(counts.map((row) => [row.userId, row._count.id]));
  return {
    date,
    people: people.map((person) => ({
      userId: person.id,
      name: person.name,
      stopCount: byUser.get(person.id) ?? 0,
    })),
  };
}

export async function listBeat(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  date?: string;
  forUserId?: number;
}) {
  const { date } = parseDay(input.date);
  if (isManager(input.roles) && !input.forUserId) {
    return overview(input.tenantId, date);
  }

  const userId = targetUserId(input.roles, input.userId, input.forUserId);
  const user = await requireSalesUser(input.tenantId, userId);
  const stops = await stopsForDay(input.tenantId, userId, date);
  return {
    date,
    userId,
    userName: user.name,
    planned: stops.length > 0,
    stops: stops.map(publicStop),
  };
}

export async function addStop(input: {
  tenantId: number;
  roles: RoleCode[];
  userId: number;
  date: string;
  leadId?: number;
  customerId?: number;
}) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can plan the beat.");
  if (!input.leadId && !input.customerId) throw badRequest("Pick a lead or a customer.");
  if (input.leadId && input.customerId) throw badRequest("A stop is one lead or one customer, not both.");

  const user = await requireSalesUser(input.tenantId, input.userId);
  const { date, start, end } = parseDay(input.date);
  const existing = await prisma.beatStop.findFirst({
    where: {
      tenantId: input.tenantId,
      userId: user.id,
      plannedAt: { gte: start, lte: end },
      ...(input.leadId ? { leadId: input.leadId } : { customerId: input.customerId }),
    },
  });
  if (existing) throw badRequest("That stop is already on this beat.");

  if (input.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: input.leadId, tenantId: input.tenantId } });
    if (!lead) throw notFound("Lead not found.");
    if (lead.approvalStatus !== "APPROVED") {
      throw badRequest("Approve this lead before adding it to the beat.");
    }
    if (lead.status === "LOST") throw badRequest("Do not put a lost lead on the beat.");
    if (!lead.assigneeId) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { assigneeId: user.id, status: lead.status === "NEW" ? "ASSIGNED" : lead.status },
      });
    }
  }
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: input.tenantId } });
    if (!customer) throw notFound("Customer not found.");
  }

  const last = await prisma.beatStop.findFirst({
    where: { tenantId: input.tenantId, userId: user.id, plannedAt: { gte: start, lte: end } },
    orderBy: { sequence: "desc" },
  });
  const sequence = (last?.sequence ?? 0) + 1;
  const stop = await prisma.beatStop.create({
    data: {
      tenantId: input.tenantId,
      userId: user.id,
      leadId: input.leadId ?? null,
      customerId: input.customerId ?? null,
      sequence,
      plannedAt: plannedAtFor(date, sequence),
    },
    include: stopInclude,
  });
  return publicStop(stop);
}

export async function removeStop(tenantId: number, roles: RoleCode[], id: number) {
  if (!isManager(roles)) throw forbidden("Only a manager can change the beat.");
  const stop = await prisma.beatStop.findFirst({ where: { id, tenantId } });
  if (!stop) throw notFound("Stop not found.");
  await prisma.beatStop.delete({ where: { id } });
  if (stop.plannedAt) {
    const { start, end } = parseDay(isoDay(stop.plannedAt));
    const rest = await prisma.beatStop.findMany({
      where: { tenantId, userId: stop.userId, plannedAt: { gte: start, lte: end } },
      orderBy: { sequence: "asc" },
    });
    await Promise.all(rest.map((item, index) => prisma.beatStop.update({ where: { id: item.id }, data: { sequence: index + 1 } })));
  }
  return { ok: true };
}

export async function reorderStops(input: {
  tenantId: number;
  roles: RoleCode[];
  userId: number;
  date: string;
  stopIds: number[];
}) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can change the beat.");
  const user = await requireSalesUser(input.tenantId, input.userId);
  const { date, start, end } = parseDay(input.date);
  const current = await prisma.beatStop.findMany({
    where: { tenantId: input.tenantId, userId: user.id, plannedAt: { gte: start, lte: end } },
  });
  if (current.length !== input.stopIds.length || current.some((item) => !input.stopIds.includes(item.id))) {
    throw badRequest("Send every stop on this day, in the new order.");
  }
  await Promise.all(
    input.stopIds.map((id, index) =>
      prisma.beatStop.update({
        where: { id },
        data: { sequence: index + 1, plannedAt: plannedAtFor(date, index + 1) },
      }),
    ),
  );
  return listBeat({
    tenantId: input.tenantId,
    userId: user.id,
    roles: input.roles,
    date,
    forUserId: user.id,
  });
}

export async function copyBeat(input: {
  tenantId: number;
  roles: RoleCode[];
  fromUserId: number;
  fromDate: string;
  toUserId?: number;
  toDate: string;
}) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can copy a beat.");
  if (input.fromDate === input.toDate && (input.toUserId ?? input.fromUserId) === input.fromUserId) {
    throw badRequest("Pick a different day to copy to.");
  }
  const fromUser = await requireSalesUser(input.tenantId, input.fromUserId);
  const toUser = await requireSalesUser(input.tenantId, input.toUserId ?? input.fromUserId);
  const source = await stopsForDay(input.tenantId, fromUser.id, input.fromDate);
  if (!source.length) throw badRequest("There is nothing to copy on that day.");

  const { start, end } = parseDay(input.toDate);
  const existing = await prisma.beatStop.findMany({
    where: { tenantId: input.tenantId, userId: toUser.id, plannedAt: { gte: start, lte: end } },
  });
  const taken = new Set(existing.map((item) => `${item.leadId ?? ""}:${item.customerId ?? ""}`));
  let sequence = existing.length;
  for (const stop of source) {
    const key = `${stop.leadId ?? ""}:${stop.customerId ?? ""}`;
    if (taken.has(key)) continue;
    sequence += 1;
    await prisma.beatStop.create({
      data: {
        tenantId: input.tenantId,
        userId: toUser.id,
        leadId: stop.leadId,
        customerId: stop.customerId,
        sequence,
        plannedAt: movePlannedTo(input.toDate, stop.plannedAt, sequence),
      },
    });
    taken.add(key);
  }

  return listBeat({
    tenantId: input.tenantId,
    userId: toUser.id,
    roles: input.roles,
    date: input.toDate,
    forUserId: toUser.id,
  });
}
