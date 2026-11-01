import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { BarChart, MixBar, ProgressRing, dayKey, lastNDays } from "@/components/progress-charts";
import { ProofThumb } from "@/components/proof-thumb";
import { Badge, Card, EmptyState } from "@/components/ui";
import { api, type Visit } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isoDay, money, when } from "@/lib/format";
import { pickedBeat, pickedHq, personCatalog, type ScopePlace } from "@/lib/person-scope";
import { colors, shadow, typo } from "@/lib/theme";

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

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

function MiniCalendar({
  value,
  maximum,
  onPick,
}: {
  value: Date;
  maximum: Date;
  onPick: (date: Date) => void;
}) {
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const maxMonth = new Date(maximum.getFullYear(), maximum.getMonth(), 1).getTime();
  const selectedKey = isoDay(value);
  const todayKey = isoDay();

  useEffect(() => {
    const timer = setTimeout(() => {
      const node = typeof document !== "undefined" ? document.getElementById("custom-calendar") : null;
      node?.scrollIntoView({ block: "nearest" });
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View nativeID="custom-calendar" style={styles.calendar}>
      <View style={styles.calHead}>
        <Pressable
          onPress={() => setMonth(new Date(year, monthIndex - 1, 1))}
          hitSlop={8}
          accessibilityLabel="Previous month"
        >
          <Text style={styles.calArrow}>‹</Text>
        </Pressable>
        <Text style={styles.calTitle}>{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</Text>
        <Pressable
          onPress={() => setMonth(new Date(year, monthIndex + 1, 1))}
          disabled={month.getTime() >= maxMonth}
          hitSlop={8}
          accessibilityLabel="Next month"
        >
          <Text style={[styles.calArrow, month.getTime() >= maxMonth && styles.calArrowOff]}>›</Text>
        </Pressable>
      </View>
      <View style={styles.calGrid}>
        {weekDays.map((label, index) => (
          <Text key={`w-${index}`} style={styles.calWeek}>
            {label}
          </Text>
        ))}
        {cells.map((day, index) => {
          if (!day) return <View key={`e-${index}`} style={styles.calCell} />;
          const date = new Date(year, monthIndex, day);
          const key = isoDay(date);
          const disabled = startOfDay(date).getTime() > startOfDay(maximum).getTime();
          const selected = key === selectedKey;
          return (
            <Pressable
              key={key}
              disabled={disabled}
              onPress={() => onPick(date)}
              style={[styles.calCell, selected && styles.calCellOn]}
            >
              <Text style={[styles.calDay, key === todayKey && styles.calToday, selected && styles.calDayOn, disabled && styles.calDayOff]}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DropMenu({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.id === value)?.label ?? options[0]?.label ?? "";
  return (
    <View style={[styles.menu, open && styles.menuOpen]}>
      <Pressable style={styles.menuBtn} onPress={() => setOpen((on) => !on)} accessibilityRole="button">
        <Text style={styles.menuText} numberOfLines={1}>
          {current}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.menuList}>
          {options.map((option) => {
            const on = option.id === value;
            return (
              <Pressable
                key={option.id}
                style={[styles.menuItem, on && styles.menuItemOn]}
                onPress={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                <Text style={[styles.menuItemText, on && styles.menuItemTextOn]} numberOfLines={1}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function visitPlaceLine(places: ScopePlace[] | undefined, leadId: number | null) {
  if (leadId == null) return "Added by them";
  const place = places?.find((item) => item.leadId === leadId);
  if (!place || !place.beats.length) return "Added by them";
  const beat = place.beats[0];
  return [beat.hq?.trim() || "No HQ", beat.name].filter(Boolean).join(" · ");
}

function visitKind(visit: Visit): Exclude<StatusFilter, "all"> | "later" {
  if (visit.status === "IN_PROGRESS") return "in_progress";
  if (visit.outcome === "LATER") return "later";
  return visit.outcome === "UNAVAILABLE" ? "missed" : "completed";
}

function badgeFor(visit: Visit) {
  if (visit.managerConfirmedAt) return { label: "Confirmed", tone: "green" as const };
  const kind = visitKind(visit);
  if (kind === "in_progress") return { label: "In progress", tone: "blue" as const };
  if (kind === "missed") return { label: "Missed", tone: "amber" as const };
  if (visit.outcome === "LATER") return { label: "Do later", tone: "slate" as const };
  return { label: "Completed", tone: "green" as const };
}

/** Date + status filtered visit list. Managers pass `userId` from the executive filter. */
export function VisitHistory({
  userId,
  showPerson,
  places,
  personName,
  initialPeriod = "day",
  initialStatus = "completed",
}: {
  userId?: number;
  showPerson?: boolean;
  /** When set, HQ and beat menus list only this person's beats. */
  places?: ScopePlace[];
  personName?: string;
  initialPeriod?: Period;
  initialStatus?: StatusFilter;
}) {
  const { accessToken } = useAuth();
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [day, setDay] = useState(() => todayStart());
  const [startDate, setStartDate] = useState(() => startOfDay(shiftDay(new Date(), -6)));
  const [endDate, setEndDate] = useState(() => todayStart());
  const [picking, setPicking] = useState<Picking>(null);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [rows, setRows] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [photoOnly, setPhotoOnly] = useState(Boolean(showPerson));
  const [hqPick, setHqPick] = useState("");
  const [beatPick, setBeatPick] = useState<number | null>(null);
  const catalog = places ? personCatalog(places) : null;
  const hq = catalog ? pickedHq(catalog, hqPick) : "";
  const beatId = catalog && hq ? pickedBeat(catalog, hq, beatPick) : null;
  const beatGroup = catalog?.hqs.find((item) => item.name === hq)?.beats.find((item) => item.id === beatId) ?? null;
  const placedHqs = catalog?.hqs.filter((item) => item.name !== "No HQ") ?? [];

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

  const scoped = !catalog
    ? rows
    : rows.filter((visit) => {
        if (!hq) return true;
        if (visit.leadId == null) return hq === "No HQ";
        if (catalog.noBeatLeadIds.includes(visit.leadId)) return hq === "No HQ" || hq === "";
        if (hq === "No HQ") return catalog.noBeatLeadIds.includes(visit.leadId);
        return Boolean(beatGroup?.leadIds.includes(visit.leadId));
      });
  const counts = { all: scoped.length, completed: 0, missed: 0, in_progress: 0 };
  for (const visit of scoped) {
    const kind = visitKind(visit);
    if (kind !== "later") counts[kind] += 1;
  }
  const shown = (status === "all" ? scoped : scoped.filter((visit) => visitKind(visit) === status)).filter(
    (visit) => !photoOnly || visit.hasPhoto,
  );
  const isToday = isoDay(day) === isoDay();
  const doneRate = counts.all ? Math.round((counts.completed / counts.all) * 100) : 0;
  const trendMap: Record<string, number> = {};
  for (const visit of scoped) {
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

  function applyDate(which: "start" | "end", value: Date) {
    const picked = clampToToday(value);
    if (which === "start") {
      setStartDate(picked);
      setEndDate((current) => (picked.getTime() > current.getTime() ? picked : current));
      return;
    }
    setEndDate(picked);
    setStartDate((current) => (picked.getTime() < current.getTime() ? picked : current));
  }

  return (
    <View style={styles.wrap}>
      {catalog ? (
        <View style={styles.menuRow}>
          <DropMenu
            value={hq}
            options={[
              { id: "", label: personName || "This person" },
              ...placedHqs.map((item) => ({ id: item.name, label: item.name })),
              ...(catalog.noBeatLeadIds.length ? [{ id: "No HQ", label: `Added by ${personName || "them"}` }] : []),
            ]}
            onChange={(next) => {
              setHqPick(next);
              setBeatPick(null);
            }}
          />
          {hq && hq !== "No HQ" ? (
            <DropMenu
              value={beatId == null ? "" : String(beatId)}
              options={(placedHqs.find((item) => item.name === hq)?.beats ?? []).map((item) => ({
                id: String(item.id),
                label: item.name,
              }))}
              onChange={(next) => setBeatPick(Number(next))}
            />
          ) : null}
        </View>
      ) : null}
      <DropMenu
        value={period}
        options={[
          { id: "day", label: "By day" },
          { id: "7", label: "Last 7 days" },
          { id: "30", label: "Last 30 days" },
          { id: "range", label: "Custom dates" },
        ]}
        onChange={(id) => setPeriod(id as Period)}
      />

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
            {(["start", "end"] as const).map((which) => {
              const value = which === "start" ? startDate : endDate;
              const open = picking === which;
              return (
                <Pressable
                  key={which}
                  style={[styles.dateBtn, open && styles.dateBtnOn]}
                  onPress={() => setPicking(open ? null : which)}
                  accessibilityLabel={which === "start" ? "Start date" : "End date"}
                >
                  <Text style={styles.dateLabel}>{which === "start" ? "Start date" : "End date"}</Text>
                  <Text style={styles.dateValue}>{rangeLabel(value)}</Text>
                </Pressable>
              );
            })}
          </View>
          {picking ? (
            <MiniCalendar
              key={picking}
              value={picking === "start" ? startDate : endDate}
              maximum={picking === "start" && endDate.getTime() < todayStart().getTime() ? endDate : todayStart()}
              onPick={(date) => {
                applyDate(picking, date);
                setPicking(null);
              }}
            />
          ) : null}
          <Text style={typo.muted}>
            Showing {range.from} → {range.to}
          </Text>
        </View>
      ) : null}

      <View style={styles.menuRow}>
        <DropMenu
          value={status}
          options={statusChips.map((chip) => ({ id: chip.id, label: `${chip.label} ${counts[chip.id]}` }))}
          onChange={(id) => setStatus(id as StatusFilter)}
        />
        {showPerson ? (
          <DropMenu
            value={photoOnly ? "photo" : "any"}
            options={[
              { id: "any", label: "All photos" },
              { id: "photo", label: `With photo ${rows.filter((visit) => visit.hasPhoto).length}` },
            ]}
            onChange={(id) => setPhotoOnly(id === "photo")}
          />
        ) : null}
      </View>

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

      {personName ? (
        <Text style={styles.trendTitle}>
          {shown.length} visit{shown.length === 1 ? "" : "s"}
        </Text>
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
                    {catalog ? <Text style={styles.proofOn}>{visitPlaceLine(places, visit.leadId)}</Text> : null}
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
  wrap: { gap: 12, zIndex: 2 },
  menuRow: { flexDirection: "row", gap: 8, zIndex: 3 },
  menu: { flex: 1, zIndex: 2 },
  menuOpen: { zIndex: 4 },
  menuBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "500" },
  menuList: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    overflow: "hidden",
    ...shadow,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 9 },
  menuItemOn: { backgroundColor: "#EEF4FF" },
  menuItemText: { color: colors.text, fontSize: 14, fontWeight: "400" },
  menuItemTextOn: { fontWeight: "600", color: colors.blue },
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
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  dateBtnOn: { borderColor: colors.blue },
  calendar: { backgroundColor: "#fff", borderRadius: 12, padding: 10, gap: 8 },
  calHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  calArrow: { color: colors.blue, fontSize: 22, fontWeight: "600", paddingHorizontal: 8 },
  calArrowOff: { color: colors.line },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calWeek: { width: "14.28%", textAlign: "center", color: colors.muted, fontSize: 12, fontWeight: "500", paddingVertical: 4 },
  calCell: { width: "14.28%", height: 36, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  calCellOn: { backgroundColor: colors.blue },
  calDay: { color: colors.text, fontSize: 14, fontWeight: "500" },
  calDayOn: { color: "#fff", fontWeight: "600" },
  calToday: { color: colors.blue },
  calDayOff: { color: colors.line },
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
});
