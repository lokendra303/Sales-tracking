import { Linking, Platform } from "react-native";

export function money(value: number | null | undefined) {
  if (value == null) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}

export function isoDay(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function tomorrowDay() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return isoDay(next);
}

export function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function waLink(phone: string) {
  const n = digits(phone);
  const withCountry = n.length === 10 ? `91${n}` : n;
  return `https://wa.me/${withCountry}`;
}

async function openUrl(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    // A missing phone, WhatsApp, or map app must not close SalesTrack.
  }
}

export async function openCall(phone: string) {
  await openUrl(`tel:${digits(phone)}`);
}

export async function openWhatsApp(phone: string) {
  await openUrl(waLink(phone));
}

function asCoord(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Stable Google/Apple Maps URL that drops a pin on the GPS (not a vague address search). */
export function mapsPinUrl(
  lat?: number | string | null,
  lng?: number | string | null,
  label?: string | null,
) {
  const la = asCoord(lat);
  const lo = asCoord(lng);
  if (la != null && lo != null && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
    // Exact lat,lng only — shop name in the query can make Maps snap to a wrong POI.
    const pin = `${la.toFixed(7)},${lo.toFixed(7)}`;
    if (Platform.OS === "ios") {
      const q = encodeURIComponent(label?.trim() || pin);
      return `https://maps.apple.com/?ll=${pin}&q=${q}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin)}`;
  }
  const place = label?.trim();
  if (place) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  }
  return null;
}

/** Open maps centered on the exact GPS pin (no turn-by-turn). */
export async function openMapPin(
  lat?: number | string | null,
  lng?: number | string | null,
  label?: string | null,
) {
  const url = mapsPinUrl(lat, lng, label);
  if (url) await openUrl(url);
}

/** Open maps with turn-by-turn to the shop pin (or address if no GPS). */
export async function openNavigate(
  lat?: number | string | null,
  lng?: number | string | null,
  address?: string | null,
) {
  const la = asCoord(lat);
  const lo = asCoord(lng);
  if (la != null && lo != null && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
    const pin = `${la.toFixed(7)},${lo.toFixed(7)}`;
    if (Platform.OS === "android") {
      // geo:lat,lng?q=lat,lng pins the exact GPS (label in q= can snap to a wrong place).
      await openUrl(`geo:${pin}?q=${encodeURIComponent(pin)}`);
      return;
    }
    if (Platform.OS === "ios") {
      await openUrl(`https://maps.apple.com/?daddr=${pin}&dirflg=d`);
      return;
    }
    await openUrl(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pin)}&travelmode=driving`,
    );
    return;
  }
  const place = address?.trim();
  if (place) {
    await openUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`);
  }
}

export function tempColor(temp: string) {
  if (temp === "HOT") return { bg: "#FEE2E2", text: "#B91C1C", label: "Hot" };
  if (temp === "COLD") return { bg: "#E0E7FF", text: "#3730A3", label: "Cold" };
  return { bg: "#FEF3C7", text: "#92400E", label: "Warm" };
}

export function ageLabel(seconds: number | null | undefined) {
  if (seconds == null) return "No GPS yet";
  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  return `${Math.max(1, Math.round(seconds / 3600))} h ago`;
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    NEW: "New",
    ASSIGNED: "Assigned",
    CONTACTED: "Contacted",
    FOLLOW_UP: "Follow-up",
    INTERESTED: "Interested",
    NEGOTIATION: "Negotiation",
    WON: "Won",
    LOST: "Lost",
  };
  return map[status] ?? status;
}

export function leadStateLabel(lead: { status: string; approvalStatus?: string }) {
  if (lead.approvalStatus === "PENDING") return "Waiting for approval";
  if (lead.approvalStatus === "REJECTED") return "Rejected";
  return statusLabel(lead.status);
}

export function leadIsOpen(lead: { approvalStatus?: string }) {
  return !lead.approvalStatus || lead.approvalStatus === "APPROVED";
}
