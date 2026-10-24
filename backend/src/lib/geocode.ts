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
  let text = raw.trim();
  if (!text) return null;
  try {
    text = decodeURIComponent(text.replace(/\+/g, "%2B"));
  } catch {
    // keep raw text
  }

  const plain = text.match(/^(-?\d+(?:[.,]\d+)?)\s*[,/\s]\s*\+?(-?\d+(?:[.,]\d+)?)$/);
  if (plain) return pairHit(plain[1], plain[2]);

  const at = text.match(/@(-?\d+(?:[.,]\d+)?)\s*,\s*\+?(-?\d+(?:[.,]\d+)?)/);
  if (at) return pairHit(at[1], at[2]);

  // Short-link expand often lands on: /maps/search/28.457763,+77.460228
  const pathCoords = text.match(
    /\/maps\/(?:search|dir)\/(-?\d+(?:[.,]\d+)?)\s*,\s*\+?(-?\d+(?:[.,]\d+)?)/i,
  );
  if (pathCoords) return pairHit(pathCoords[1], pathCoords[2]);

  // Google embed / place data: !3dLAT!4dLNG (prefer last — usually the place, not the camera)
  const threed = [...text.matchAll(/!3d(-?\d+(?:[.,]\d+)?)!4d(-?\d+(?:[.,]\d+)?)/g)];
  if (threed.length) {
    const last = threed[threed.length - 1]!;
    const hit = pairHit(last[1], last[2]);
    if (hit) return hit;
  }

  const geo = text.match(/geo:(-?\d+(?:[.,]\d+)?)\s*,\s*\+?(-?\d+(?:[.,]\d+)?)/i);
  if (geo) return pairHit(geo[1], geo[2]);

  try {
    const href = /^https?:\/\//i.test(text) ? text : text.includes("://") ? text : null;
    if (href) {
      const u = new URL(href);
      for (const key of ["q", "query", "destination", "destination_place_id", "daddr", "sll", "ll", "center"]) {
        const v = u.searchParams.get(key);
        if (!v) continue;
        const coords = v.match(/(-?\d+(?:[.,]\d+)?)\s*,\s*\+?(-?\d+(?:[.,]\d+)?)/);
        if (coords) {
          const hit = pairHit(coords[1], coords[2]);
          if (hit) return hit;
        }
      }
    }
  } catch {
    // not a URL — keep scanning
  }

  // Loose "28.61, 77.20" anywhere in pasted text
  const loose = text.match(/(?:^|[^\d.-])(-?\d{1,2}[.,]\d{3,})\s*,\s*\+?(-?\d{1,3}[.,]\d{3,})(?:[^\d.]|$)/);
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
  const headers = {
    Accept: "text/html,application/xhtml+xml",
    // Browser UA — maps.app.goo.gl often 302s to /maps/search/lat,lng only for real browsers.
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  try {
    const head = await fetch(href, {
      method: "HEAD",
      redirect: "follow",
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (head.url && head.url !== href) return head.url;
  } catch {
    // fall through to GET
  }
  try {
    const response = await fetch(href, {
      method: "GET",
      redirect: "follow",
      headers,
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

const ROMAN: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
  xi: "11",
  xii: "12",
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

function normalizePlace(text: string) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ROMAN[word] ?? word)
    .join(" ");
}

/** Plot / flat / “No. 36 B” lines are rarely on the map. The area and city are what can be found. */
function isUnitPart(part: string) {
  const text = part.trim();
  if (!text) return true;
  if (/^(plot|flat|house|door|shop|survey|khasra|ward|no\.?|number|#)\b/i.test(text)) return true;
  if (/^phase[-\s]*[0-9ivx]+(\s+(plot|block|sector|flat|house))?$/i.test(text)) return true;
  if (/^(no\.?\s*)?\d+[a-z]?(\s*[-/]\s*\d+[a-z]?)?$/i.test(text)) return true;
  return false;
}

function stripHouseNumber(part: string) {
  const stripped = part
    .replace(/^(?:plot|flat|house|shop|door|no\.?|number|#)?\s*[-:]?\s*\d+\s*[a-z]?\s*[,/-]?\s*/i, "")
    .trim();
  if (stripped.length >= 3 && /[a-z]/i.test(stripped) && !/^th\b/i.test(stripped)) return stripped;
  return part.trim();
}

function localityQuery(query: string) {
  const parts = query
    .split(",")
    .map((part) => stripHouseNumber(part.trim()))
    .filter((part) => part.length >= 3 && !isUnitPart(part));
  if (parts.length) return parts.join(", ");
  return query
    .replace(/\b(plot|flat|house|door|shop|survey|khasra)\s*(no\.?|number|#)?\s*[-:]?\s*[a-z0-9/-]+\b/gi, " ")
    .replace(/\b(no\.?|number|#)\s*[-:]?\s*\d+[a-z]?\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/(,\s*){2,}/g, ", ")
    .trim();
}

function numberClash(phrase: string, hay: string) {
  const match = phrase.match(/^(.*\D)\s+(\d+)$/);
  if (!match) return false;
  const stem = match[1]!.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = hay.match(new RegExp(`${stem}\\s+(\\d+)`));
  return Boolean(found && found[1] !== match[2]);
}

function placeScore(query: string, label: string, kind: string) {
  const phrases = localityQuery(query)
    .split(",")
    .map((part) => normalizePlace(part))
    .filter((part) => part.length >= 3);
  const hay = normalizePlace(label);
  if (!hay || !phrases.length) return 0;
  let score = 0;
  for (const phrase of phrases) {
    if (hay.includes(phrase)) score += 12 + phrase.length;
    else if (numberClash(phrase, hay)) score -= 20;
    else {
      const words = phrase.split(" ").filter((word) => word.length > 2);
      score += words.filter((word) => hay.split(" ").includes(word)).length * 2;
    }
  }
  if (/\b(motorway|trunk|highway)\b/.test(kind)) score -= 8;
  return score;
}

function inIndia(label: string) {
  const hay = normalizePlace(label);
  return hay === "india" || hay.startsWith("india ") || hay.includes(" india");
}

function asPhoton(feature: PhotonFeature): GeoHit | null {
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (lat == null || lng == null) return null;
  const props = feature.properties ?? {};
  const label = [props.name, props.housenumber, props.street, props.district, props.city, props.state, props.country]
    .filter(Boolean)
    .join(", ");
  const hit = coordHit(lat, lng, label);
  if (!hit) return null;
  return { ...hit, kind: [props.osm_key, props.osm_value].filter(Boolean).join("/") || hit.kind };
}

/** Fuzzy street search. Nominatim often returns nothing for Indian plot addresses. */
async function photon(query: string) {
  const params = new URLSearchParams({
    q: query,
    limit: "8",
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "SalesTrack/1.0 (field sales)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { features?: PhotonFeature[] };
  return (body.features ?? []).map(asPhoton).filter((hit): hit is GeoHit => hit != null);
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

  const area = localityQuery(searchQ);
  const photonQueries = [...new Set([area, searchQ].filter((item) => item.length >= 3))];
  const batches = await Promise.all([
    ...photonQueries.map((item) => photon(item).catch(() => [] as GeoHit[])),
    nominatim(area.length >= 3 ? area : searchQ, "in").catch(() => [] as GeoHit[]),
  ]);
  let hits = batches.flat();
  if (!hits.length && area !== searchQ) hits = await nominatim(searchQ, "in").catch(() => []);
  if (!hits.length) hits = await nominatim(searchQ).catch(() => []);

  const ranked = hits
    .map((hit) => ({ hit, score: placeScore(searchQ, hit.label, hit.kind) }))
    .sort((a, b) => b.score - a.score);
  const india = ranked.filter((row) => inIndia(row.hit.label));
  const pool = india.some((row) => row.score > 0) ? india : ranked;
  const seen = new Set<string>();
  const out: GeoHit[] = [];
  for (const row of pool) {
    if (row.score <= 0) continue;
    const id = `${row.hit.lat.toFixed(3)},${row.hit.lng.toFixed(3)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row.hit);
    if (out.length >= 5) break;
  }
  return out;
}

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const [best] = await searchPlaces(query);
  if (!best) return null;
  return { lat: best.lat, lng: best.lng, label: best.label };
}

export function parseCoord(value: unknown, min: number, max: number) {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}
