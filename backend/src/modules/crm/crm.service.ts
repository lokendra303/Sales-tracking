import { FollowUpType, LeadStatus, Prisma, Temperature } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { geocodeAddress, looksLikeMapsLink, parseCoord } from "../../lib/geocode.js";
import { notifyLeadAssigned, notifyLeadDecision } from "../../lib/lead-push.js";
import { parseMobile } from "../../lib/phone.js";
import { customerScope, isAdmin, isManager, leadScope, publicLead } from "./crm.helpers.js";
import type { RoleCode } from "@prisma/client";

const leadInclude = {
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  followUps: { orderBy: { dueAt: "asc" as const } },
  visits: {
    orderBy: { checkedInAt: "desc" as const },
    take: 1,
    select: { id: true, status: true, outcome: true, checkedInAt: true },
  },
  beatMembers: {
    include: {
      beat: { select: { id: true, name: true, territory: true, active: true } },
    },
    orderBy: { sequence: "asc" as const },
  },
};

/** Keep a pasted Maps URL in mapsLink, and the street text in address. */
function splitPlace(address?: string | null, mapsLink?: string | null) {
  let street = address?.trim() ?? "";
  let link = mapsLink?.trim() ?? "";
  if (street && looksLikeMapsLink(street)) {
    if (!link) link = street;
    street = "";
  }
  return {
    address: street || null,
    mapsLink: link || null,
  };
}

function requireApproved(lead: { approvalStatus: string }) {
  if (lead.approvalStatus === "PENDING") {
    throw badRequest("This lead is waiting for manager approval.");
  }
  if (lead.approvalStatus === "REJECTED") {
    throw badRequest("The manager rejected this lead.");
  }
}

export async function listLeads(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  q?: string;
  filter?: string;
  assigneeId?: number | "unassigned";
}) {
  const managerFilter =
    isManager(input.roles) && input.assigneeId === "unassigned"
      ? { assigneeId: null }
      : isManager(input.roles) && typeof input.assigneeId === "number"
        ? { assigneeId: input.assigneeId }
        : {};
  const where: Prisma.LeadWhereInput = {
    AND: [
      leadScope(input.tenantId, input.userId, input.roles),
      managerFilter,
      input.q
        ? {
            OR: [
              { name: { contains: input.q } },
              { phone: { contains: input.q } },
              { contactPerson: { contains: input.q } },
            ],
          }
        : {},
      input.filter === "pending"
        ? { approvalStatus: "PENDING" }
        : input.filter === "new"
          ? { status: { in: ["NEW", "ASSIGNED"] }, approvalStatus: "APPROVED" }
          : input.filter === "follow-up"
            ? { status: { in: ["CONTACTED", "FOLLOW_UP"] }, approvalStatus: "APPROVED" }
            : input.filter === "interested"
              ? { status: { in: ["INTERESTED", "NEGOTIATION"] }, approvalStatus: "APPROVED" }
              : input.filter === "won"
                ? { status: "WON" }
                : input.q
                  ? {}
                  : { status: { not: "LOST" }, approvalStatus: { not: "REJECTED" } },
    ],
  };

  const leads = await prisma.lead.findMany({
    where,
    include: leadInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  let customers: Awaited<ReturnType<typeof listCustomers>> = [];
  if ((!input.filter || input.filter === "all" || input.filter === "won") && input.assigneeId !== "unassigned") {
    customers = await listCustomers({
      tenantId: input.tenantId,
      userId: input.userId,
      roles: input.roles,
      q: input.q,
      ownerId: typeof input.assigneeId === "number" ? input.assigneeId : undefined,
    });
  }

  return {
    leads: leads.map(publicLead),
    customers,
  };
}

export async function getLead(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const lead = await prisma.lead.findFirst({
    where: { id, ...leadScope(tenantId, userId, roles) },
    include: {
      ...leadInclude,
      customer: true,
    },
  });
  if (!lead) {
    throw notFound("Lead not found.");
  }
  return {
    ...publicLead(lead),
    followUps: lead.followUps.map((item) => ({
      id: item.id,
      type: item.type,
      dueAt: item.dueAt,
      doneAt: item.doneAt,
      notes: item.notes,
      overdue: !item.doneAt && item.dueAt < new Date(),
    })),
    customer: lead.customer
      ? {
          id: lead.customer.id,
          name: lead.customer.name,
          phone: lead.customer.phone,
        }
      : null,
  };
}

export async function createLead(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  name: string;
  phone: string;
  contactPerson?: string;
  businessType?: string;
  productInterest?: string;
  address?: string;
  mapsLink?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  potential?: number;
  temperature?: Temperature;
  assigneeId?: number;
  createAnyway?: boolean;
  clientRequestId?: string;
}) {
  const clientRequestId = input.clientRequestId?.trim() || undefined;
  if (clientRequestId) {
    const replay = await prisma.lead.findFirst({
      where: { tenantId: input.tenantId, clientRequestId },
      include: leadInclude,
    });
    if (replay) return publicLead(replay);
  }

  const phone = parseMobile(input.phone);
  if (!phone) throw badRequest("Enter a 10-digit mobile number.");

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: input.tenantId } });
  const existingLead = await prisma.lead.findFirst({
    where: { tenantId: input.tenantId, phone },
    include: { assignee: { select: { id: true, name: true } } },
  });
  const existingCustomer = await prisma.customer.findFirst({
    where: { tenantId: input.tenantId, phone },
  });

  if ((existingLead || existingCustomer) && !input.createAnyway) {
    throw conflict("A record with this phone number already exists.", {
      lead: existingLead
        ? { id: existingLead.id, name: existingLead.name, assigneeName: existingLead.assignee?.name ?? null }
        : null,
      customer: existingCustomer
        ? { id: existingCustomer.id, name: existingCustomer.name }
        : null,
    });
  }

  if ((existingLead || existingCustomer) && input.createAnyway && !settings?.allowDuplicateLeads) {
    throw badRequest("Admin does not allow duplicate leads.");
  }

  const manager = isManager(input.roles);
  if (manager && input.assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: input.assigneeId,
        tenantId: input.tenantId,
        status: "ACTIVE",
        roles: { some: { role: { code: "SALES_EXECUTIVE" } } },
      },
    });
    if (!assignee) {
      throw badRequest("Salesperson not found.");
    }
  }
  const assigneeId = manager ? input.assigneeId ?? null : input.userId;
  const status: LeadStatus = assigneeId ? "ASSIGNED" : "NEW";
  const approvalStatus = "APPROVED";
  const place = splitPlace(input.address, input.mapsLink);
  let latitude = parseCoord(input.latitude, -90, 90);
  let longitude = parseCoord(input.longitude, -180, 180);
  if ((latitude == null || longitude == null) && place.mapsLink) {
    const found = await geocodeAddress(place.mapsLink);
    latitude = found?.lat ?? latitude;
    longitude = found?.lng ?? longitude;
  }
  if ((latitude == null || longitude == null) && (place.address || input.city)) {
    const found = await geocodeAddress([place.address, input.city].filter(Boolean).join(", "));
    latitude = found?.lat;
    longitude = found?.lng;
  }

  const lead = await prisma.lead.create({
    data: {
      tenantId: input.tenantId,
      name: input.name.trim(),
      phone,
      contactPerson: input.contactPerson,
      businessType: input.businessType,
      productInterest: input.productInterest?.trim() || null,
      address: place.address,
      mapsLink: place.mapsLink,
      city: input.city,
      latitude,
      longitude,
      notes: input.notes,
      potential: input.potential,
      temperature: input.temperature ?? "WARM",
      source: manager ? "MANAGER" : "MANUAL",
      status,
      approvalStatus,
      assigneeId,
      createdById: input.userId,
      clientRequestId,
    },
    include: leadInclude,
  });

  if (assigneeId && assigneeId !== input.userId) {
    notifyLeadAssigned(assigneeId, { id: lead.id, name: lead.name });
  }

  return publicLead(lead);
}

function cell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const match = Object.keys(row).find((item) => item.trim().toLowerCase().replace(/[\s_]+/g, "") === key);
    if (!match) continue;
    const value = row[match];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

export async function importLeads(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  rows: Record<string, unknown>[];
}) {
  if (!isManager(input.roles)) {
    throw forbidden("Only managers import leads.");
  }

  const people = await prisma.user.findMany({
    where: { tenantId: input.tenantId, roles: { some: { role: { code: "SALES_EXECUTIVE" } } } },
    select: { id: true, phone: true, name: true },
  });

  const created: ReturnType<typeof publicLead>[] = [];
  const skipped: { row: number; name: string; phone: string; reason: string }[] = [];

  for (const [index, raw] of input.rows.entries()) {
    const name = cell(raw, ["name", "shop", "shopname", "business", "businessname"]);
    const rawPhone = cell(raw, ["phone", "mobile", "mobilenumber", "contact"]);
    const phone = parseMobile(rawPhone);
    if (!name || !phone) {
      skipped.push({
        row: index + 2,
        name,
        phone: rawPhone,
        reason: "Enter a 10-digit mobile number.",
      });
      continue;
    }

    const existingLead = await prisma.lead.findFirst({ where: { tenantId: input.tenantId, phone } });
    const existingCustomer = await prisma.customer.findFirst({ where: { tenantId: input.tenantId, phone } });
    if (existingLead || existingCustomer) {
      skipped.push({ row: index + 2, name, phone, reason: "Phone already exists." });
      continue;
    }

    const assigneeHint = cell(raw, ["assignee", "assigneephone", "executive", "salesperson", "owner"]);
    const assignee = people.find(
      (person) =>
        person.phone === parseMobile(assigneeHint) ||
        person.name.toLowerCase() === assigneeHint.toLowerCase(),
    );
    const potentialRaw = cell(raw, ["potential", "value", "amount"]);
    const potential = potentialRaw ? Number(String(potentialRaw).replace(/[^\d.]/g, "")) : undefined;
    const address = cell(raw, ["address"]) || undefined;
    const mapsLink = cell(raw, ["mapslink", "googlemapslink", "maplink", "mapsurl", "googlemaps"]) || undefined;
    const city = cell(raw, ["city", "town"]) || undefined;
    const place = splitPlace(address, mapsLink);
    let latitude = parseCoord(cell(raw, ["latitude", "lat"]), -90, 90);
    let longitude = parseCoord(cell(raw, ["longitude", "lng", "lon"]), -180, 180);
    if ((latitude == null || longitude == null) && place.mapsLink) {
      const found = await geocodeAddress(place.mapsLink);
      latitude = found?.lat ?? latitude;
      longitude = found?.lng ?? longitude;
    }
    if ((latitude == null || longitude == null) && (place.address || city)) {
      const found = await geocodeAddress([place.address, city].filter(Boolean).join(", "));
      latitude = found?.lat;
      longitude = found?.lng;
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId: input.tenantId,
        name,
        phone,
        contactPerson: cell(raw, ["contactperson", "person", "ownername"]) || undefined,
        businessType: cell(raw, ["businesstype", "type", "category"]) || undefined,
        address: place.address,
        mapsLink: place.mapsLink,
        city,
        latitude,
        longitude,
        notes: cell(raw, ["notes", "note", "remark"]) || undefined,
        potential: potential && Number.isFinite(potential) ? potential : undefined,
        temperature: "WARM",
        source: "IMPORT",
        status: assignee ? "ASSIGNED" : "NEW",
        approvalStatus: "APPROVED",
        assigneeId: assignee?.id ?? null,
        createdById: input.userId,
      },
      include: leadInclude,
    });
    created.push(publicLead(lead));
    if (assignee && assignee.id !== input.userId) {
      notifyLeadAssigned(assignee.id, { id: lead.id, name: lead.name });
    }
  }

  return { created: created.length, skipped: skipped.length, leads: created, errors: skipped };
}

export async function updateLead(
  tenantId: number,
  userId: number,
  roles: RoleCode[],
  id: number,
  data: {
    name?: string;
    phone?: string;
    contactPerson?: string;
    businessType?: string;
    productInterest?: string | null;
    address?: string;
    mapsLink?: string | null;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    notes?: string;
    potential?: number | null;
    temperature?: Temperature;
    status?: LeadStatus;
  },
) {
  const current = await getLead(tenantId, userId, roles, id);
  if (data.status && current.approvalStatus !== "APPROVED") {
    requireApproved(current);
  }
  if (data.phone !== undefined && data.phone !== current.phone) {
    if (!isManager(roles)) throw forbidden("Only a manager can change the phone number.");
    const taken = await prisma.lead.findFirst({ where: { tenantId, phone: data.phone, id: { not: id } } });
    if (taken) throw conflict(`Another lead already uses this phone: ${taken.name}.`);
  }
  if ((data.latitude == null) !== (data.longitude == null)) {
    throw badRequest("Set both latitude and longitude for the shop pin.");
  }
  const patch: typeof data = { ...data };
  if (data.address !== undefined || data.mapsLink !== undefined) {
    const street = data.address !== undefined ? data.address : undefined;
    const link = data.mapsLink !== undefined ? data.mapsLink : undefined;
    if (street && looksLikeMapsLink(street) && !String(link ?? "").trim()) {
      patch.mapsLink = street.trim();
      patch.address = "";
    } else {
      if (data.address !== undefined) patch.address = data.address.trim();
      if (data.mapsLink !== undefined) patch.mapsLink = data.mapsLink?.trim() || null;
    }
  }
  if (patch.mapsLink && patch.latitude === undefined && patch.longitude === undefined) {
    const found = await geocodeAddress(patch.mapsLink);
    if (found) {
      patch.latitude = found.lat;
      patch.longitude = found.lng;
    }
  }
  const lead = await prisma.lead.update({
    where: { id },
    data: patch,
    include: leadInclude,
  });
  return publicLead(lead);
}

export async function markContacted(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const lead = await prisma.lead.findFirst({ where: { id, ...leadScope(tenantId, userId, roles) } });
  if (!lead) {
    throw notFound("Lead not found.");
  }
  requireApproved(lead);
  if (lead.status === "NEW" || lead.status === "ASSIGNED") {
    const updated = await prisma.lead.update({
      where: { id },
      data: { status: "CONTACTED" },
      include: leadInclude,
    });
    return publicLead(updated);
  }
  return getLead(tenantId, userId, roles, id);
}

/** Drop beat seats that no longer match the lead’s assignee (avoids route vs owner conflict). */
async function syncLeadOutOfConflictingBeats(tenantId: number, leadId: number, assigneeId: number | null) {
  const members = await prisma.beatMember.findMany({
    where: { leadId, beat: { tenantId } },
    include: { beat: { select: { id: true, assigneeId: true, name: true } } },
  });
  const toRemove = members.filter((row) => assigneeId == null || row.beat.assigneeId !== assigneeId);
  if (!toRemove.length) return [] as string[];

  const beatIds = [...new Set(toRemove.map((row) => row.beat.id))];
  await prisma.beatMember.deleteMany({ where: { id: { in: toRemove.map((row) => row.id) } } });
  for (const beatId of beatIds) {
    const rest = await prisma.beatMember.findMany({ where: { beatId }, orderBy: { sequence: "asc" } });
    await Promise.all(
      rest.map((item, index) => prisma.beatMember.update({ where: { id: item.id }, data: { sequence: index + 1 } })),
    );
  }
  return [...new Set(toRemove.map((row) => row.beat.name))];
}

export async function assignLead(
  tenantId: number,
  roles: RoleCode[],
  id: number,
  assigneeId: number | null,
) {
  if (!isManager(roles)) {
    throw forbidden();
  }
  if (assigneeId != null) {
    const user = await prisma.user.findFirst({
      where: { id: assigneeId, tenantId, status: "ACTIVE", roles: { some: { role: { code: "SALES_EXECUTIVE" } } } },
    });
    if (!user) {
      throw badRequest("Salesperson not found.");
    }
  }
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) {
    throw notFound("Lead not found.");
  }

  const removedFrom = await syncLeadOutOfConflictingBeats(tenantId, id, assigneeId);

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      assigneeId,
      status: assigneeId == null ? lead.status : lead.status === "NEW" ? "ASSIGNED" : lead.status,
    },
    include: leadInclude,
  });
  if (assigneeId != null && lead.assigneeId !== assigneeId) {
    notifyLeadAssigned(assigneeId, { id: updated.id, name: updated.name });
  }

  const leadOut = publicLead(updated);
  if (!removedFrom.length) return leadOut;
  return {
    ...leadOut,
    beatNotice:
      assigneeId == null
        ? `Removed from beat${removedFrom.length > 1 ? "s" : ""}: ${removedFrom.join(", ")}.`
        : `Removed from other beat${removedFrom.length > 1 ? "s" : ""} so this lead matches the new executive: ${removedFrom.join(", ")}.`,
  };
}

export async function decideLead(
  tenantId: number,
  userId: number,
  roles: RoleCode[],
  id: number,
  decision: "APPROVED" | "REJECTED",
  note?: string,
) {
  if (!isManager(roles)) {
    throw forbidden("Only a manager can approve leads.");
  }
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) {
    throw notFound("Lead not found.");
  }
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      approvalStatus: decision,
      approvedById: userId,
      approvedAt: new Date(),
      rejectionNote: decision === "REJECTED" ? note?.trim() || null : null,
    },
    include: leadInclude,
  });
  if (lead.approvalStatus !== decision) {
    const told = new Set([lead.createdById, lead.assigneeId].filter((item): item is number => item != null && item !== userId));
    for (const person of told) notifyLeadDecision(person, { id: updated.id, name: updated.name }, decision === "APPROVED");
  }
  return publicLead(updated);
}

export async function convertLead(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const lead = await prisma.lead.findFirst({
    where: { id, ...leadScope(tenantId, userId, roles) },
  });
  if (!lead) {
    throw notFound("Lead not found.");
  }
  requireApproved(lead);
  if (lead.customerId) {
    throw badRequest("This lead is already a customer.");
  }

  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone: lead.phone },
  });
  if (existing) {
    const updated = await prisma.lead.update({
      where: { id },
      data: { status: "WON", customerId: existing.id },
      include: leadInclude,
    });
    return { lead: publicLead(updated), customer: existing };
  }

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      name: lead.name,
      phone: lead.phone,
      contactPerson: lead.contactPerson,
      businessType: lead.businessType,
      address: lead.address,
      city: lead.city,
      latitude: lead.latitude,
      longitude: lead.longitude,
      notes: lead.notes,
      ownerId: lead.assigneeId ?? userId,
    },
  });

  const updated = await prisma.lead.update({
    where: { id },
    data: { status: "WON", customerId: customer.id },
    include: leadInclude,
  });

  return { lead: publicLead(updated), customer };
}

export async function listCustomers(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  q?: string;
  ownerId?: number;
}) {
  const where: Prisma.CustomerWhereInput = {
    ...customerScope(input.tenantId, input.userId, input.roles),
    ...(isManager(input.roles) && input.ownerId ? { ownerId: input.ownerId } : {}),
  };
  if (input.q) {
    where.AND = [
      {
        OR: [
          { name: { contains: input.q } },
          { phone: { contains: input.q } },
          { contactPerson: { contains: input.q } },
        ],
      },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: { owner: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return customers.map((item) => ({
    id: item.id,
    kind: "customer" as const,
    name: item.name,
    phone: item.phone,
    contactPerson: item.contactPerson,
    address: item.address,
    city: item.city,
    ownerName: item.owner?.name ?? null,
  }));
}

export async function createFollowUp(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  leadId?: number;
  customerId?: number;
  type: FollowUpType;
  dueAt: string;
  notes?: string;
  clientRequestId?: string;
}) {
  const clientRequestId = input.clientRequestId?.trim() || undefined;
  if (clientRequestId) {
    const replay = await prisma.followUp.findFirst({
      where: { tenantId: input.tenantId, clientRequestId },
      include: { lead: { select: { name: true } }, customer: { select: { name: true } } },
    });
    if (replay) {
      return publicFollowUp({
        ...replay,
        lead: replay.lead ? { id: replay.leadId!, name: replay.lead.name } : null,
        customer: replay.customer ? { id: replay.customerId!, name: replay.customer.name } : null,
      });
    }
  }

  if (!input.leadId && !input.customerId) {
    throw badRequest("Choose a lead or customer.");
  }

  if (input.leadId) {
    const lead = await getLead(input.tenantId, input.userId, input.roles, input.leadId);
    requireApproved(lead);
  }

  const followUp = await prisma.followUp.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      leadId: input.leadId,
      customerId: input.customerId,
      type: input.type,
      dueAt: new Date(input.dueAt),
      notes: input.notes,
      clientRequestId,
    },
    include: { lead: { select: { name: true } }, customer: { select: { name: true } } },
  });

  if (input.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
    if (lead && lead.status !== "WON" && lead.status !== "LOST") {
      await prisma.lead.update({
        where: { id: input.leadId },
        data: { status: "FOLLOW_UP" },
      });
    }
  }

  return publicFollowUp(followUp);
}

export async function listFollowUps(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  scope?: string;
}) {
  const where: Prisma.FollowUpWhereInput = { tenantId: input.tenantId };
  if (!isManager(input.roles)) {
    where.userId = input.userId;
  }

  const now = new Date();
  if (input.scope === "done") {
    where.doneAt = { not: null };
  } else if (input.scope === "overdue") {
    where.doneAt = null;
    where.dueAt = { lt: now };
  } else if (input.scope === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    where.doneAt = null;
    where.dueAt = { gte: start, lte: end };
  } else if (input.scope === "upcoming") {
    where.doneAt = null;
    where.dueAt = { gte: now };
  } else {
    where.doneAt = null;
  }

  const rows = await prisma.followUp.findMany({
    where,
    include: { lead: { select: { id: true, name: true, phone: true } }, customer: { select: { id: true, name: true, phone: true } } },
    orderBy: { dueAt: "asc" },
    take: 80,
  });
  return rows.map(publicFollowUp);
}

export async function completeFollowUp(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const where: Prisma.FollowUpWhereInput = { id, tenantId };
  if (!isManager(roles)) {
    where.userId = userId;
  }
  const row = await prisma.followUp.findFirst({ where });
  if (!row) {
    throw notFound("Follow-up not found.");
  }
  const updated = await prisma.followUp.update({
    where: { id },
    data: { doneAt: new Date() },
    include: { lead: { select: { id: true, name: true, phone: true } }, customer: { select: { id: true, name: true, phone: true } } },
  });
  return publicFollowUp(updated);
}

export async function homeSummary(tenantId: number, userId: number, roles: RoleCode[]) {
  if (isAdmin(roles) && !isManager(roles)) {
    return { todayLeads: 0, overdueFollowUps: 0, upcoming: [] };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const leadWhere = leadScope(tenantId, userId, roles);
  const followWhere: Prisma.FollowUpWhereInput = { tenantId, doneAt: null };
  if (!isManager(roles)) {
    followWhere.userId = userId;
  }

  const visitWhere = isManager(roles) ? { tenantId } : { tenantId, userId };

  const saleWhere = isManager(roles) ? { tenantId } : { tenantId, userId };
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  const targetWhere = isManager(roles)
    ? { tenantId, year: start.getFullYear(), month: start.getMonth() + 1 }
    : { tenantId, userId, year: start.getFullYear(), month: start.getMonth() + 1 };

  const [todayLeads, pendingApprovals, overdueFollowUps, upcoming, todayVisits, overdueItems, todaySale, monthSale, monthTarget] = await Promise.all([
    prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: start, lte: end }, approvalStatus: "APPROVED" } }),
    prisma.lead.count({ where: { ...leadWhere, approvalStatus: "PENDING" } }),
    prisma.followUp.count({ where: { ...followWhere, dueAt: { lt: new Date() } } }),
    prisma.followUp.findMany({
      where: followWhere,
      include: { lead: { select: { id: true, name: true, phone: true } }, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    prisma.visit.count({ where: { ...visitWhere, checkedInAt: { gte: start, lte: end } } }),
    prisma.followUp.findMany({
      where: { ...followWhere, dueAt: { lt: new Date() } },
      include: { lead: { select: { id: true, name: true, phone: true } }, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { dueAt: "asc" },
      take: 12,
    }),
    prisma.sale.aggregate({
      where: { ...saleWhere, createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { ...saleWhere, createdAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.monthlyTarget.aggregate({
      where: targetWhere,
      _sum: { amount: true },
    }),
  ]);

  const monthSalesAmount = monthSale._sum.amount ? Number(monthSale._sum.amount) : 0;
  const monthTargetAmount = monthTarget._sum.amount ? Number(monthTarget._sum.amount) : 0;

  return {
    todayLeads,
    pendingApprovals,
    overdueFollowUps,
    todayVisits,
    todaySalesCount: todaySale._count,
    todaySalesAmount: todaySale._sum.amount ? Number(todaySale._sum.amount) : 0,
    monthSalesAmount,
    monthTarget: monthTargetAmount,
    targetPercent: monthTargetAmount ? Math.round((monthSalesAmount / monthTargetAmount) * 100) : 0,
    upcoming: upcoming.map(publicFollowUp),
    overdueItems: overdueItems.map(publicFollowUp),
  };
}

function publicFollowUp(row: {
  id: number;
  type: FollowUpType;
  dueAt: Date;
  doneAt: Date | null;
  notes: string | null;
  lead?: { id: number; name: string; phone?: string } | null;
  customer?: { id: number; name: string; phone?: string } | null;
}) {
  const name = row.lead?.name ?? row.customer?.name ?? "Follow-up";
  const phone = row.lead?.phone ?? row.customer?.phone ?? null;
  return {
    id: row.id,
    type: row.type,
    dueAt: row.dueAt,
    doneAt: row.doneAt,
    notes: row.notes,
    name,
    phone,
    leadId: row.lead?.id ?? null,
    customerId: row.customer?.id ?? null,
    overdue: !row.doneAt && row.dueAt < new Date(),
  };
}
