import type { VisitOutcome, VisitStatus } from "@prisma/client";

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return Math.round(2 * earth * Math.asin(Math.min(1, Math.sqrt(h))));
}

export function dayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function tomorrowMorning(now = new Date()) {
  const due = new Date(now);
  due.setDate(due.getDate() + 1);
  due.setHours(10, 0, 0, 0);
  return due;
}

export function asNumber(value: unknown) {
  return value == null ? null : Number(value);
}

export function publicVisit(row: {
  id: number;
  status: VisitStatus;
  outcome: VisitOutcome | null;
  notes: string | null;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  checkinLat: unknown;
  checkinLng: unknown;
  checkinAccuracy: unknown;
  distanceMeters: number | null;
  verified: boolean;
  photoPath: string | null;
  photoLat: unknown;
  photoLng: unknown;
  photoAccuracy: unknown;
  photoCapturedAt: Date | null;
  photoReceivedAt: Date | null;
  managerConfirmedAt: Date | null;
  saleAmount?: unknown;
  collectionAmount?: unknown;
  leadId: number | null;
  customerId: number | null;
  beatStopId: number | null;
  sales?: { id: number }[];
  user?: { id: number; name: string } | null;
  lead?: { id: number; name: string; phone: string; address: string | null; city: string | null; latitude: unknown; longitude: unknown } | null;
  customer?: { id: number; name: string; phone: string; address: string | null; city: string | null; latitude: unknown; longitude: unknown } | null;
}) {
  const place = row.lead ?? row.customer;
  return {
    id: row.id,
    status: row.status,
    outcome: row.outcome,
    notes: row.notes,
    name: place?.name ?? "Visit",
    phone: place?.phone ?? null,
    address: place?.address ?? null,
    city: place?.city ?? null,
    placeLat: asNumber(place?.latitude),
    placeLng: asNumber(place?.longitude),
    leadId: row.leadId,
    customerId: row.customerId,
    beatStopId: row.beatStopId,
    userName: row.user?.name ?? null,
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt,
    checkinLat: asNumber(row.checkinLat),
    checkinLng: asNumber(row.checkinLng),
    checkinAccuracy: asNumber(row.checkinAccuracy),
    distanceMeters: row.distanceMeters,
    verified: row.verified,
    hasPhoto: Boolean(row.photoPath),
    photoLat: asNumber(row.photoLat),
    photoLng: asNumber(row.photoLng),
    photoAccuracy: asNumber(row.photoAccuracy),
    photoCapturedAt: row.photoCapturedAt,
    photoReceivedAt: row.photoReceivedAt,
    managerConfirmedAt: row.managerConfirmedAt,
    saleAmount: asNumber(row.saleAmount),
    collectionAmount: asNumber(row.collectionAmount),
    saleId: row.sales?.[0]?.id ?? null,
  };
}
