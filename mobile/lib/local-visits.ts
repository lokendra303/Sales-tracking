import { persistGet, persistSet } from "./persist";

export type LocalVisit = {
  localId: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  placeLat: number | null;
  placeLng: number | null;
  leadId?: number;
  customerId?: number;
  beatStopId?: number;
  checkinLat: number;
  checkinLng: number;
  checkinAccuracy?: number;
  checkedInAt: string;
  distanceMeters: number | null;
  verified: boolean;
  photoUri: string | null;
  photoLat: number | null;
  photoLng: number | null;
  photoAccuracy?: number;
  photoCapturedAt: string | null;
  notes: string;
  outcome: "SUCCESS" | "UNAVAILABLE" | null;
  checkInJobId: string;
  photoJobId: string | null;
  completeJobId: string | null;
};

async function readAll() {
  const raw = await persistGet("localVisits");
  return raw ? (JSON.parse(raw) as LocalVisit[]) : [];
}

async function writeAll(visits: LocalVisit[]) {
  await persistSet("localVisits", JSON.stringify(visits.slice(-40)));
}

export async function readLocalVisits() {
  return readAll();
}

export async function getLocalVisit(localId: string) {
  const visits = await readAll();
  return visits.find((visit) => visit.localId === localId) ?? null;
}

export async function saveLocalVisit(visit: LocalVisit) {
  const visits = await readAll();
  const next = visits.filter((item) => item.localId !== visit.localId);
  next.push(visit);
  await writeAll(next);
  return visit;
}

export async function pruneLocalVisits(remaining: Set<string>, results: Record<string, number>) {
  const visits = await readAll();
  const keep = visits.filter((visit) => {
    const ids = [visit.checkInJobId, visit.photoJobId, visit.completeJobId].filter((id): id is string => Boolean(id));
    if (ids.some((id) => remaining.has(id))) return true;
    const checkIn = results[visit.checkInJobId];
    if (checkIn != null && checkIn < 0) return false;
    if (!visit.outcome) return true;
    return !(checkIn != null && checkIn > 0);
  });
  if (keep.length !== visits.length) await writeAll(keep);
}
