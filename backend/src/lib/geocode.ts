export type GeoPoint = { lat: number; lng: number; label: string };

function asPoint(row: { lat?: string; lon?: string; display_name?: string } | undefined): GeoPoint | null {
  if (!row?.lat || !row?.lon) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: row.display_name ?? "" };
}

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "SalesTrack/1.0 (field sales)" },
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as { lat?: string; lon?: string; display_name?: string }[];
    return asPoint(rows[0]);
  } catch {
    return null;
  }
}

export function parseCoord(value: unknown, min: number, max: number) {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}
