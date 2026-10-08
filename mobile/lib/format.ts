import { Linking } from "react-native";

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

export async function openCall(phone: string) {
  await Linking.openURL(`tel:${digits(phone)}`);
}

export async function openWhatsApp(phone: string) {
  await Linking.openURL(waLink(phone));
}

export async function openNavigate(lat?: number | null, lng?: number | null, address?: string | null) {
  if (lat != null && lng != null) {
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    return;
  }
  if (address) {
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
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
    ASSIGNED: "New",
    CONTACTED: "Follow-up",
    FOLLOW_UP: "Follow-up",
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
