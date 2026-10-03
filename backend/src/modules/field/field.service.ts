import type { RoleCode, SessionEndReason } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { isManager } from "../crm/crm.helpers.js";
import { asNumber, haversineMeters } from "../visits/visits.helpers.js";

function ageSeconds(at: Date | null) {
  if (!at) return null;
  return Math.max(0, Math.round((Date.now() - at.getTime()) / 1000));
}

function durationMinutes(startedAt: Date, endedAt?: Date | null) {
  return Math.max(0, Math.round(((endedAt?.getTime() ?? Date.now()) - startedAt.getTime()) / 60000));
}

async function settingsFor(tenantId: number) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  return {
    liveLocationEnabled: settings?.liveLocationEnabled ?? false,
    intervalSeconds: settings?.trackingIntervalSeconds ?? 300,
    moveMeters: settings?.trackingSignificantMovementMeters ?? 100,
    autoCloseHours: settings?.autoCloseFieldSessionHours ?? 12,
  };
}

export function publicSession(
  row: {
    id: number;
    status: string;
    startedAt: Date;
    endedAt: Date | null;
    endedReason: SessionEndReason | null;
    lastLat: unknown;
    lastLng: unknown;
    lastAccuracy: unknown;
    lastSeenAt: Date | null;
    pointCount: number;
  },
  settings: { liveLocationEnabled: boolean; intervalSeconds: number; autoCloseHours: number },
) {
  const liveStreaming = settings.liveLocationEnabled && row.status === "ACTIVE";
  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    endedReason: row.endedReason,
    liveLocationEnabled: settings.liveLocationEnabled,
    liveStreaming,
    lastLat: settings.liveLocationEnabled ? asNumber(row.lastLat) : null,
    lastLng: settings.liveLocationEnabled ? asNumber(row.lastLng) : null,
    lastAccuracy: asNumber(row.lastAccuracy),
    lastSeenAt: row.lastSeenAt,
    lastSeenAgeSeconds: ageSeconds(row.lastSeenAt),
    pointCount: row.pointCount,
    intervalSeconds: settings.intervalSeconds,
    autoCloseHours: settings.autoCloseHours,
    durationMinutes: durationMinutes(row.startedAt, row.endedAt),
  };
}

async function maybeAutoClose(tenantId: number, userId: number) {
  const settings = await settingsFor(tenantId);
  const open = await prisma.locationSession.findFirst({
    where: { tenantId, userId, status: "ACTIVE" },
  });
  if (!open) return { session: null, settings, autoClosed: false };
  const hours = (Date.now() - open.startedAt.getTime()) / 3600000;
  if (hours < settings.autoCloseHours) {
    return { session: open, settings, autoClosed: false };
  }
  const session = await prisma.locationSession.update({
    where: { id: open.id },
    data: { status: "ENDED", endedAt: new Date(), endedReason: "AUTO_CLOSE" },
  });
  return { session, settings, autoClosed: true };
}

export async function startSession(tenantId: number, userId: number, roles: RoleCode[]) {
  if (isManager(roles)) throw forbidden("Managers do not start field work.");
  const current = await maybeAutoClose(tenantId, userId);
  if (current.session && current.session.status === "ACTIVE") {
    return publicSession(current.session, current.settings);
  }
  const session = await prisma.locationSession.create({
    data: { tenantId, userId },
  });
  return publicSession(session, current.settings);
}

export async function endSession(tenantId: number, userId: number, roles: RoleCode[], reason: SessionEndReason = "USER") {
  if (isManager(roles)) throw forbidden("Managers do not end field work.");
  const open = await prisma.locationSession.findFirst({
    where: { tenantId, userId, status: "ACTIVE" },
  });
  if (!open) throw notFound("No field work is running.");
  const settings = await settingsFor(tenantId);
  const session = await prisma.locationSession.update({
    where: { id: open.id },
    data: { status: "ENDED", endedAt: new Date(), endedReason: reason },
  });
  return publicSession(session, settings);
}

export async function getSession(tenantId: number, userId: number) {
  const current = await maybeAutoClose(tenantId, userId);
  if (current.session) {
    return {
      ...publicSession(current.session, current.settings),
      autoClosed: current.autoClosed,
    };
  }
  return {
    id: null,
    status: "IDLE",
    startedAt: null,
    endedAt: null,
    endedReason: null,
    liveLocationEnabled: current.settings.liveLocationEnabled,
    liveStreaming: false,
    lastLat: null,
    lastLng: null,
    lastAccuracy: null,
    lastSeenAt: null,
    lastSeenAgeSeconds: null,
    pointCount: 0,
    intervalSeconds: current.settings.intervalSeconds,
    autoCloseHours: current.settings.autoCloseHours,
    durationMinutes: 0,
    autoClosed: false,
  };
}

export async function addPoints(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  sessionId: number;
  points: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    mocked?: boolean;
    battery?: number;
    capturedAt?: string;
  }[];
}) {
  if (isManager(input.roles)) throw forbidden();
  const current = await maybeAutoClose(input.tenantId, input.userId);
  if (current.autoClosed || !current.session || current.session.status !== "ACTIVE") {
    throw badRequest("Field work is not running.", "NO_SESSION");
  }
  if (current.session.id !== input.sessionId) {
    throw badRequest("This field session is no longer active.", "NO_SESSION");
  }
  if (!current.settings.liveLocationEnabled) {
    throw badRequest("Live location is Off. Field work is only a clock.", "LIVE_OFF", {
      liveLocationEnabled: false,
    });
  }
  if (!input.points.length) {
    return { stored: 0, accepted: 0, warning: null, session: publicSession(current.session, current.settings) };
  }

  const receivedAt = new Date();
  let lastLat = asNumber(current.session.lastLat);
  let lastLng = asNumber(current.session.lastLng);
  let stored = 0;
  let weakest = 0;

  for (const point of input.points) {
    weakest = Math.max(weakest, point.accuracy ?? 0);
    const farEnough =
      lastLat == null ||
      lastLng == null ||
      haversineMeters({ lat: lastLat, lng: lastLng }, { lat: point.lat, lng: point.lng }) >= current.settings.moveMeters;
    lastLat = point.lat;
    lastLng = point.lng;
    if (!farEnough) continue;
    await prisma.locationLog.create({
      data: {
        tenantId: input.tenantId,
        sessionId: current.session.id,
        userId: input.userId,
        lat: point.lat,
        lng: point.lng,
        accuracy: point.accuracy,
        speed: point.speed,
        heading: point.heading,
        mocked: point.mocked ?? false,
        battery: point.battery,
        capturedAt: point.capturedAt ? new Date(point.capturedAt) : receivedAt,
        receivedAt,
      },
    });
    stored += 1;
  }

  const last = input.points[input.points.length - 1];
  const session = await prisma.locationSession.update({
    where: { id: current.session.id },
    data: {
      lastLat: last.lat,
      lastLng: last.lng,
      lastAccuracy: last.accuracy,
      lastSeenAt: receivedAt,
      pointCount: { increment: stored },
    },
  });

  return {
    stored,
    accepted: input.points.length,
    warning: weakest > 80 ? "WEAK_GPS" : null,
    session: publicSession(session, current.settings),
  };
}

export async function teamLocations(tenantId: number, roles: RoleCode[]) {
  if (!isManager(roles)) throw forbidden();
  const settings = await settingsFor(tenantId);
  const people = await prisma.user.findMany({
    where: { tenantId, roles: { some: { role: { code: "SALES_EXECUTIVE" } } } },
    include: {
      locationSessions: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return people.map((user) => {
    const session = user.locationSessions[0];
    const active = session?.status === "ACTIVE";
    const liveStreaming = settings.liveLocationEnabled && active;
    return {
      userId: user.id,
      name: user.name,
      phone: user.phone,
      fieldStatus: session ? session.status : "IDLE",
      startedAt: session?.startedAt ?? null,
      lastSeenAt: session?.lastSeenAt ?? null,
      lastSeenAgeSeconds: ageSeconds(session?.lastSeenAt ?? null),
      liveStreaming,
      lastLat: liveStreaming ? asNumber(session?.lastLat) : null,
      lastLng: liveStreaming ? asNumber(session?.lastLng) : null,
      durationMinutes: session ? durationMinutes(session.startedAt, session.endedAt) : 0,
    };
  });
}
