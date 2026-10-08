import path from "node:path";
import { FollowUpType, type RoleCode } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { isManager } from "../crm/crm.helpers.js";
import { asNumber, dayBounds, haversineMeters, publicVisit, tomorrowMorning } from "./visits.helpers.js";

const visitInclude = {
  user: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true, phone: true, address: true, city: true, latitude: true, longitude: true } },
  customer: { select: { id: true, name: true, phone: true, address: true, city: true, latitude: true, longitude: true } },
  sales: { select: { id: true }, orderBy: { createdAt: "desc" as const }, take: 1 },
};

function visitScope(tenantId: number, userId: number, roles: RoleCode[]) {
  if (isManager(roles)) return { tenantId };
  return { tenantId, userId };
}

async function loadPlace(input: { tenantId: number; leadId?: number; customerId?: number; beatStopId?: number }) {
  let leadId = input.leadId;
  let customerId = input.customerId;
  let beatStopId = input.beatStopId;

  if (beatStopId) {
    const stop = await prisma.beatStop.findFirst({
      where: { id: beatStopId, tenantId: input.tenantId },
    });
    if (!stop) throw notFound("Beat stop not found.");
    leadId = stop.leadId ?? leadId;
    customerId = stop.customerId ?? customerId;
    beatStopId = stop.id;
  }

  if (!leadId && !customerId) {
    throw badRequest("Choose a lead or customer to visit.");
  }

  const lead = leadId
    ? await prisma.lead.findFirst({ where: { id: leadId, tenantId: input.tenantId } })
    : null;
  const customer = customerId
    ? await prisma.customer.findFirst({ where: { id: customerId, tenantId: input.tenantId } })
    : null;

  if (leadId && !lead) throw notFound("Lead not found.");
  if (customerId && !customer) throw notFound("Customer not found.");

  const placeLat = asNumber(lead?.latitude ?? customer?.latitude);
  const placeLng = asNumber(lead?.longitude ?? customer?.longitude);

  return { lead, customer, leadId: lead?.id ?? null, customerId: customer?.id ?? null, beatStopId: beatStopId ?? null, placeLat, placeLng };
}

function checkDistance(
  phone: { lat: number; lng: number },
  place: { lat: number | null; lng: number | null },
  radiusMeters: number,
  allowUnverified: boolean,
) {
  if (place.lat == null || place.lng == null) {
    if (!allowUnverified) {
      throw badRequest("This stop has no map pin. Ask your manager to add the shop location.");
    }
    return { distanceMeters: null as number | null, verified: false };
  }

  const distanceMeters = haversineMeters(phone, { lat: place.lat, lng: place.lng });
  if (distanceMeters > radiusMeters && !allowUnverified) {
    throw badRequest(`You are ${distanceMeters} m away. Need to be within ${radiusMeters} m.`, "TOO_FAR", {
      distanceMeters,
      radiusMeters,
    });
  }
  return { distanceMeters, verified: distanceMeters <= radiusMeters };
}

export async function previewCheckin(input: {
  tenantId: number;
  leadId?: number;
  customerId?: number;
  beatStopId?: number;
  lat: number;
  lng: number;
}) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: input.tenantId } });
  const place = await loadPlace(input);
  const radiusMeters = settings?.visitCheckinRadiusMeters ?? 100;
  let distanceMeters: number | null = null;
  if (place.placeLat != null && place.placeLng != null) {
    distanceMeters = haversineMeters({ lat: input.lat, lng: input.lng }, { lat: place.placeLat, lng: place.placeLng });
  }
  return {
    name: place.lead?.name ?? place.customer?.name ?? "Visit",
    phone: place.lead?.phone ?? place.customer?.phone ?? null,
    address: place.lead?.address ?? place.customer?.address ?? null,
    city: place.lead?.city ?? place.customer?.city ?? null,
    placeLat: place.placeLat,
    placeLng: place.placeLng,
    leadId: place.leadId,
    customerId: place.customerId,
    beatStopId: place.beatStopId,
    distanceMeters,
    radiusMeters,
    withinRadius: distanceMeters != null && distanceMeters <= radiusMeters,
    hasPin: place.placeLat != null && place.placeLng != null,
    allowUnverified: settings?.allowUnverifiedCheckin ?? false,
  };
}

function clientTime(value?: string) {
  const now = new Date();
  if (!value) return now;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return now;
  if (at.getTime() > now.getTime() + 2 * 60 * 1000) return now;
  if (now.getTime() - at.getTime() > 14 * 24 * 60 * 60 * 1000) return now;
  return at;
}

export async function checkIn(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  leadId?: number;
  customerId?: number;
  beatStopId?: number;
  lat: number;
  lng: number;
  accuracy?: number;
  checkedInAt?: string;
}) {
  if (isManager(input.roles)) {
    throw forbidden("Managers review visits. They do not check in.");
  }

  const open = await prisma.visit.findFirst({
    where: { tenantId: input.tenantId, userId: input.userId, status: "IN_PROGRESS" },
    include: visitInclude,
  });
  if (open) {
    return publicVisit(open);
  }

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: input.tenantId } });
  const place = await loadPlace(input);
  if (place.lead && place.lead.approvalStatus !== "APPROVED") {
    throw badRequest(
      place.lead.approvalStatus === "REJECTED"
        ? "The manager rejected this lead."
        : "This lead is waiting for manager approval.",
    );
  }
  if (!place.beatStopId) {
    const { start, end } = dayBounds();
    const stop = await prisma.beatStop.findFirst({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        plannedAt: { gte: start, lte: end },
        OR: [
          ...(place.leadId ? [{ leadId: place.leadId }] : []),
          ...(place.customerId ? [{ customerId: place.customerId }] : []),
        ],
      },
    });
    if (stop) place.beatStopId = stop.id;
  }
  const check = checkDistance(
    { lat: input.lat, lng: input.lng },
    { lat: place.placeLat, lng: place.placeLng },
    settings?.visitCheckinRadiusMeters ?? 100,
    settings?.allowUnverifiedCheckin ?? false,
  );

  const visit = await prisma.visit.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      leadId: place.leadId,
      customerId: place.customerId,
      beatStopId: place.beatStopId,
      checkedInAt: clientTime(input.checkedInAt),
      checkinLat: input.lat,
      checkinLng: input.lng,
      checkinAccuracy: input.accuracy,
      distanceMeters: check.distanceMeters,
      verified: check.verified,
    },
    include: visitInclude,
  });

  return publicVisit(visit);
}

export async function getVisit(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const visit = await prisma.visit.findFirst({
    where: { id, ...visitScope(tenantId, userId, roles) },
    include: visitInclude,
  });
  if (!visit) throw notFound("Visit not found.");
  return publicVisit(visit);
}

export async function listVisits(tenantId: number, userId: number, roles: RoleCode[], days = 14, forUserId?: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Math.max(1, days));
  start.setHours(0, 0, 0, 0);
  const scope =
    isManager(roles) && forUserId
      ? { tenantId, userId: forUserId }
      : visitScope(tenantId, userId, roles);
  const visits = await prisma.visit.findMany({
    where: {
      ...scope,
      checkedInAt: { gte: start, lte: end },
    },
    include: visitInclude,
    orderBy: { checkedInAt: "desc" },
  });
  return visits.map(publicVisit);
}

export async function todayBeat(tenantId: number, userId: number, roles: RoleCode[]) {
  if (isManager(roles)) {
    throw forbidden("Managers do not have a field beat.");
  }

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const { start, end } = dayBounds();
  const [stops, active, done, todayVisits] = await Promise.all([
    prisma.beatStop.findMany({
      where: {
        tenantId,
        userId,
        OR: [{ plannedAt: { gte: start, lte: end } }, { plannedAt: null }],
      },
      include: {
        lead: true,
        customer: true,
      },
      orderBy: { sequence: "asc" },
    }),
    prisma.visit.findFirst({
      where: { tenantId, userId, status: "IN_PROGRESS" },
      include: visitInclude,
    }),
    prisma.visit.count({
      where: { tenantId, userId, status: "COMPLETED", checkedInAt: { gte: start, lte: end } },
    }),
    prisma.visit.findMany({
      where: { tenantId, userId, checkedInAt: { gte: start, lte: end } },
      include: { sales: { select: { id: true }, orderBy: { createdAt: "desc" as const }, take: 1 } },
      orderBy: { checkedInAt: "desc" },
    }),
  ]);

  let items = stops;
  if (!items.length) {
    const leads = await prisma.lead.findMany({
      where: { tenantId, assigneeId: userId, status: { notIn: ["WON", "LOST"] }, approvalStatus: "APPROVED" },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    items = leads.map((lead, index) => ({
      id: 0,
      tenantId,
      userId,
      leadId: lead.id,
      customerId: null,
      sequence: index + 1,
      plannedAt: null,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      lead,
      customer: null,
      visits: [],
    }));
  }

  return {
    radiusMeters: settings?.visitCheckinRadiusMeters ?? 100,
    completedToday: done,
    activeVisit: active ? publicVisit(active) : null,
    stops: items.map((stop) => {
      const place = stop.lead ?? stop.customer;
      const latest =
        todayVisits.find(
          (visit) =>
            (stop.leadId && visit.leadId === stop.leadId) ||
            (stop.customerId && visit.customerId === stop.customerId),
        ) ?? null;
      return {
        id: stop.id || null,
        sequence: stop.sequence,
        leadId: stop.leadId,
        customerId: stop.customerId,
        name: place?.name ?? "Stop",
        phone: place?.phone ?? null,
        address: place?.address ?? null,
        city: place?.city ?? null,
        placeLat: asNumber(place?.latitude),
        placeLng: asNumber(place?.longitude),
        visitId: latest?.id ?? null,
        visitStatus: latest?.status ?? null,
        visitOutcome: latest?.outcome ?? null,
        saleAmount: asNumber(latest?.saleAmount),
        saleId: latest?.sales?.[0]?.id ?? null,
      };
    }),
  };
}

export async function savePhoto(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  visitId: number;
  photoPath: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  capturedAt?: string;
}) {
  const visit = await prisma.visit.findFirst({
    where: { id: input.visitId, ...visitScope(input.tenantId, input.userId, input.roles) },
    include: visitInclude,
  });
  if (!visit) throw notFound("Visit not found.");
  if (visit.status !== "IN_PROGRESS") throw badRequest("This visit is already finished.");
  if (visit.userId !== input.userId && !isManager(input.roles)) throw forbidden();

  const updated = await prisma.visit.update({
    where: { id: visit.id },
    data: {
      photoPath: input.photoPath,
      photoLat: input.lat,
      photoLng: input.lng,
      photoAccuracy: input.accuracy,
      photoCapturedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
      photoReceivedAt: new Date(),
    },
    include: visitInclude,
  });
  return publicVisit(updated);
}

export async function getPhotoPath(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const visit = await prisma.visit.findFirst({
    where: { id, ...visitScope(tenantId, userId, roles) },
  });
  if (!visit?.photoPath) throw notFound("Place photo not found.");
  return path.resolve(visit.photoPath);
}

export async function completeVisit(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  visitId: number;
  outcome: "SUCCESS" | "UNAVAILABLE";
  notes?: string;
  collectionAmount?: number;
  checkedOutAt?: string;
}) {
  if (isManager(input.roles)) {
    throw forbidden("Managers review visits. They do not complete field visits.");
  }

  const visit = await prisma.visit.findFirst({
    where: { id: input.visitId, tenantId: input.tenantId, userId: input.userId },
    include: visitInclude,
  });
  if (!visit) throw notFound("Visit not found.");
  if (visit.status !== "IN_PROGRESS") return publicVisit(visit);
  if (input.outcome === "SUCCESS" && !visit.photoPath) {
    throw badRequest("Take a place photo before completing a successful visit.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.visit.update({
      where: { id: visit.id },
      data: {
        status: "COMPLETED",
        outcome: input.outcome,
        notes: input.notes,
        checkedOutAt: clientTime(input.checkedOutAt),
        collectionAmount: input.collectionAmount,
      },
      include: visitInclude,
    });

    if (visit.leadId) {
      const lead = await tx.lead.findUnique({ where: { id: visit.leadId } });
      if (lead && lead.status !== "WON" && lead.status !== "LOST") {
        await tx.lead.update({
          where: { id: lead.id },
          data: { status: input.outcome === "SUCCESS" ? "FOLLOW_UP" : lead.status === "NEW" || lead.status === "ASSIGNED" ? "CONTACTED" : lead.status },
        });
      }
    }

    const followOr = [
      ...(visit.leadId ? [{ leadId: visit.leadId }] : []),
      ...(visit.customerId ? [{ customerId: visit.customerId }] : []),
    ];
    if (followOr.length) {
      await tx.followUp.updateMany({
        where: {
          tenantId: input.tenantId,
          userId: input.userId,
          doneAt: null,
          type: FollowUpType.VISIT,
          OR: followOr,
        },
        data: { doneAt: new Date() },
      });
    }

    if (input.outcome === "UNAVAILABLE") {
      await tx.followUp.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          leadId: visit.leadId,
          customerId: visit.customerId,
          type: "VISIT",
          dueAt: tomorrowMorning(),
          notes: input.notes || "Customer not available. Try again tomorrow.",
        },
      });
    }

    return row;
  });

  return publicVisit(updated);
}

export async function confirmVisit(tenantId: number, roles: RoleCode[], id: number) {
  if (!isManager(roles)) throw forbidden("Only managers confirm visits.");
  const visit = await prisma.visit.findFirst({ where: { id, tenantId }, include: visitInclude });
  if (!visit) throw notFound("Visit not found.");
  if (visit.status !== "COMPLETED" || visit.outcome !== "SUCCESS") {
    throw badRequest("Confirm only a completed successful visit.");
  }
  if (!visit.photoPath) throw badRequest("This visit has no place photo.");
  const updated = await prisma.visit.update({
    where: { id: visit.id },
    data: { managerConfirmedAt: new Date() },
    include: visitInclude,
  });
  return publicVisit(updated);
}
