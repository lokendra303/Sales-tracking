import { randomUUID } from "node:crypto";
import path from "node:path";
import type { RoleCode } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { isManager } from "../crm/crm.helpers.js";
import { asNumber } from "../visits/visits.helpers.js";

function saleScope(tenantId: number, userId: number, roles: RoleCode[]) {
  if (isManager(roles)) return { tenantId };
  return { tenantId, userId };
}

export function publicSale(row: {
  id: number;
  amount: unknown;
  collectionAmount: unknown;
  note: string | null;
  billPhotoPath: string | null;
  clientRequestId: string;
  createdAt: Date;
  visitId: number | null;
  leadId: number | null;
  customerId: number | null;
  user?: { id: number; name: string } | null;
  lead?: { id: number; name: string; phone: string } | null;
  customer?: { id: number; name: string; phone: string } | null;
}) {
  const place = row.lead ?? row.customer;
  return {
    id: row.id,
    amount: asNumber(row.amount),
    collectionAmount: asNumber(row.collectionAmount),
    note: row.note,
    hasBillPhoto: Boolean(row.billPhotoPath),
    clientRequestId: row.clientRequestId,
    createdAt: row.createdAt,
    visitId: row.visitId,
    leadId: row.leadId,
    customerId: row.customerId,
    userName: row.user?.name ?? null,
    name: place?.name ?? row.user?.name ?? "Sale",
    phone: place?.phone ?? null,
  };
}

export async function listSales(tenantId: number, userId: number, roles: RoleCode[], days = 30, forUserId?: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Math.max(1, days));
  start.setHours(0, 0, 0, 0);
  const scope = isManager(roles) && forUserId ? { tenantId, userId: forUserId } : saleScope(tenantId, userId, roles);
  const rows = await prisma.sale.findMany({
    where: {
      ...scope,
      createdAt: { gte: start, lte: end },
    },
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, phone: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(publicSale);
}

export async function getSale(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const row = await prisma.sale.findFirst({
    where: { id, ...saleScope(tenantId, userId, roles) },
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, phone: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!row) throw notFound("Sale not found.");
  return publicSale(row);
}

export async function createSale(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  amount: number;
  collectionAmount?: number;
  note?: string;
  visitId?: number;
  leadId?: number;
  customerId?: number;
  clientRequestId?: string;
}) {
  if (isManager(input.roles)) {
    throw forbidden("Managers review sales. They do not record field sales.");
  }
  if (!(input.amount > 0)) {
    throw badRequest("Enter the sale amount.");
  }
  if (input.collectionAmount != null && input.collectionAmount < 0) {
    throw badRequest("Collection cannot be negative.");
  }

  const visit = input.visitId
    ? await prisma.visit.findFirst({
        where: { id: input.visitId, tenantId: input.tenantId, userId: input.userId },
      })
    : null;
  if (input.visitId && !visit) throw notFound("Visit not found.");
  if (visit && (visit.status !== "COMPLETED" || visit.outcome !== "SUCCESS")) {
    throw badRequest("Record a sale only after a successful visit.");
  }

  const clientRequestId = input.clientRequestId?.trim() || (visit ? `visit:${visit.id}` : randomUUID());
  const existing = await prisma.sale.findUnique({
    where: { tenantId_clientRequestId: { tenantId: input.tenantId, clientRequestId } },
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, phone: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  if (existing) return publicSale(existing);

  if (visit) {
    const already = await prisma.sale.findFirst({
      where: { tenantId: input.tenantId, visitId: visit.id },
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, phone: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    if (already) return publicSale(already);
  }

  const leadId = input.leadId ?? visit?.leadId ?? null;
  const customerId = input.customerId ?? visit?.customerId ?? null;
  if (!leadId && !customerId) {
    throw badRequest("Record this sale against a visit, lead, or customer.");
  }

  const row = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        visitId: visit?.id ?? null,
        leadId,
        customerId,
        amount: input.amount,
        collectionAmount: input.collectionAmount,
        note: input.note,
        clientRequestId,
      },
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, phone: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    if (visit) {
      await tx.visit.update({
        where: { id: visit.id },
        data: {
          saleAmount: input.amount,
          collectionAmount: input.collectionAmount ?? visit.collectionAmount,
        },
      });
    }

    if (leadId) {
      const lead = await tx.lead.findFirst({ where: { id: leadId, tenantId: input.tenantId } });
      if (lead && lead.approvalStatus !== "APPROVED") {
        throw badRequest(
          lead.approvalStatus === "REJECTED"
            ? "The manager rejected this lead."
            : "This lead is waiting for manager approval.",
        );
      }
      if (lead && lead.status !== "LOST") {
        await tx.lead.update({ where: { id: lead.id }, data: { status: "WON" } });
      }
    }

    return sale;
  });

  return publicSale(row);
}

export async function saveBillPhoto(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  saleId: number;
  billPhotoPath: string;
}) {
  const sale = await prisma.sale.findFirst({
    where: { id: input.saleId, ...saleScope(input.tenantId, input.userId, input.roles) },
  });
  if (!sale) throw notFound("Sale not found.");
  if (sale.userId !== input.userId && !isManager(input.roles)) throw forbidden();

  const updated = await prisma.sale.update({
    where: { id: sale.id },
    data: { billPhotoPath: input.billPhotoPath },
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, phone: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  return publicSale(updated);
}

export async function getBillPath(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const sale = await prisma.sale.findFirst({
    where: { id, ...saleScope(tenantId, userId, roles) },
  });
  if (!sale?.billPhotoPath) throw notFound("Bill photo not found.");
  return path.resolve(sale.billPhotoPath);
}
