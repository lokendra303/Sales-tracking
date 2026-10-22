/** Sync parse of Google/Apple/geo links or plain "lat, lng" (no short-link expand). */

export type MapsPin = { lat: number; lng: number; label: string };

function asCoord(value: string) {
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function pairHit(a: string, b: string, label?: string): MapsPin | null {
  const lat = asCoord(a);
  const lng = asCoord(b);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng, label: label?.trim() || `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
}

export function parseMapsLink(raw: string): MapsPin | null {
  let text = raw.trim();
  if (!text) return null;
  try {
    text = decodeURIComponent(text.replace(/\+/g, "%2B"));
  } catch {
    // keep raw
  }

  const plain = text.match(/^(-?\d+(?:[.,]\d+)?)\s*[,/\s]\s*\+?(-?\d+(?:[.,]\d+)?)$/);
  if (plain) return pairHit(plain[1], plain[2]);

  const at = text.match(/@(-?\d+(?:[.,]\d+)?)\s*,\s*\+?(-?\d+(?:[.,]\d+)?)/);
  if (at) return pairHit(at[1], at[2]);

  // Expanded short links: /maps/search/28.457763,+77.460228
  const pathCoords = text.match(
    /\/maps\/(?:search|dir)\/(-?\d+(?:[.,]\d+)?)\s*,\s*\+?(-?\d+(?:[.,]\d+)?)/i,
  );
  if (pathCoords) return pairHit(pathCoords[1], pathCoords[2]);

  const threed = [...text.matchAll(/!3d(-?\d+(?:[.,]\d+)?)!4d(-?\d+(?:[.,]\d+)?)/g)];
  if (threed.length) {
    const last = threed[threed.length - 1]!;
    const hit = pairHit(last[1], last[2]);
    if (hit) return hit;
  }

  const geo = text.match(/geo:(-?\d+(?:[.,]\d+)?)\s*,\s*\+?(-?\d+(?:[.,]\d+)?)/i);
  if (geo) return pairHit(geo[1], geo[2]);

  try {
    if (/^https?:\/\//i.test(text)) {
      const u = new URL(text);
      for (const key of ["q", "query", "destination", "daddr", "sll", "ll", "center"]) {
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
    // ignore
  }

  const loose = text.match(/(?:^|[^\d.-])(-?\d{1,2}[.,]\d{3,})\s*,\s*\+?(-?\d{1,3}[.,]\d{3,})(?:[^\d.]|$)/);
  if (loose) return pairHit(loose[1], loose[2]);

  return null;
}

export function looksLikeMapsLink(text: string) {
  const q = text.trim();
  return (
    /https?:\/\/(www\.)?(google\.|maps\.google\.|goo\.gl|maps\.app\.goo\.gl)/i.test(q) ||
    /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(q) ||
    /^geo:/i.test(q) ||
    /maps\.apple\.com/i.test(q)
  );
}
