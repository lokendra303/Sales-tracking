import type { RoleCode } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { isManager } from "../crm/crm.helpers.js";
import { asNumber, dayBounds } from "../visits/visits.helpers.js";

function monthBounds(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { year, month, start, end };
}

function money(value: unknown) {
  return asNumber(value) ?? 0;
}

function percent(part: number, whole: number) {
  if (!whole) return 0;
  return Math.min(999, Math.round((part / whole) * 100));
}

function assertReporter(roles: RoleCode[]) {
  if (!isManager(roles) && !roles.includes("SALES_EXECUTIVE")) {
    throw forbidden("Reports are for managers and the field team.");
  }
}

function personScope(tenantId: number, userId: number, roles: RoleCode[], requested?: number) {
  if (isManager(roles)) {
    return requested ? { tenantId, userId: requested } : { tenantId };
  }
  if (requested && requested !== userId) throw forbidden("You can only see your own numbers.");
  return { tenantId, userId };
}

async function listFieldUsers(tenantId: number, userId: number, roles: RoleCode[], requested?: number) {
  if (!isManager(roles)) {
    const me = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true, name: true } });
    return me ? [me] : [];
  }
  return prisma.user.findMany({
    where: {
      tenantId,
      ...(requested ? { id: requested } : {}),
      roles: { some: { role: { code: "SALES_EXECUTIVE" } } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

async function missedForUser(tenantId: number, userId: number, start: Date, end: Date) {
  const [stops, visits] = await Promise.all([
    prisma.beatStop.findMany({
      where: { tenantId, userId, OR: [{ plannedAt: { gte: start, lte: end } }, { plannedAt: null }] },
      include: { lead: { select: { name: true, phone: true } }, customer: { select: { name: true, phone: true } } },
      orderBy: { sequence: "asc" },
    }),
    prisma.visit.findMany({
      where: { tenantId, userId, status: "COMPLETED", checkedInAt: { gte: start, lte: end } },
      select: { leadId: true, customerId: true },
    }),
  ]);

  let items = stops;
  if (!items.length) {
    const leads = await prisma.lead.findMany({
      where: { tenantId, assigneeId: userId, status: { notIn: ["WON", "LOST"] }, approvalStatus: "APPROVED" },
      select: { id: true, name: true, phone: true },
      take: 20,
    });
    items = leads.map((lead, index) => ({
      id: 0,
      sequence: index + 1,
      leadId: lead.id,
      customerId: null,
      lead,
      customer: null,
    })) as typeof stops;
  }

  return items
    .filter(
      (stop) =>
        !visits.some(
          (visit) =>
            (stop.leadId && visit.leadId === stop.leadId) ||
            (stop.customerId && visit.customerId === stop.customerId),
        ),
    )
    .map((stop) => ({
      name: stop.lead?.name ?? stop.customer?.name ?? "Stop",
      phone: stop.lead?.phone ?? stop.customer?.phone ?? null,
    }));
}

export async function listTargets(tenantId: number, userId: number, roles: RoleCode[], year: number, month: number) {
  assertReporter(roles);
  const people = await listFieldUsers(tenantId, userId, roles);
  const rows = await prisma.monthlyTarget.findMany({
    where: { tenantId, year, month, userId: { in: people.map((person) => person.id) } },
  });
  return people.map((person) => ({
    userId: person.id,
    name: person.name,
    year,
    month,
    amount: money(rows.find((row) => row.userId === person.id)?.amount),
  }));
}

export async function setTarget(input: {
  tenantId: number;
  roles: RoleCode[];
  userId: number;
  year: number;
  month: number;
  amount: number;
}) {
  if (!isManager(input.roles)) throw forbidden("Only managers set monthly targets.");
  if (input.month < 1 || input.month > 12) throw badRequest("Month must be 1–12.");
  if (!(input.amount >= 0)) throw badRequest("Enter a target amount.");
  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId, roles: { some: { role: { code: "SALES_EXECUTIVE" } } } },
  });
  if (!user) throw notFound("Sales executive not found.");
  const row = await prisma.monthlyTarget.upsert({
    where: {
      tenantId_userId_year_month: {
        tenantId: input.tenantId,
        userId: input.userId,
        year: input.year,
        month: input.month,
      },
    },
    update: { amount: input.amount },
    create: {
      tenantId: input.tenantId,
      userId: input.userId,
      year: input.year,
      month: input.month,
      amount: input.amount,
    },
  });
  return { userId: user.id, name: user.name, year: row.year, month: row.month, amount: money(row.amount) };
}

export async function personSummary(tenantId: number, actorId: number, roles: RoleCode[], requested?: number) {
  assertReporter(roles);
  const scope = personScope(tenantId, actorId, roles, requested);
  const day = dayBounds();
  const month = monthBounds();
  const people = await listFieldUsers(tenantId, actorId, roles, requested);
  const userIds = people.map((person) => person.id);
  const saleWhere = userIds.length === 1 ? { tenantId, userId: userIds[0] } : { tenantId, userId: { in: userIds } };
  const visitWhere = saleWhere;

  const [todaySale, monthSale, todayVisits, successVisits, unavailableVisits, overdue, targets] = await Promise.all([
    prisma.sale.aggregate({ where: { ...saleWhere, createdAt: { gte: day.start, lte: day.end } }, _sum: { amount: true }, _count: true }),
    prisma.sale.aggregate({ where: { ...saleWhere, createdAt: { gte: month.start, lte: month.end } }, _sum: { amount: true }, _count: true }),
    prisma.visit.count({ where: { ...visitWhere, checkedInAt: { gte: day.start, lte: day.end } } }),
    prisma.visit.count({ where: { ...visitWhere, checkedInAt: { gte: day.start, lte: day.end }, outcome: "SUCCESS" } }),
    prisma.visit.count({ where: { ...visitWhere, checkedInAt: { gte: day.start, lte: day.end }, outcome: "UNAVAILABLE" } }),
    prisma.followUp.count({
      where: { tenantId, doneAt: null, dueAt: { lt: new Date() }, ...(scope.userId ? { userId: scope.userId } : {}) },
    }),
    prisma.monthlyTarget.aggregate({
      where: { tenantId, year: month.year, month: month.month, userId: { in: userIds } },
      _sum: { amount: true },
    }),
  ]);

  const missed = (
    await Promise.all(people.map((person) => missedForUser(tenantId, person.id, day.start, day.end)))
  ).flat();

  const monthTarget = money(targets._sum.amount);
  const monthSalesAmount = money(monthSale._sum.amount);
  return {
    year: month.year,
    month: month.month,
    todayVisits,
    successVisits,
    unavailableVisits,
    missedStops: missed.length,
    missed,
    overdueFollowUps: overdue,
    todaySalesCount: todaySale._count,
    todaySalesAmount: money(todaySale._sum.amount),
    monthSalesCount: monthSale._count,
    monthSalesAmount,
    monthTarget,
    targetPercent: percent(monthSalesAmount, monthTarget),
  };
}

export async function daySummary(tenantId: number, userId: number, roles: RoleCode[]) {
  const data = await personSummary(tenantId, userId, roles, isManager(roles) ? undefined : userId);
  return {
    title: "Day summary",
    visits: data.todayVisits,
    successVisits: data.successVisits,
    unavailableVisits: data.unavailableVisits,
    salesCount: data.todaySalesCount,
    salesAmount: data.todaySalesAmount,
    missedStops: data.missedStops,
    missed: data.missed,
    overdueFollowUps: data.overdueFollowUps,
    monthTarget: data.monthTarget,
    monthSalesAmount: data.monthSalesAmount,
    targetPercent: data.targetPercent,
  };
}

export async function funnel(tenantId: number, userId: number, roles: RoleCode[], days = 30) {
  assertReporter(roles);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Math.max(1, days));
  start.setHours(0, 0, 0, 0);
  const people = await listFieldUsers(tenantId, userId, roles);
  const userIds = people.map((person) => person.id);
  const leadWhere = isManager(roles) ? { tenantId } : { tenantId, assigneeId: userId };

  const [leads, visits, sales] = await Promise.all([
    prisma.lead.findMany({
      where: { ...leadWhere, createdAt: { gte: start, lte: end }, approvalStatus: "APPROVED" },
      select: { id: true },
    }),
    prisma.visit.findMany({
      where: {
        tenantId,
        checkedInAt: { gte: start, lte: end },
        userId: isManager(roles) ? { in: userIds } : userId,
      },
      select: { leadId: true, customerId: true },
    }),
    prisma.sale.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
        userId: isManager(roles) ? { in: userIds } : userId,
      },
      select: { leadId: true, customerId: true, amount: true },
    }),
  ]);

  const visited = new Set(visits.map((row) => row.leadId ?? `c:${row.customerId}`).filter(Boolean));
  const sold = new Set(sales.map((row) => row.leadId ?? `c:${row.customerId}`).filter(Boolean));
  const leadCount = leads.length;
  const visitCount = visited.size;
  const saleCount = sold.size;
  return {
    days,
    leads: leadCount,
    visited: visitCount,
    sold: saleCount,
    leadToVisitPercent: percent(visitCount, leadCount),
    visitToSalePercent: percent(saleCount, visitCount || visits.length),
    salesAmount: sales.reduce((sum, row) => sum + money(row.amount), 0),
  };
}

export async function teamReport(tenantId: number, roles: RoleCode[]) {
  if (!isManager(roles)) throw forbidden("Only managers see the team report.");
  const month = monthBounds();
  const day = dayBounds();
  const people = await listFieldUsers(tenantId, 0, roles);
  const rows = await Promise.all(
    people.map(async (person) => {
      const [todaySale, monthSale, visits, overdue, target, missed] = await Promise.all([
        prisma.sale.aggregate({
          where: { tenantId, userId: person.id, createdAt: { gte: day.start, lte: day.end } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.sale.aggregate({
          where: { tenantId, userId: person.id, createdAt: { gte: month.start, lte: month.end } },
          _sum: { amount: true },
        }),
        prisma.visit.count({ where: { tenantId, userId: person.id, checkedInAt: { gte: day.start, lte: day.end } } }),
        prisma.followUp.count({ where: { tenantId, userId: person.id, doneAt: null, dueAt: { lt: new Date() } } }),
        prisma.monthlyTarget.findUnique({
          where: {
            tenantId_userId_year_month: { tenantId, userId: person.id, year: month.year, month: month.month },
          },
        }),
        missedForUser(tenantId, person.id, day.start, day.end),
      ]);
      const monthSalesAmount = money(monthSale._sum.amount);
      const monthTarget = money(target?.amount);
      return {
        userId: person.id,
        name: person.name,
        todayVisits: visits,
        todaySalesAmount: money(todaySale._sum.amount),
        monthSalesAmount,
        monthTarget,
        targetPercent: percent(monthSalesAmount, monthTarget),
        missedStops: missed.length,
        overdueFollowUps: overdue,
      };
    }),
  );
  return { year: month.year, month: month.month, people: rows };
}

export async function exportWorkbook(tenantId: number, userId: number, roles: RoleCode[]) {
  const [summary, funnelData, team, day] = await Promise.all([
    personSummary(tenantId, userId, roles),
    funnel(tenantId, userId, roles, 30),
    isManager(roles) ? teamReport(tenantId, roles) : null,
    daySummary(tenantId, userId, roles),
  ]);

  const dayRange = dayBounds();
  const visitScope = isManager(roles) ? { tenantId } : { tenantId, userId };
  const visits = await prisma.visit.findMany({
    where: { ...visitScope, checkedInAt: { gte: dayRange.start, lte: dayRange.end } },
    include: {
      user: { select: { name: true } },
      lead: { select: { name: true } },
      customer: { select: { name: true } },
    },
    orderBy: { checkedInAt: "desc" },
  });
  const sales = await prisma.sale.findMany({
    where: { ...visitScope, createdAt: { gte: dayRange.start, lte: dayRange.end } },
    include: {
      user: { select: { name: true } },
      lead: { select: { name: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([
      { metric: "Visits today", value: summary.todayVisits },
      { metric: "Successful visits", value: summary.successVisits },
      { metric: "Customer not there", value: summary.unavailableVisits },
      { metric: "Missed stops", value: summary.missedStops },
      { metric: "Sales today (₹)", value: summary.todaySalesAmount },
      { metric: "Overdue follow-ups", value: summary.overdueFollowUps },
      { metric: "Month sales (₹)", value: summary.monthSalesAmount },
      { metric: "Month target (₹)", value: summary.monthTarget },
      { metric: "Target %", value: summary.targetPercent },
    ]),
    "Summary",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([
      { step: "Leads", count: funnelData.leads },
      { step: "Visited", count: funnelData.visited },
      { step: "Sold", count: funnelData.sold },
      { step: "Lead to visit %", count: funnelData.leadToVisitPercent },
      { step: "Visit to sale %", count: funnelData.visitToSalePercent },
    ]),
    "Funnel",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      visits.map((visit) => ({
        shop: visit.lead?.name ?? visit.customer?.name ?? "Visit",
        person: visit.user.name,
        outcome: visit.outcome ?? visit.status,
        time: visit.checkedInAt.toISOString(),
        sale: money(visit.saleAmount),
      })),
    ),
    "Visits",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      sales.map((sale) => ({
        shop: sale.lead?.name ?? sale.customer?.name ?? "Sale",
        person: sale.user.name,
        amount: money(sale.amount),
        note: sale.note ?? "",
        time: sale.createdAt.toISOString(),
      })),
    ),
    "Sales",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(day.missed.length ? day.missed : [{ name: "None", phone: "" }]),
    "Missed",
  );
  if (team) {
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(
        team.people.map((person) => ({
          name: person.name,
          visits: person.todayVisits,
          todaySales: person.todaySalesAmount,
          monthSales: person.monthSalesAmount,
          target: person.monthTarget,
          percent: person.targetPercent,
          missed: person.missedStops,
          overdue: person.overdueFollowUps,
        })),
      ),
      "Team",
    );
  }

  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
