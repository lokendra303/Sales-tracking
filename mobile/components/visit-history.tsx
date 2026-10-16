import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router, useFocusEffect } from "expo-router";
import { BarChart, MixBar, ProgressRing, dayKey, lastNDays } from "@/components/progress-charts";
import { ProofThumb } from "@/components/proof-thumb";
import { Badge, Card, Chip, EmptyState } from "@/components/ui";
import { api, type Visit } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isoDay, money, when } from "@/lib/format";
import { colors, typo } from "@/lib/theme";

type Period = "day" | "7" | "30" | "range";
type StatusFilter = "all" | "completed" | "missed" | "in_progress";
type Picking = "start" | "end" | null;

const statusChips: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "missed", label: "Missed" },
  { id: "in_progress", label: "In progress" },
];

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function todayStart() {
  return startOfDay(new Date());
}

function clampToToday(value: Date) {
  const today = todayStart();
  const day = startOfDay(value);
  return day.getTime() > today.getTime() ? today : day;
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

function rangeLabel(day: Date) {
  return day.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function visitKind(visit: Visit): Exclude<StatusFilter, "all"> {
  if (visit.status === "IN_PROGRESS") return "in_progress";
  return visit.outcome === "UNAVAILABLE" ? "missed" : "completed";
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
  const [day, setDay] = useState(() => todayStart());
  const [startDate, setStartDate] = useState(() => startOfDay(shiftDay(new Date(), -6)));
  const [endDate, setEndDate] = useState(() => todayStart());
  const [picking, setPicking] = useState<Picking>(null);
  const [status, setStatus] = useState<StatusFilter>("completed");
  const [rows, setRows] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [photoOnly, setPhotoOnly] = useState(Boolean(showPerson));

  const range = useMemo(() => {
    if (period === "day") {
      const key = isoDay(clampToToday(day));
      return { from: key, to: key };
    }
    if (period === "range") {
      let start = startOfDay(startDate);
      let end = clampToToday(endDate);
      if (start.getTime() > end.getTime()) [start, end] = [end, start];
      return { from: isoDay(start), to: isoDay(end) };
    }
    return {
      from: isoDay(shiftDay(new Date(), -(Number(period) - 1))),
      to: isoDay(),
    };
  }, [period, day, startDate, endDate]);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setFailed(false);
    const who = userId ? `&userId=${userId}` : "";
    api<Visit[]>(`/visits?from=${range.from}&to=${range.to}${who}`, { token: accessToken })
      .then(setRows)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [accessToken, range.from, range.to, userId]);

  useFocusEffect(load);

  const counts = { all: rows.length, completed: 0, missed: 0, in_progress: 0 };
  for (const visit of rows) counts[visitKind(visit)] += 1;
  const shown = (status === "all" ? rows : rows.filter((visit) => visitKind(visit) === status)).filter(
    (visit) => !photoOnly || visit.hasPhoto,
  );
  const isToday = isoDay(day) === isoDay();
  const doneRate = counts.all ? Math.round((counts.completed / counts.all) * 100) : 0;
  const trendMap: Record<string, number> = {};
  for (const visit of rows) {
    if (visitKind(visit) !== "completed") continue;
    const key = dayKey(visit.checkedInAt);
    trendMap[key] = (trendMap[key] ?? 0) + 1;
  }
  const trendBars =
    period === "day"
      ? []
      : period === "range"
        ? (() => {
            const points = [];
            const cursor = startOfDay(startDate);
            const last = clampToToday(endDate);
            let guard = 0;
            while (cursor.getTime() <= last.getTime() && guard < 31) {
              const key = isoDay(cursor);
              points.push({
                key,
                label: cursor.toLocaleDateString("en-IN", { day: "numeric" }),
                value: trendMap[key] ?? 0,
                color: colors.green,
              });
              cursor.setDate(cursor.getDate() + 1);
              guard += 1;
            }
            return points;
          })()
        : lastNDays(period === "7" ? 7 : 14, trendMap, colors.green);

  function onPick(event: DateTimePickerEvent, value?: Date) {
    if (Platform.OS === "android") setPicking(null);
    if (event.type === "dismissed" || !value) return;
    const picked = clampToToday(value);
    if (picking === "start") {
      setStartDate(picked);
      setEndDate((current) => (picked.getTime() > current.getTime() ? picked : current));
    } else if (picking === "end") {
      setEndDate(picked);
      setStartDate((current) => (picked.getTime() < current.getTime() ? picked : current));
    }
  }

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.scroller}>
        <Chip label="By day" on={period === "day"} onPress={() => setPeriod("day")} />
        <Chip label="Last 7 days" on={period === "7"} onPress={() => setPeriod("7")} />
        <Chip label="Last 30 days" on={period === "30"} onPress={() => setPeriod("30")} />
        <Chip label="Custom dates" on={period === "range"} onPress={() => setPeriod("range")} />
      </ScrollView>

      {period === "day" ? (
        <View style={styles.dayRow}>
          <Pressable style={styles.arrow} onPress={() => setDay((d) => shiftDay(d, -1))} accessibilityLabel="Previous day">
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.dayText}>{dayLabel(day)}</Text>
          <Pressable
            style={[styles.arrow, isToday && styles.arrowOff]}
            onPress={() => setDay((d) => clampToToday(shiftDay(d, 1)))}
            disabled={isToday}
            accessibilityLabel="Next day"
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      ) : null}

      {period === "range" ? (
        <View style={styles.rangeBox}>
          <Text style={styles.rangeHint}>Choose start and end. End date cannot be after today.</Text>
          <View style={styles.rangeRow}>
            <Pressable style={styles.dateBtn} onPress={() => setPicking("start")}>
              <Text style={styles.dateLabel}>Start date</Text>
              <Text style={styles.dateValue}>{rangeLabel(startDate)}</Text>
            </Pressable>
            <Pressable style={styles.dateBtn} onPress={() => setPicking("end")}>
              <Text style={styles.dateLabel}>End date</Text>
              <Text style={styles.dateValue}>{rangeLabel(endDate)}</Text>
            </Pressable>
          </View>
          <Text style={typo.muted}>
            Showing {range.from} → {range.to}
          </Text>
        </View>
      ) : null}

      {picking ? (
        <DateTimePicker
          value={picking === "start" ? startDate : endDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={todayStart()}
          onChange={onPick}
        />
      ) : null}
      {picking && Platform.OS === "ios" ? (
        <Pressable style={styles.donePick} onPress={() => setPicking(null)}>
          <Text style={styles.donePickText}>Done</Text>
        </Pressable>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.scroller}>
        {statusChips.map((chip) => (
          <Chip key={chip.id} label={`${chip.label} ${counts[chip.id]}`} on={status === chip.id} onPress={() => setStatus(chip.id)} />
        ))}
        {showPerson ? (
          <Chip
            label={`With photo ${rows.filter((v) => v.hasPhoto).length}`}
            on={photoOnly}
            onPress={() => setPhotoOnly((on) => !on)}
          />
        ) : null}
      </ScrollView>

      {!loading && counts.all > 0 ? (
        <Card>
          <View style={styles.progressRow}>
            <ProgressRing
              percent={doneRate}
              size={88}
              thickness={8}
              color={colors.green}
              trackColor={colors.line}
              label={`${doneRate}%`}
              sublabel="done"
            />
            <View style={{ flex: 1 }}>
              <MixBar
                title="Visit mix"
                slices={[
                  { key: "completed", label: "Completed", value: counts.completed, color: colors.green },
                  { key: "missed", label: "Missed", value: counts.missed, color: colors.amber },
                  { key: "open", label: "In progress", value: counts.in_progress, color: colors.blue },
                ]}
              />
            </View>
          </View>
          {trendBars.length ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.trendTitle}>Completed by day</Text>
              <BarChart points={trendBars} height={100} emptyText="No completed visits in this range." />
            </View>
          ) : null}
        </Card>
      ) : null}

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
                  {accessToken ? (
                    <ProofThumb
                      visitId={visit.id}
                      hasPhoto={Boolean(visit.hasPhoto)}
                      token={accessToken}
                      version={visit.photoReceivedAt}
                    />
                  ) : null}
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
                    <Text style={visit.hasPhoto ? styles.proofOn : typo.muted}>
                      {visit.hasPhoto ? "Place proof ready · Open" : "No place photo"}
                    </Text>
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
  progressRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  trendTitle: { fontWeight: "800", color: colors.text, marginBottom: 8, fontSize: 14 },
  rangeBox: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.blueSoft,
  },
  rangeHint: { ...typo.muted, fontWeight: "600" },
  rangeRow: { flexDirection: "row", gap: 10 },
  dateBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  dateLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  dateValue: { fontSize: 15, fontWeight: "800", color: colors.text },
  donePick: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.blue,
  },
  donePickText: { color: "#fff", fontWeight: "800" },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  name: { fontWeight: "800", color: colors.text, fontSize: 16 },
  proofOn: { color: colors.green, fontWeight: "800", fontSize: 13 },
  sale: { color: colors.green, fontWeight: "800" },
  proofOn: { color: colors.green, fontWeight: "800", fontSize: 13 },
});
