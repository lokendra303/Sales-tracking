import fs from "node:fs";
import path from "node:path";
import { FollowUpType, type RoleCode } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { isManager } from "../crm/crm.helpers.js";
import { parseDay } from "../beat/beat.helpers.js";
import { asNumber, dayBounds, haversineMeters, publicVisit, tomorrowMorning } from "./visits.helpers.js";

const MAX_DEMO_PHOTOS = 6;

const visitInclude = {
  user: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true, phone: true, address: true, city: true, latitude: true, longitude: true } },
  customer: { select: { id: true, name: true, phone: true, address: true, city: true, latitude: true, longitude: true } },
  sales: { select: { id: true, billPhotoPath: true }, orderBy: { createdAt: "desc" as const }, take: 1 },
  demoPhotos: { select: { id: true, createdAt: true }, orderBy: { id: "asc" as const } },
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

export const FINISH_RADIUS_METERS = 300;

function measureDistance(phone: { lat: number; lng: number }, place: { lat: number | null; lng: number | null }) {
  if (place.lat == null || place.lng == null) {
    return { distanceMeters: null as number | null, verified: false };
  }
  const distanceMeters = haversineMeters(phone, { lat: place.lat, lng: place.lng });
  return { distanceMeters, verified: distanceMeters <= FINISH_RADIUS_METERS };
}

async function finishedToday(tenantId: number, userId: number, place: { leadId: number | null; customerId: number | null }) {
  if (!place.leadId && !place.customerId) return null;
  const { start, end } = dayBounds();
  return prisma.visit.findFirst({
    where: {
      tenantId,
      userId,
      status: "COMPLETED",
      outcome: "SUCCESS",
      checkedInAt: { gte: start, lte: end },
      OR: [
        ...(place.leadId ? [{ leadId: place.leadId }] : []),
        ...(place.customerId ? [{ customerId: place.customerId }] : []),
      ],
    },
    select: { id: true },
    orderBy: { checkedInAt: "desc" },
  });
}

export async function previewCheckin(input: {
  tenantId: number;
  userId: number;
  leadId?: number;
  customerId?: number;
  beatStopId?: number;
  lat: number;
  lng: number;
}) {
  const place = await loadPlace(input);
  const measured = measureDistance({ lat: input.lat, lng: input.lng }, { lat: place.placeLat, lng: place.placeLng });
  const done = await finishedToday(input.tenantId, input.userId, place);
  return {
    doneTodayVisitId: done?.id ?? null,
    name: place.lead?.name ?? place.customer?.name ?? "Visit",
    phone: place.lead?.phone ?? place.customer?.phone ?? null,
    address: place.lead?.address ?? place.customer?.address ?? null,
    city: place.lead?.city ?? place.customer?.city ?? null,
    placeLat: place.placeLat,
    placeLng: place.placeLng,
    leadId: place.leadId,
    customerId: place.customerId,
    beatStopId: place.beatStopId,
    distanceMeters: measured.distanceMeters,
    radiusMeters: FINISH_RADIUS_METERS,
    withinRadius: measured.verified,
    hasPin: place.placeLat != null && place.placeLng != null,
    allowUnverified: true,
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

  const place = await loadPlace(input);
  const open = await prisma.visit.findFirst({
    where: { tenantId: input.tenantId, userId: input.userId, status: "IN_PROGRESS" },
    include: visitInclude,
  });
  if (open) {
    const samePlace =
      (place.leadId != null && open.leadId === place.leadId) ||
      (place.customerId != null && open.customerId === place.customerId);
    if (samePlace) return publicVisit(open);
    const where = open.lead?.name ?? open.customer?.name ?? "another shop";
    throw conflict(`Finish your visit at ${where} first. Only one visit can be open at a time.`, { visitId: open.id });
  }

  if (place.lead && place.lead.approvalStatus !== "APPROVED") {
    throw badRequest(
      place.lead.approvalStatus === "REJECTED"
        ? "The manager rejected this lead."
        : "This lead is waiting for manager approval.",
    );
  }
  const done = await finishedToday(input.tenantId, input.userId, place);
  if (done) {
    throw conflict("You already finished a visit at this shop today. Open it from Visits to see the proof.", {
      visitId: done.id,
    });
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
  const check = measureDistance(
    { lat: input.lat, lng: input.lng },
    { lat: place.placeLat, lng: place.placeLng },
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
      checkinDistanceMeters: check.distanceMeters,
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

export type VisitFilter = "all" | "completed" | "missed" | "in_progress";

const visitFilterWhere: Record<VisitFilter, object> = {
  all: {},
  completed: { status: "COMPLETED", outcome: "SUCCESS" },
  missed: { status: "COMPLETED", outcome: "UNAVAILABLE" },
  in_progress: { status: "IN_PROGRESS" },
};

export async function listVisits(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  days?: number;
  from?: string;
  to?: string;
  status?: VisitFilter;
  forUserId?: number;
}) {
  let start: Date;
  let end: Date;
  const todayEnd = dayBounds().end;
  if (input.from) {
    start = parseDay(input.from).start;
    end = parseDay(input.to || input.from).end;
    if (end < start) [start, end] = [parseDay(input.to || input.from).start, parseDay(input.from).end];
    if (end > todayEnd) end = todayEnd;
    if (start > end) start = dayBounds().start;
  } else {
    end = new Date();
    start = new Date();
    start.setDate(start.getDate() - Math.max(1, input.days ?? 14));
    start.setHours(0, 0, 0, 0);
  }
  const scope =
    isManager(input.roles) && input.forUserId
      ? { tenantId: input.tenantId, userId: input.forUserId }
      : visitScope(input.tenantId, input.userId, input.roles);
  const visits = await prisma.visit.findMany({
    where: {
      ...scope,
      ...visitFilterWhere[input.status ?? "all"],
      checkedInAt: { gte: start, lte: end },
    },
    include: visitInclude,
    orderBy: { checkedInAt: "desc" },
    take: 500,
  });
  return visits.map(publicVisit);
}

export async function todayBeat(tenantId: number, userId: number, roles: RoleCode[]) {
  if (isManager(roles)) {
    throw forbidden("Managers do not have a field beat.");
  }

  const { start, end } = dayBounds();
  const { ensureScheduledDayStops } = await import("../beat/beat.service.js");
  const scheduled = await ensureScheduledDayStops(tenantId, userId);

  const [active, done, todayVisits] = await Promise.all([
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
  const samePlace = (stop: { leadId: number | null; customerId: number | null }) => (visit: { leadId: number | null; customerId: number | null }) =>
    Boolean((stop.leadId && visit.leadId === stop.leadId) || (stop.customerId && visit.customerId === stop.customerId));

  const items = scheduled.stops;
  const visitedOnBeat = items.filter((stop) => todayVisits.some(samePlace(stop))).length;

  const rows = items.map((stop) => {
    const place = stop.lead ?? stop.customer;
    const today = todayVisits.filter(samePlace(stop));
    const latest =
      today.find((visit) => visit.status === "IN_PROGRESS") ??
      today.find((visit) => visit.status === "COMPLETED") ??
      today[0] ??
      null;
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
      visitAt: latest ? latest.checkedOutAt ?? latest.checkedInAt : null,
      visitedToday: Boolean(latest),
      saleAmount: asNumber(latest?.saleAmount),
      saleId: latest?.sales?.[0]?.id ?? null,
    };
  });

  const beatSize = scheduled.beat?.size ?? rows.length;
  return {
    radiusMeters: FINISH_RADIUS_METERS,
    beatId: scheduled.beat?.id ?? null,
    beatName: scheduled.beat?.name ?? null,
    territory: scheduled.beat?.territory ?? null,
    beatSize,
    visitedOnBeat,
    missedOnBeat: Math.max(0, beatSize - visitedOnBeat),
    completedToday: done,
    activeVisit: active ? publicVisit(active) : null,
    stops: rows,
    message: scheduled.beat
      ? null
      : "No beat scheduled for today. Ask your manager to assign a weekly beat.",
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

export async function saveDemoPhoto(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  visitId: number;
  photoPath: string;
}) {
  const visit = await prisma.visit.findFirst({
    where: { id: input.visitId, ...visitScope(input.tenantId, input.userId, input.roles) },
    include: { demoPhotos: { select: { id: true } } },
  });
  if (!visit) throw notFound("Visit not found.");
  if (visit.status !== "IN_PROGRESS") throw badRequest("This visit is already finished.");
  if (visit.userId !== input.userId && !isManager(input.roles)) throw forbidden();
  if (visit.demoPhotos.length >= MAX_DEMO_PHOTOS) {
    throw badRequest(`You can add up to ${MAX_DEMO_PHOTOS} gallery photos.`);
  }

  await prisma.visitDemoPhoto.create({
    data: {
      tenantId: input.tenantId,
      visitId: visit.id,
      path: input.photoPath,
    },
  });

  const updated = await prisma.visit.findFirst({
    where: { id: visit.id },
    include: visitInclude,
  });
  return publicVisit(updated!);
}

export async function getDemoPhotoPath(
  tenantId: number,
  userId: number,
  roles: RoleCode[],
  visitId: number,
  photoId: number,
) {
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, ...visitScope(tenantId, userId, roles) },
  });
  if (!visit) throw notFound("Visit not found.");
  const photo = await prisma.visitDemoPhoto.findFirst({
    where: { id: photoId, visitId, tenantId },
  });
  if (!photo?.path) throw notFound("Gallery photo not found.");
  return path.resolve(photo.path);
}

export async function deleteDemoPhoto(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  visitId: number;
  photoId: number;
}) {
  const visit = await prisma.visit.findFirst({
    where: { id: input.visitId, ...visitScope(input.tenantId, input.userId, input.roles) },
  });
  if (!visit) throw notFound("Visit not found.");
  if (visit.userId !== input.userId && !isManager(input.roles)) throw forbidden();
  if (visit.status !== "IN_PROGRESS" && !isManager(input.roles)) {
    throw badRequest("Gallery photos can only be removed while the visit is open.");
  }

  const photo = await prisma.visitDemoPhoto.findFirst({
    where: { id: input.photoId, visitId: visit.id, tenantId: input.tenantId },
  });
  if (!photo) throw notFound("Gallery photo not found.");

  await prisma.visitDemoPhoto.delete({ where: { id: photo.id } });
  try {
    if (photo.path && fs.existsSync(photo.path)) fs.unlinkSync(photo.path);
  } catch {
    // ignore missing file
  }

  const updated = await prisma.visit.findFirst({
    where: { id: visit.id },
    include: visitInclude,
  });
  return publicVisit(updated!);
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
  lat?: number;
  lng?: number;
  accuracy?: number;
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
  if (input.lat == null || input.lng == null) {
    throw badRequest("Turn on location to finish the visit. You need to be within 300 m of the shop.");
  }
  const placeLat = asNumber(visit.lead?.latitude ?? visit.customer?.latitude);
  const placeLng = asNumber(visit.lead?.longitude ?? visit.customer?.longitude);
  if (placeLat == null || placeLng == null) {
    throw badRequest("This shop has no map pin. Ask your manager to correct the location, then finish the visit.");
  }
  const distanceMeters = haversineMeters({ lat: input.lat, lng: input.lng }, { lat: placeLat, lng: placeLng });
  if (distanceMeters - Math.min(input.accuracy ?? 0, 100) > FINISH_RADIUS_METERS) {
    throw badRequest(`You are ${distanceMeters} m from the shop. Finish the visit within 300 m.`, "TOO_FAR", {
      distanceMeters,
      radiusMeters: FINISH_RADIUS_METERS,
    });
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
        checkoutLat: input.lat,
        checkoutLng: input.lng,
        checkoutAccuracy: input.accuracy,
        distanceMeters,
        verified: true,
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
