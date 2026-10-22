/** Build a Google Maps URL that identifies a shop pin correctly. */
export function mapsUrl(input: {
  latitude?: number | string | null;
  longitude?: number | string | null;
  address?: string | null;
  city?: string | null;
  name?: string | null;
  /** "pin" shows the place; "dir" opens driving directions. Default pin. */
  mode?: "pin" | "dir";
}) {
  const la =
    input.latitude == null || input.latitude === ""
      ? null
      : Number(String(input.latitude).trim().replace(",", "."));
  const lo =
    input.longitude == null || input.longitude === ""
      ? null
      : Number(String(input.longitude).trim().replace(",", "."));
  const hasPin =
    la != null &&
    lo != null &&
    Number.isFinite(la) &&
    Number.isFinite(lo) &&
    Math.abs(la) <= 90 &&
    Math.abs(lo) <= 180;

  if (hasPin) {
    // Exact lat,lng only — do not prefix a shop name (@name) or Maps may snap to a nearby POI.
    const pin = `${la!.toFixed(7)},${lo!.toFixed(7)}`;
    if (input.mode === "dir") {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pin)}&travelmode=driving`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin)}`;
  }

  const q = [input.address, input.city].filter(Boolean).join(", ").trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
