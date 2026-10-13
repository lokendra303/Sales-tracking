import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Badge, Card, Chip, EmptyState } from "@/components/ui";
import { api, type Visit } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isoDay, money, when } from "@/lib/format";
import { colors, typo } from "@/lib/theme";

type Period = "day" | "7" | "30";
type StatusFilter = "all" | "completed" | "missed" | "in_progress";

const statusChips: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "missed", label: "Missed" },
  { id: "in_progress", label: "In progress" },
];

function visitKind(visit: Visit): Exclude<StatusFilter, "all"> {
  if (visit.status === "IN_PROGRESS") return "in_progress";
  return visit.outcome === "UNAVAILABLE" ? "missed" : "completed";
}

function shiftDay(day: Date, by: number) {
  const next = new Date(day);
  next.setDate(next.getDate() + by);
  return next;
}

function dayLabel(day: Date) {
  const today = isoDay();
  const key = isoDay(day);
  if (key === today) return "Today";
  if (key === isoDay(shiftDay(new Date(), -1))) return "Yesterday";
  return day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function badgeFor(visit: Visit) {
  if (visit.managerConfirmedAt) return { label: "Confirmed", tone: "green" as const };
  const kind = visitKind(visit);
  if (kind === "in_progress") return { label: "In progress", tone: "blue" as const };
  if (kind === "missed") return { label: "Missed", tone: "amber" as const };
  return { label: "Completed", tone: "green" as const };
}

/** Date + status filtered visit list. Managers pass `userId` from the executive filter. */
export function VisitHistory({ userId, showPerson }: { userId?: number; showPerson?: boolean }) {
  const { accessToken } = useAuth();
  const [period, setPeriod] = useState<Period>("day");
  const [day, setDay] = useState(() => new Date());
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const from = period === "day" ? isoDay(day) : isoDay(shiftDay(new Date(), -(Number(period) - 1)));
  const to = period === "day" ? isoDay(day) : isoDay();

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setFailed(false);
    const who = userId ? `&userId=${userId}` : "";
    api<Visit[]>(`/visits?from=${from}&to=${to}${who}`, { token: accessToken })
      .then(setRows)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [accessToken, from, to, userId]);

  useFocusEffect(load);

  const counts = { all: rows.length, completed: 0, missed: 0, in_progress: 0 };
  for (const visit of rows) counts[visitKind(visit)] += 1;
  const shown = status === "all" ? rows : rows.filter((visit) => visitKind(visit) === status);
  const isToday = isoDay(day) === isoDay();

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.scroller}>
        <Chip label="By day" on={period === "day"} onPress={() => setPeriod("day")} />
        <Chip label="Last 7 days" on={period === "7"} onPress={() => setPeriod("7")} />
        <Chip label="Last 30 days" on={period === "30"} onPress={() => setPeriod("30")} />
      </ScrollView>
      {period === "day" ? (
        <View style={styles.dayRow}>
          <Pressable style={styles.arrow} onPress={() => setDay((d) => shiftDay(d, -1))} accessibilityLabel="Previous day">
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.dayText}>{dayLabel(day)}</Text>
          <Pressable
            style={[styles.arrow, isToday && styles.arrowOff]}
            onPress={() => setDay((d) => shiftDay(d, 1))}
            disabled={isToday}
            accessibilityLabel="Next day"
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.scroller}>
        {statusChips.map((chip) => (
          <Chip key={chip.id} label={`${chip.label} ${counts[chip.id]}`} on={status === chip.id} onPress={() => setStatus(chip.id)} />
        ))}
      </ScrollView>

      {loading && !rows.length ? (
        <ActivityIndicator color={colors.blue} />
      ) : failed && !rows.length ? (
        <EmptyState icon="cloud-offline-outline" text="Could not load visits. Pull down or come back when online." />
      ) : !shown.length ? (
        <EmptyState icon="calendar-outline" text="No visits for this date and filter." />
      ) : (
        shown.map((visit) => {
          const badge = badgeFor(visit);
          return (
            <Pressable key={visit.id} onPress={() => router.push(`/visit/${visit.id}`)}>
              <Card>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{visit.name}</Text>
                    <Text style={typo.muted}>
                      {showPerson ? `${visit.userName || "Sales"} · ` : ""}
                      Started {when(visit.checkedInAt)}
                    </Text>
                    {visit.checkedOutAt ? <Text style={typo.muted}>Finished {when(visit.checkedOutAt)}</Text> : null}
                    <Text style={typo.muted}>
                      {visit.checkinDistanceMeters != null ? `Check-in ${visit.checkinDistanceMeters} m from pin` : "Check-in GPS saved"}
                      {visit.finishDistanceMeters != null ? ` · Finish ${visit.finishDistanceMeters} m` : ""}
                    </Text>
                    <Text style={typo.muted}>{visit.hasPhoto ? "Photo uploaded" : "No photo"}</Text>
                    {visit.saleAmount != null ? <Text style={styles.sale}>Sale {money(visit.saleAmount)}</Text> : null}
                  </View>
                  <Badge label={badge.label} tone={badge.tone} />
                </View>
              </Card>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  scroller: { flexGrow: 0, flexShrink: 0 },
  chips: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowOff: { opacity: 0.35 },
  arrowText: { fontSize: 26, fontWeight: "800", color: colors.blue, marginTop: -2 },
  dayText: { flex: 1, textAlign: "center", fontWeight: "800", fontSize: 16, color: colors.text },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  name: { fontWeight: "800", color: colors.text, fontSize: 16 },
  sale: { color: colors.green, fontWeight: "800" },
});
