import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExecFilter, useExecutives, type ExecValue } from "@/components/exec-filter";
import { BarChart, MixBar, TargetHero, dayKey, lastNDays } from "@/components/progress-charts";
import { Card, EmptyState, KpiTile, Screen, ScreenHeader, SectionTitle, TileGrid } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Funnel, type ReportSummary, type Sale, type Visit } from "@/lib/api";
import { isSales } from "@/lib/roles";
import { isoDay, money, when } from "@/lib/format";
import { colors, typo } from "@/lib/theme";

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

function shiftDay(by: number) {
  const d = new Date();
  d.setDate(d.getDate() + by);
  return isoDay(d);
}

export default function ReportsScreen() {
  const { user, accessToken } = useAuth();
  const mine = isSales(user?.roles);
  const { manager, people } = useExecutives();
  const [exec, setExec] = useState<ExecValue>("all");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      const who = !mine && typeof exec === "number" ? `userId=${exec}` : "";
      const summaryQs = who ? `?${who}` : "";
      const andWho = who ? `&${who}` : "";
      Promise.all([
        api<ReportSummary>(`/reports/summary${summaryQs}`, { token: accessToken }),
        api<Funnel>("/reports/funnel?days=30", { token: accessToken }),
        api<Sale[]>(`/sales?days=30${andWho}`, { token: accessToken }),
        api<Visit[]>(`/visits?from=${shiftDay(-6)}&to=${isoDay()}${andWho}`, { token: accessToken }),
      ])
        .then(([nextSummary, nextFunnel, nextSales, nextVisits]) => {
          setSummary(nextSummary);
          setFunnel(nextFunnel);
          setSales(nextSales);
          setVisits(nextVisits);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, [accessToken, exec, mine]),
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

  const visitBars = lastNDays(7, visitByDay, colors.blue);
  const saleBars = lastNDays(7, salesCountByDay, colors.green);

  return (
    <Screen header={<ScreenHeader title={mine ? "My performance" : "Team performance"} subtitle={mine ? "Progress graphs for visits and sales" : "All executives, or pick one"} />}>
      {manager ? <ExecFilter people={people} value={exec} onChange={setExec} /> : null}
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

          <SectionTitle title="Visits · last 7 days" />
          <Card>
            <BarChart points={visitBars} emptyText="No completed visits in the last 7 days." />
            <Text style={styles.chartHint}>Completed visits each day</Text>
          </Card>

          <SectionTitle title="Sales · last 7 days" />
          <Card>
            <BarChart points={saleBars} emptyText="No sales in the last 7 days." />
            <Text style={styles.chartHint}>Number of sales each day</Text>
          </Card>

          {funnel ? (
            <>
              <SectionTitle title={`Funnel · last ${funnel.days} days`} />
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

          <SectionTitle title="Recent sales" />
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
            <EmptyState icon="cash-outline" text="No sales yet." />
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
});
