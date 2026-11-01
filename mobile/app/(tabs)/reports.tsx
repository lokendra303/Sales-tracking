import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExecFilter, useExecutives, type ExecValue } from "@/components/exec-filter";
import { BarChart, MixBar, TargetHero, dayKey, type BarPoint } from "@/components/progress-charts";
import { Card, EmptyState, KpiTile, Screen, ScreenHeader, SectionTitle, TileGrid } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Funnel, type ReportSummary, type Sale, type Visit } from "@/lib/api";
import { isSales } from "@/lib/roles";
import { isoDay, money, when } from "@/lib/format";
import { colors, shadow, typo } from "@/lib/theme";

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = max ? Math.max(6, Math.round((value / max) * 100)) : 6;
  return (
    <View style={styles.funnelRow}>
      <View style={styles.funnelHead}>
        <Text style={styles.funnelLabel}>{label}</Text>
        <Text style={styles.funnelValue}>{value}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${width}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

type ReportPeriod = "month" | "last" | "custom";
type Picking = "start" | "end" | null;

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

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

function monthSpan(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const monthEnd = startOfDay(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0));
  const end = monthEnd.getTime() > todayStart().getTime() ? todayStart() : monthEnd;
  return { from: isoDay(start), to: isoDay(end) };
}

function prettyRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const fmt = (day: Date) => day.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const coversMonth = sameMonth && start.getDate() === 1 && (end.getDate() === lastDay || isoDay(end) === isoDay());
  if (coversMonth) return start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return from === to ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

function barsFor(from: string, to: string, values: Record<string, number>, color: string): BarPoint[] {
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const points: BarPoint[] = [];
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 62) {
    const key = isoDay(cursor);
    points.push({ key, label: String(cursor.getDate()), value: values[key] ?? 0, color });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return points.length > 31 ? points.slice(-31) : points;
}

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
      const node = typeof document !== "undefined" ? document.getElementById("report-calendar") : null;
      node?.scrollIntoView({ block: "nearest" });
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View nativeID="report-calendar" style={styles.calendar}>
      <View style={styles.calHead}>
        <Pressable onPress={() => setMonth(new Date(year, monthIndex - 1, 1))} hitSlop={8} accessibilityLabel="Previous month">
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
            <Pressable key={key} disabled={disabled} onPress={() => onPick(date)} style={[styles.calCell, selected && styles.calCellOn]}>
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

function PeriodMenu({
  value,
  hint,
  onChange,
}: {
  value: ReportPeriod;
  hint: string;
  onChange: (id: ReportPeriod) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: { id: ReportPeriod; label: string }[] = [
    { id: "month", label: "This month" },
    { id: "last", label: "Last month" },
    { id: "custom", label: "Custom dates" },
  ];
  const current = options.find((option) => option.id === value)?.label ?? "This month";
  return (
    <View style={[styles.menu, open && styles.menuOpen]}>
      <Pressable style={styles.menuBtn} onPress={() => setOpen((on) => !on)} accessibilityRole="button">
        <View style={styles.menuCopy}>
          <Text style={styles.menuText}>{current}</Text>
          <Text style={styles.menuSub}>{hint}</Text>
        </View>
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
                <Text style={[styles.menuItemText, on && styles.menuItemTextOn]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function ReportsScreen() {
  const { user, accessToken } = useAuth();
  const mine = isSales(user?.roles);
  const { manager, people } = useExecutives();
  const [exec, setExec] = useState<ExecValue>("all");
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [startDate, setStartDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const [endDate, setEndDate] = useState(() => startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 0)));
  const [picking, setPicking] = useState<Picking>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (period === "last") return monthSpan(-1);
    if (period === "custom") {
      let start = startOfDay(startDate);
      let end = clampToToday(endDate);
      if (start.getTime() > end.getTime()) [start, end] = [end, start];
      return { from: isoDay(start), to: isoDay(end) };
    }
    return monthSpan(0);
  }, [period, startDate, endDate]);

  const rangeTitle = prettyRange(range.from, range.to);
  const includesToday = range.to === isoDay();

  function applyDate(which: "start" | "end", value: Date) {
    const picked = clampToToday(value);
    if (which === "start") {
      setStartDate(picked);
      setEndDate((current) => (picked.getTime() > current.getTime() ? picked : current));
    } else {
      setEndDate(picked);
      setStartDate((current) => (picked.getTime() < current.getTime() ? picked : current));
    }
    setPicking(null);
  }

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      const who = !mine && typeof exec === "number" ? `userId=${exec}` : "";
      const andWho = who ? `&${who}` : "";
      const summaryQs = `?from=${range.from}&to=${range.to}${andWho}`;
      Promise.all([
        api<ReportSummary>(`/reports/summary${summaryQs}`, { token: accessToken }),
        api<Funnel>(`/reports/funnel?from=${range.from}&to=${range.to}`, { token: accessToken }),
        api<Sale[]>(`/sales?from=${range.from}&to=${range.to}${andWho}`, { token: accessToken }),
        api<Visit[]>(`/visits?from=${range.from}&to=${range.to}${andWho}`, { token: accessToken }),
      ])
        .then(([nextSummary, nextFunnel, nextSales, nextVisits]) => {
          setSummary(nextSummary);
          setFunnel(nextFunnel);
          setSales(nextSales);
          setVisits(nextVisits);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, [accessToken, exec, mine, range.from, range.to]),
  );

  const visitByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const visit of visits) {
      if (visit.status !== "COMPLETED") continue;
      const key = dayKey(visit.checkedInAt);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [visits]);

  const salesCountByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sale of sales) {
      const key = dayKey(sale.createdAt);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [sales]);

  const visitBars = barsFor(range.from, range.to, visitByDay, colors.blue);
  const saleBars = barsFor(range.from, range.to, salesCountByDay, colors.green);
  const chartTrimmed = range.from !== visitBars[0]?.key;

  return (
    <Screen header={<ScreenHeader title={mine ? "My performance" : "Team performance"} subtitle={mine ? "Progress graphs for visits and sales" : "All executives, or pick one"} />}>
      {manager ? <ExecFilter people={people} value={exec} onChange={setExec} /> : null}
      <View style={styles.periodBox}>
        <PeriodMenu
          value={period}
          hint={rangeTitle}
          onChange={(next) => {
            setPeriod(next);
            setPicking(next === "custom" ? "start" : null);
          }}
        />
        {period === "custom" ? (
          <View style={styles.rangeBox}>
            <View style={styles.rangeRow}>
              <Pressable style={[styles.dateBtn, picking === "start" && styles.dateBtnOn]} onPress={() => setPicking("start")}>
                <Text style={styles.dateLabel}>Start date</Text>
                <Text style={styles.dateValue}>{startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text>
              </Pressable>
              <Pressable style={[styles.dateBtn, picking === "end" && styles.dateBtnOn]} onPress={() => setPicking("end")}>
                <Text style={styles.dateLabel}>End date</Text>
                <Text style={styles.dateValue}>{endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text>
              </Pressable>
            </View>
            {picking ? (
              <MiniCalendar
                value={picking === "start" ? startDate : endDate}
                maximum={picking === "start" ? endDate : todayStart()}
                onPick={(date) => applyDate(picking, date)}
              />
            ) : null}
          </View>
        ) : null}
      </View>
      {loading || !summary ? (
        <ActivityIndicator color={colors.blue} />
      ) : (
        <>
          <TargetHero
            amountLabel={money(summary.monthSalesAmount)}
            percent={summary.targetPercent}
            sublabel={
              summary.monthTarget
                ? `of ${money(summary.monthTarget)} · ${summary.monthSalesCount} sale${summary.monthSalesCount === 1 ? "" : "s"}`
                : `No target set · ${summary.monthSalesCount} sale${summary.monthSalesCount === 1 ? "" : "s"}`
            }
          />

          {includesToday ? (
            <>
              <SectionTitle title="Today’s mix" />
              <Card>
                <MixBar
                  slices={[
                    { key: "ok", label: "Successful", value: summary.successVisits, color: colors.green },
                    { key: "miss", label: "Not there", value: summary.unavailableVisits, color: colors.amber },
                    { key: "overdue", label: "Overdue follow-ups", value: summary.overdueFollowUps, color: colors.red },
                  ]}
                />
              </Card>

              <SectionTitle title="Today" />
              <TileGrid>
                <KpiTile
                  icon="location-outline"
                  label="Visits"
                  value={String(summary.todayVisits)}
                  hint={`${summary.successVisits} successful · ${summary.unavailableVisits} not there`}
                />
                <KpiTile
                  icon="cash-outline"
                  label="Sales"
                  value={money(summary.todaySalesAmount)}
                  hint={`${summary.todaySalesCount} order${summary.todaySalesCount === 1 ? "" : "s"}`}
                  tone="green"
                />
                <KpiTile
                  icon="close-circle-outline"
                  label="Missed stops"
                  value={String(summary.missedStops)}
                  tone={summary.missedStops ? "amber" : "slate"}
                />
                <KpiTile
                  icon="alarm-outline"
                  label="Overdue follow-ups"
                  value={String(summary.overdueFollowUps)}
                  tone={summary.overdueFollowUps ? "red" : "slate"}
                />
              </TileGrid>
              {summary.missed.length ? (
                <Card style={styles.list}>
                  {summary.missed.map((stop, index) => (
                    <View key={`${stop.name}-${index}`} style={[styles.saleRow, index > 0 && styles.divider]}>
                      <Ionicons name="alert-circle-outline" size={18} color={colors.amber} />
                      <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>
                        Missed {stop.name}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}
            </>
          ) : null}

          <SectionTitle title={`Visits · ${rangeTitle}`} />
          <Card>
            <BarChart points={visitBars} emptyText={`No completed visits in ${rangeTitle}.`} />
            <Text style={styles.chartHint}>
              Completed visits each day{chartTrimmed ? " · last 31 days of this range" : ""}
            </Text>
          </Card>

          <SectionTitle title={`Sales · ${rangeTitle}`} />
          <Card>
            <BarChart points={saleBars} emptyText={`No sales in ${rangeTitle}.`} />
            <Text style={styles.chartHint}>
              Number of sales each day{chartTrimmed ? " · last 31 days of this range" : ""}
            </Text>
          </Card>

          {funnel ? (
            <>
              <SectionTitle title={`Funnel · ${rangeTitle}`} />
              <Card>
                <FunnelBar label="Leads" value={funnel.leads} max={funnel.leads} color={colors.blue} />
                <FunnelBar label="Visited" value={funnel.visited} max={Math.max(funnel.leads, 1)} color={colors.amber} />
                <FunnelBar label="Sold" value={funnel.sold} max={Math.max(funnel.leads, 1)} color={colors.green} />
                <Text style={typo.muted}>
                  {funnel.leadToVisitPercent}% lead to visit · {funnel.visitToSalePercent}% visit to sale
                </Text>
              </Card>
            </>
          ) : null}

          <SectionTitle title={`Sales in ${rangeTitle}`} />
          {sales.length ? (
            <Card style={styles.list}>
              {sales.map((sale, index) => (
                <View key={sale.id} style={[styles.saleRow, index > 0 && styles.divider]}>
                  <View style={styles.saleIcon}>
                    <Ionicons name="cash-outline" size={18} color={colors.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {sale.name}
                    </Text>
                    <Text style={typo.muted} numberOfLines={1}>
                      {sale.userName ? `${sale.userName} · ` : ""}
                      {when(sale.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.amount}>{money(Number(sale.amount))}</Text>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState icon="cash-outline" text={`No sales in ${rangeTitle}.`} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontWeight: "800", color: colors.text },
  amount: { fontWeight: "800", color: colors.green, fontSize: 16 },
  barBg: { height: 10, backgroundColor: "#EEF2F7", borderRadius: 8, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 8, backgroundColor: colors.green },
  list: { paddingVertical: 4, gap: 0 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  saleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  saleIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  funnelRow: { gap: 6, marginBottom: 10 },
  funnelHead: { flexDirection: "row", justifyContent: "space-between" },
  funnelLabel: { color: colors.text, fontWeight: "700", fontSize: 14 },
  funnelValue: { color: colors.text, fontWeight: "800", fontSize: 14 },
  chartHint: { ...typo.muted, marginTop: 8 },
  periodBox: { gap: 8, zIndex: 2 },
  rangeBox: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.blueSoft },
  rangeRow: { flexDirection: "row", gap: 10 },
  dateBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "transparent", paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  dateBtnOn: { borderColor: colors.blue },
  dateLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  dateValue: { fontSize: 15, fontWeight: "800", color: colors.text },
  menu: { zIndex: 2 },
  menuOpen: { zIndex: 4 },
  menuCopy: { flex: 1, gap: 1 },
  menuSub: { color: colors.muted, fontSize: 12, fontWeight: "500" },
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
    zIndex: 4,
    elevation: 8,
    ...shadow,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" },
  menuItemOn: { backgroundColor: colors.blueSoft },
  menuItemText: { color: colors.text, fontSize: 14, fontWeight: "400" },
  menuItemTextOn: { color: colors.blue, fontWeight: "600" },
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
});
