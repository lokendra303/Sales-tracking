import type { Ionicons } from "@expo/vector-icons";
import type { Lead } from "@/lib/api";
import { colors } from "@/lib/theme";

export type StageBucket = "todo" | "later" | "done" | "waiting";
export type StageTone = "blue" | "green" | "amber" | "red" | "slate";

export const stageColors: Record<StageTone, { fg: string; bg: string }> = {
  blue: { fg: colors.blue, bg: colors.blueSoft },
  green: { fg: colors.green, bg: colors.greenSoft },
  amber: { fg: colors.amber, bg: colors.amberSoft },
  red: { fg: colors.red, bg: colors.redSoft },
  slate: { fg: colors.muted, bg: "#F1F5F9" },
};

export type LeadStage = {
  bucket: StageBucket;
  label: string;
  tone: StageTone;
  icon: keyof typeof Ionicons.glyphMap;
  /** Lower comes first inside a bucket. */
  rank: number;
  /** Time used to order items with the same rank. */
  at: number;
  canVisit: boolean;
};

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clock(date: Date) {
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function day(date: Date, now: Date) {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(date, tomorrow)) return `tomorrow ${clock(date)}`;
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function followName(type: string) {
  if (type === "CALL") return "Call";
  if (type === "VISIT") return "Visit";
  if (type === "WHATSAPP") return "WhatsApp";
  return "Follow-up";
}

export function leadStage(lead: Lead, now = new Date()): LeadStage {
  if (lead.approvalStatus === "PENDING") {
    return { bucket: "waiting", label: "Waiting for manager approval", tone: "slate", icon: "hourglass-outline", rank: 0, at: 0, canVisit: false };
  }
  if (lead.approvalStatus === "REJECTED") {
    return { bucket: "done", label: "Rejected by manager", tone: "red", icon: "close-circle", rank: 3, at: 0, canVisit: false };
  }
  if (lead.status === "WON") {
    return { bucket: "done", label: "Sale done · now a customer", tone: "green", icon: "checkmark-circle", rank: 1, at: 0, canVisit: false };
  }
  if (lead.status === "LOST") {
    return { bucket: "done", label: "Closed · not interested", tone: "slate", icon: "remove-circle", rank: 2, at: 0, canVisit: false };
  }
  if (lead.status === "NEGOTIATION") {
    return { bucket: "todo", label: "Negotiation · close the deal", tone: "amber", icon: "swap-horizontal", rank: 1, at: 0, canVisit: true };
  }
  if (lead.status === "INTERESTED") {
    return { bucket: "todo", label: "Interested · keep following up", tone: "blue", icon: "flame", rank: 2, at: 0, canVisit: true };
  }

  const visit = lead.lastVisit;
  const visitAt = visit ? new Date(visit.checkedInAt) : null;
  if (visit?.status === "IN_PROGRESS") {
    return { bucket: "todo", label: "Visit started · finish it", tone: "blue", icon: "time", rank: 0, at: 0, canVisit: true };
  }

  const follow = lead.nextFollowUp;
  const due = follow ? new Date(follow.dueAt) : null;
  const visitedToday = Boolean(visit?.status === "COMPLETED" && visitAt && sameDay(visitAt, now));

  if (visitedToday) {
    const how = visit?.outcome === "UNAVAILABLE" ? "shop closed / owner away" : "met";
    const next = due ? ` · next ${day(due, now)}` : "";
    return { bucket: "done", label: `Visited today · ${how}${next}`, tone: "green", icon: "checkmark-circle", rank: 0, at: -(visitAt?.getTime() ?? 0), canVisit: false };
  }
  if (due && due.getTime() < now.getTime() && !sameDay(due, now)) {
    return { bucket: "todo", label: `${followName(follow!.type)} overdue · was ${day(due, now)}`, tone: "red", icon: "alert-circle", rank: 1, at: due.getTime(), canVisit: true };
  }
  if (due && sameDay(due, now)) {
    return { bucket: "todo", label: `${followName(follow!.type)} today · ${clock(due)}`, tone: "amber", icon: "alarm", rank: 2, at: due.getTime(), canVisit: true };
  }
  if (due) {
    return { bucket: "later", label: `${followName(follow!.type)} ${day(due, now)}`, tone: "slate", icon: "calendar", rank: 0, at: due.getTime(), canVisit: true };
  }
  if (lead.status === "NEW" || lead.status === "ASSIGNED") {
    return { bucket: "todo", label: "New · not visited yet", tone: "blue", icon: "sparkles", rank: 3, at: new Date(lead.createdAt).getTime(), canVisit: true };
  }
  return { bucket: "todo", label: "No next step · plan a visit or call", tone: "amber", icon: "help-circle", rank: 4, at: 0, canVisit: true };
}

export function sortByStage(a: LeadStage, b: LeadStage) {
  return a.rank - b.rank || a.at - b.at;
}
