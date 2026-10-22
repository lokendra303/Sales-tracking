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

function asCoord(value: string) {
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function coordHit(lat: number, lng: number, label?: string): GeoHit | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return {
    lat,
    lng,
    label: label?.trim() || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    kind: "coordinates",
  };
}

function pairHit(a: string, b: string, label?: string) {
  const lat = asCoord(a);
  const lng = asCoord(b);
  if (lat == null || lng == null) return null;
  return coordHit(lat, lng, label);
}

/** True when the text is (or contains) a maps / share URL. */
export function looksLikeMapsLink(text: string) {
  const q = text.trim();
  return (
    /https?:\/\/(www\.)?(google\.|maps\.google\.|goo\.gl|maps\.app\.goo\.gl)/i.test(q) ||
    /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(q) ||
    /^geo:/i.test(q) ||
    /maps\.apple\.com/i.test(q)
  );
}

/**
 * Pull lat/lng out of a Google / Apple / geo link (or plain "lat, lng").
 * Sync — does not follow short-link redirects.
 */
export function parseMapsLink(raw: string): GeoHit | null {
  const text = raw.trim();
  if (!text) return null;

  const plain = text.match(/^(-?\d+(?:[.,]\d+)?)\s*[,/\s]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (plain) return pairHit(plain[1], plain[2]);

  const at = text.match(/@(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)/);
  if (at) return pairHit(at[1], at[2]);

  // Google embed / place data: !3dLAT!4dLNG (prefer last — usually the place, not the camera)
  const threed = [...text.matchAll(/!3d(-?\d+(?:[.,]\d+)?)!4d(-?\d+(?:[.,]\d+)?)/g)];
  if (threed.length) {
    const last = threed[threed.length - 1]!;
    const hit = pairHit(last[1], last[2]);
    if (hit) return hit;
  }

  const geo = text.match(/geo:(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)/i);
  if (geo) return pairHit(geo[1], geo[2]);

  try {
    const href = /^https?:\/\//i.test(text) ? text : text.includes("://") ? text : null;
    if (href) {
      const u = new URL(href);
      for (const key of ["q", "query", "destination", "destination_place_id", "daddr", "sll", "ll", "center"]) {
        const v = u.searchParams.get(key);
        if (!v) continue;
        const coords = v.match(/(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)/);
        if (coords) {
          const hit = pairHit(coords[1], coords[2]);
          if (hit) return hit;
        }
      }
      // Apple Maps: ?ll=lat,lng
      const ll = u.searchParams.get("ll");
      if (ll) {
        const parts = ll.split(",");
        if (parts.length >= 2) {
          const hit = pairHit(parts[0]!, parts[1]!);
          if (hit) return hit;
        }
      }
    }
  } catch {
    // not a URL — keep scanning
  }

  // Loose "28.61, 77.20" anywhere in pasted text
  const loose = text.match(/(?:^|[^\d.-])(-?\d{1,2}[.,]\d{3,})\s*,\s*(-?\d{1,3}[.,]\d{3,})(?:[^\d.]|$)/);
  if (loose) return pairHit(loose[1], loose[2]);

  return null;
}

/** Place name from /maps/place/Name/@… when coords are missing. */
export function extractMapsPlaceName(raw: string): string | null {
  const m = raw.match(/\/maps\/place\/([^/@?#]+)/i);
  if (!m?.[1]) return null;
  try {
    const name = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
    return name.length >= 3 ? name : null;
  } catch {
    return null;
  }
}

async function expandMapsUrl(url: string): Promise<string> {
  let href = url.trim();
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
  try {
    const response = await fetch(href, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html",
        "User-Agent": "SalesTrack/1.0 (field sales)",
      },
      signal: AbortSignal.timeout(10000),
    });
    return response.url || href;
  } catch {
    return href;
  }
}

/**
 * Resolve a pasted Google Maps short/full link (or plain coords) to a pin.
 * Follows maps.app.goo.gl / goo.gl redirects when needed.
 */
export async function resolveMapsLink(raw: string): Promise<GeoHit | null> {
  const q = raw.trim();
  if (!q) return null;

  const direct = parseMapsLink(q);
  if (direct) return direct;

  if (!looksLikeMapsLink(q)) return null;

  const expanded = await expandMapsUrl(q);
  const fromExpanded = parseMapsLink(expanded);
  if (fromExpanded) return fromExpanded;

  const place = extractMapsPlaceName(expanded);
  if (place) {
    const hits = await nominatim(place, "in");
    const precise = hits.find((hit) => isPrecisePlace(hit.kind)) ?? hits[0];
    if (precise) return precise;
  }
  return null;
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

  const fromMaps = await resolveMapsLink(q);
  if (fromMaps) return [fromMaps];

  // Strip a maps URL wrapper if someone pasted link + typed address, prefer address text
  const placeName = extractMapsPlaceName(q);
  const searchQ = looksLikeMapsLink(q) && placeName ? placeName : q;
  if (looksLikeMapsLink(q) && !placeName) return [];

  try {
    const local = await nominatim(searchQ, "in");
    const hits = local.length ? local : await nominatim(searchQ);
    return hits.sort((a, b) => Number(isPrecisePlace(b.kind)) - Number(isPrecisePlace(a.kind)));
  } catch {
    return [];
  }
}

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const hits = await searchPlaces(query);
  if (!hits.length) return null;
  const precise = hits.find((hit) => isPrecisePlace(hit.kind)) ?? hits[0];
  if (!precise) return null;
  return { lat: precise.lat, lng: precise.lng, label: precise.label };
}

export function parseCoord(value: unknown, min: number, max: number) {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}
