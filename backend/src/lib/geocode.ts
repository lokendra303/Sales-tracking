export type GeoPoint = { lat: number; lng: number; label: string };

export type GeoHit = GeoPoint & { kind: string };

const broadKinds = new Set([
  "administrative",
  "city",
  "continent",
  "country",
  "county",
  "district",
  "municipality",
  "postcode",
  "province",
  "region",
  "state",
  "state_district",
  "town",
  "village",
]);

type NominatimRow = {
  lat?: string;
  lon?: string;
  display_name?: string;
  type?: string;
  addresstype?: string;
  category?: string;
};

function asHit(row: NominatimRow): GeoHit | null {
  if (!row.lat || !row.lon) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    label: row.display_name ?? "",
    kind: row.addresstype || row.type || row.category || "",
  };
}

export function isPrecisePlace(kind: string) {
  return kind !== "" && !broadKinds.has(kind);
}

async function nominatim(query: string, country?: string) {
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    q: query,
  });
  if (country) params.set("countrycodes", country);
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "SalesTrack/1.0 (field sales)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as NominatimRow[];
  return rows.map(asHit).filter((hit): hit is GeoHit => hit != null);
}

export async function searchPlaces(query: string): Promise<GeoHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const local = await nominatim(q, "in");
    const hits = local.length ? local : await nominatim(q);
    return hits.sort((a, b) => Number(isPrecisePlace(b.kind)) - Number(isPrecisePlace(a.kind)));
  } catch {
    return [];
  }
}

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const hits = await searchPlaces(query);
  const precise = hits.find((hit) => isPrecisePlace(hit.kind));
  if (!precise) return null;
  return { lat: precise.lat, lng: precise.lng, label: precise.label };
}

export function parseCoord(value: unknown, min: number, max: number) {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}
