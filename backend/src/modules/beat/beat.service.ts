import type { RoleCode } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { notifyLeadAssigned } from "../../lib/lead-push.js";
import { isManager } from "../crm/crm.helpers.js";
import { cycleDayIndex, isoDay, movePlannedTo, parseDay, plannedAtFor, publicStop } from "./beat.helpers.js";

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
  const ensured = await ensureScheduledDayStops(input.tenantId, userId, date);
  const stops = ensured.stops.length ? ensured.stops : await stopsForDay(input.tenantId, userId, date);
  return {
    date,
    userId,
    userName: user.name,
    planned: stops.length > 0,
    beatId: ensured.beat?.id ?? null,
    beatName: ensured.beat?.name ?? null,
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
      notifyLeadAssigned(user.id, { id: lead.id, name: lead.name });
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

const memberInclude = { lead: true, customer: true };

function publicBeat(row: {
  id: number;
  name: string;
  assigneeId: number;
  active: boolean;
  notes: string | null;
  assignee?: { name: string } | null;
  members?: { id: number; sequence: number; leadId: number | null; customerId: number | null; lead: { name: string; phone: string; city: string | null } | null; customer: { name: string; phone: string; city: string | null } | null }[];
  _count?: { members: number };
}) {
  return {
    id: row.id,
    name: row.name,
    assigneeId: row.assigneeId,
    assigneeName: row.assignee?.name ?? null,
    active: row.active,
    notes: row.notes,
    size: row._count?.members ?? row.members?.length ?? 0,
    members: (row.members ?? []).map((item) => {
      const place = item.lead ?? item.customer;
      return {
        id: item.id,
        sequence: item.sequence,
        leadId: item.leadId,
        customerId: item.customerId,
        name: place?.name ?? "Stop",
        phone: place?.phone ?? null,
        city: place?.city ?? null,
      };
    }),
  };
}

export async function listBeats(tenantId: number, assigneeId?: number) {
  const rows = await prisma.beat.findMany({
    where: {
      tenantId,
      ...(assigneeId ? { assigneeId } : {}),
    },
    include: {
      assignee: { select: { name: true } },
      members: { include: memberInclude, orderBy: { sequence: "asc" } },
      _count: { select: { members: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return rows.map(publicBeat);
}

export async function createBeat(input: {
  tenantId: number;
  roles: RoleCode[];
  name: string;
  assigneeId: number;
  notes?: string;
}) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can create a beat.");
  const name = input.name.trim();
  if (name.length < 2) throw badRequest("Give the beat a name.");
  const user = await requireSalesUser(input.tenantId, input.assigneeId);
  const beat = await prisma.beat.create({
    data: {
      tenantId: input.tenantId,
      name,
      assigneeId: user.id,
      notes: input.notes?.trim() || null,
    },
    include: {
      assignee: { select: { name: true } },
      members: { include: memberInclude, orderBy: { sequence: "asc" } },
      _count: { select: { members: true } },
    },
  });
  return publicBeat(beat);
}

export async function updateBeat(input: {
  tenantId: number;
  roles: RoleCode[];
  id: number;
  name?: string;
  assigneeId?: number;
  active?: boolean;
  notes?: string | null;
}) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can edit a beat.");
  const existing = await prisma.beat.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!existing) throw notFound("Beat not found.");
  if (input.assigneeId) await requireSalesUser(input.tenantId, input.assigneeId);
  const beat = await prisma.beat.update({
    where: { id: existing.id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.assigneeId != null ? { assigneeId: input.assigneeId } : {}),
      ...(input.active != null ? { active: input.active } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: {
      assignee: { select: { name: true } },
      members: { include: memberInclude, orderBy: { sequence: "asc" } },
      _count: { select: { members: true } },
    },
  });
  return publicBeat(beat);
}

export async function addBeatMember(input: {
  tenantId: number;
  roles: RoleCode[];
  beatId: number;
  leadId?: number;
  customerId?: number;
}) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can edit a beat.");
  if (!input.leadId && !input.customerId) throw badRequest("Pick a lead or a customer.");
  if (input.leadId && input.customerId) throw badRequest("One stop is one lead or one customer.");
  const beat = await prisma.beat.findFirst({ where: { id: input.beatId, tenantId: input.tenantId } });
  if (!beat) throw notFound("Beat not found.");

  const dup = await prisma.beatMember.findFirst({
    where: {
      beatId: beat.id,
      ...(input.leadId ? { leadId: input.leadId } : { customerId: input.customerId }),
    },
  });
  if (dup) throw badRequest("That stop is already on this beat.");

  if (input.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: input.leadId, tenantId: input.tenantId } });
    if (!lead) throw notFound("Lead not found.");
    if (lead.approvalStatus !== "APPROVED") throw badRequest("Approve this lead before adding it to the beat.");
    if (lead.status === "LOST") throw badRequest("Do not put a lost lead on the beat.");
    if (!lead.assigneeId || lead.assigneeId !== beat.assigneeId) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { assigneeId: beat.assigneeId, status: lead.status === "NEW" ? "ASSIGNED" : lead.status },
      });
      notifyLeadAssigned(beat.assigneeId, { id: lead.id, name: lead.name });
    }
  }
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: input.tenantId } });
    if (!customer) throw notFound("Customer not found.");
  }

  const last = await prisma.beatMember.findFirst({ where: { beatId: beat.id }, orderBy: { sequence: "desc" } });
  const sequence = (last?.sequence ?? 0) + 1;
  await prisma.beatMember.create({
    data: {
      beatId: beat.id,
      leadId: input.leadId ?? null,
      customerId: input.customerId ?? null,
      sequence,
    },
  });
  const fresh = await prisma.beat.findFirst({
    where: { id: beat.id },
    include: {
      assignee: { select: { name: true } },
      members: { include: memberInclude, orderBy: { sequence: "asc" } },
      _count: { select: { members: true } },
    },
  });
  return publicBeat(fresh!);
}

export async function removeBeatMember(tenantId: number, roles: RoleCode[], memberId: number) {
  if (!isManager(roles)) throw forbidden("Only a manager can edit a beat.");
  const member = await prisma.beatMember.findFirst({
    where: { id: memberId, beat: { tenantId } },
  });
  if (!member) throw notFound("Stop not found on this beat.");
  await prisma.beatMember.delete({ where: { id: member.id } });
  const rest = await prisma.beatMember.findMany({ where: { beatId: member.beatId }, orderBy: { sequence: "asc" } });
  await Promise.all(rest.map((item, index) => prisma.beatMember.update({ where: { id: item.id }, data: { sequence: index + 1 } })));
  return { ok: true };
}

export async function reorderBeatMembers(input: {
  tenantId: number;
  roles: RoleCode[];
  beatId: number;
  memberIds: number[];
}) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can edit a beat.");
  const beat = await prisma.beat.findFirst({ where: { id: input.beatId, tenantId: input.tenantId } });
  if (!beat) throw notFound("Beat not found.");
  const current = await prisma.beatMember.findMany({ where: { beatId: beat.id } });
  if (current.length !== input.memberIds.length || current.some((item) => !input.memberIds.includes(item.id))) {
    throw badRequest("Send every stop on this beat, in the new order.");
  }
  await Promise.all(
    input.memberIds.map((id, index) => prisma.beatMember.update({ where: { id }, data: { sequence: index + 1 } })),
  );
  const fresh = await prisma.beat.findFirst({
    where: { id: beat.id },
    include: {
      assignee: { select: { name: true } },
      members: { include: memberInclude, orderBy: { sequence: "asc" } },
      _count: { select: { members: true } },
    },
  });
  return publicBeat(fresh!);
}

export async function getSchedule(tenantId: number, userId: number, forDate = isoDay()) {
  await requireSalesUser(tenantId, userId);
  let plan = await prisma.beatPlan.findFirst({ where: { tenantId, userId } });
  if (!plan) {
    plan = await prisma.beatPlan.create({
      data: {
        tenantId,
        userId,
        cycleLength: 7,
        startDate: parseDay(forDate).start,
      },
    });
  }
  const startIso = isoDay(plan.startDate);
  const rows = await prisma.beatSchedule.findMany({
    where: { tenantId, userId },
    include: { beat: { select: { id: true, name: true, active: true } } },
  });
  const days: Record<number, { beatId: number; beatName: string } | null> = {};
  for (let d = 0; d < plan.cycleLength; d++) days[d] = null;
  for (const row of rows) {
    if (row.dayIndex >= 0 && row.dayIndex < plan.cycleLength) {
      days[row.dayIndex] = { beatId: row.beatId, beatName: row.beat.name };
    }
  }
  const todayIndex = cycleDayIndex(startIso, plan.cycleLength, forDate);
  return {
    userId,
    cycleLength: plan.cycleLength,
    startDate: startIso,
    todayIndex,
    todayDate: forDate,
    /** dayIndex → beat (legacy alias `week` kept for older clients) */
    days,
    week: days,
  };
}

export async function putSchedule(input: {
  tenantId: number;
  roles: RoleCode[];
  userId: number;
  cycleLength?: number;
  startDate?: string;
  /** dayIndex → beatId or null to clear */
  days?: Record<string, number | null>;
  /** @deprecated use days */
  week?: Record<string, number | null>;
}) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can set the schedule.");
  const user = await requireSalesUser(input.tenantId, input.userId);
  const cycleLength = input.cycleLength ?? 7;
  if (!Number.isInteger(cycleLength) || cycleLength < 1 || cycleLength > 90) {
    throw badRequest("Cycle length must be between 1 and 90 days.");
  }
  const startDate = input.startDate ? parseDay(input.startDate).start : parseDay().start;

  await prisma.beatPlan.upsert({
    where: { tenantId_userId: { tenantId: input.tenantId, userId: user.id } },
    create: {
      tenantId: input.tenantId,
      userId: user.id,
      cycleLength,
      startDate,
    },
    update: { cycleLength, startDate },
  });

  // Drop slots past the new cycle length
  await prisma.beatSchedule.deleteMany({
    where: { tenantId: input.tenantId, userId: user.id, dayIndex: { gte: cycleLength } },
  });

  const map = input.days ?? input.week ?? {};
  for (const [dayRaw, beatId] of Object.entries(map)) {
    const dayIndex = Number(dayRaw);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= cycleLength) continue;
    if (beatId == null) {
      await prisma.beatSchedule.deleteMany({
        where: { tenantId: input.tenantId, userId: user.id, dayIndex },
      });
      continue;
    }
    const beat = await prisma.beat.findFirst({
      where: { id: beatId, tenantId: input.tenantId, assigneeId: user.id, active: true },
    });
    if (!beat) throw badRequest(`Beat ${beatId} is not assigned to this salesperson.`);
    await prisma.beatSchedule.upsert({
      where: { tenantId_userId_dayIndex: { tenantId: input.tenantId, userId: user.id, dayIndex } },
      create: { tenantId: input.tenantId, userId: user.id, dayIndex, beatId: beat.id },
      update: { beatId: beat.id },
    });
  }
  return getSchedule(input.tenantId, user.id);
}

/** Materialize today's BeatStop rows from the scheduled permanent beat. */
export async function ensureScheduledDayStops(tenantId: number, userId: number, date = isoDay()) {
  const plan = await prisma.beatPlan.findFirst({ where: { tenantId, userId } });
  if (!plan) {
    return { beat: null as null, stops: [] as Awaited<ReturnType<typeof stopsForDay>>, planned: false };
  }
  const dayIndex = cycleDayIndex(isoDay(plan.startDate), plan.cycleLength, date);
  if (dayIndex == null) {
    return { beat: null as null, stops: [] as Awaited<ReturnType<typeof stopsForDay>>, planned: false };
  }
  const slot = await prisma.beatSchedule.findFirst({
    where: { tenantId, userId, dayIndex },
    include: {
      beat: {
        include: { members: { include: memberInclude, orderBy: { sequence: "asc" } } },
      },
    },
  });
  if (!slot?.beat?.active) {
    return { beat: null as null, stops: [] as Awaited<ReturnType<typeof stopsForDay>>, planned: false };
  }

  const existing = await stopsForDay(tenantId, userId, date);
  const fromThisBeat = existing.filter((s) => s.beatId === slot.beatId);

  if (!fromThisBeat.length) {
    // Prefer schedule over leftover ad-hoc day stops with no visits.
    const orphanIds = existing.filter((s) => s.beatId == null).map((s) => s.id);
    if (orphanIds.length) {
      const used = await prisma.visit.count({ where: { beatStopId: { in: orphanIds } } });
      if (used === 0) {
        await prisma.beatStop.deleteMany({ where: { id: { in: orphanIds } } });
      }
    }
    let sequence = 0;
    for (const member of slot.beat.members) {
      sequence += 1;
      await prisma.beatStop.create({
        data: {
          tenantId,
          userId,
          beatId: slot.beat.id,
          leadId: member.leadId,
          customerId: member.customerId,
          sequence,
          plannedAt: plannedAtFor(date, sequence),
        },
      });
    }
  }

  const stops = await stopsForDay(tenantId, userId, date);
  return {
    beat: { id: slot.beat.id, name: slot.beat.name, size: slot.beat.members.length },
    stops,
    planned: stops.length > 0,
  };
}

export async function teamCoverageToday(tenantId: number) {
  const date = isoDay();
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
  const { start, end } = parseDay(date);
  const rows = [];
  for (const person of people) {
    const ensured = await ensureScheduledDayStops(tenantId, person.id, date);
    const done = await prisma.visit.count({
      where: {
        tenantId,
        userId: person.id,
        status: "COMPLETED",
        checkedInAt: { gte: start, lte: end },
      },
    });
    rows.push({
      userId: person.id,
      name: person.name,
      beatId: ensured.beat?.id ?? null,
      beatName: ensured.beat?.name ?? null,
      stops: ensured.stops.length,
      completed: done,
    });
  }
  return { date, people: rows };
}
