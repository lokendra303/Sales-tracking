import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExecFilter, useExecutives, type ExecValue } from "@/components/exec-filter";
import { Card, EmptyState, KpiTile, Screen, ScreenHeader, SectionTitle, TileGrid } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Funnel, type ReportSummary, type Sale } from "@/lib/api";
import { isSales } from "@/lib/roles";
import { money, when } from "@/lib/format";
import { colors, radius, shadow, typo } from "@/lib/theme";

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = max ? Math.max(4, Math.round((value / max) * 100)) : 4;
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

export default function ReportsScreen() {
  const { user, accessToken } = useAuth();
  const mine = isSales(user?.roles);
  const { manager, people } = useExecutives();
  const [exec, setExec] = useState<ExecValue>("all");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      const qs = !mine && typeof exec === "number" ? `?userId=${exec}` : "";
      const salesQs = !mine && typeof exec === "number" ? `&userId=${exec}` : "";
      Promise.all([
        api<ReportSummary>(`/reports/summary${qs}`, { token: accessToken }),
        api<Funnel>("/reports/funnel?days=30", { token: accessToken }),
        api<Sale[]>(`/sales?days=30${salesQs}`, { token: accessToken }),
      ])
        .then(([nextSummary, nextFunnel, nextSales]) => {
          setSummary(nextSummary);
          setFunnel(nextFunnel);
          setSales(nextSales);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, [accessToken, exec, mine]),
  );

  return (
    <Screen header={<ScreenHeader title={mine ? "My performance" : "Team performance"} subtitle={mine ? "Your visits, sales and follow-ups" : "All executives, or pick one"} />}>
      {manager ? <ExecFilter people={people} value={exec} onChange={setExec} /> : null}
      {loading || !summary ? (
        <ActivityIndicator color={colors.blue} />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>This month</Text>
              {summary.monthTarget ? (
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{summary.targetPercent}%</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {money(summary.monthSalesAmount)}
            </Text>
            <Text style={styles.heroSub}>
              {summary.monthTarget ? `of ${money(summary.monthTarget)} target` : "No target set"} · {summary.monthSalesCount} sale
              {summary.monthSalesCount === 1 ? "" : "s"}
            </Text>
            <View style={styles.heroBar}>
              <View style={[styles.heroFill, { width: `${Math.min(100, summary.targetPercent)}%` }]} />
            </View>
          </View>

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

          {funnel ? (
            <>
              <SectionTitle title={`Funnel · last ${funnel.days} days`} />
              <Card>
                <FunnelBar label="Leads" value={funnel.leads} max={funnel.leads} color={colors.blue} />
                <FunnelBar label="Visited" value={funnel.visited} max={funnel.leads} color={colors.amber} />
                <FunnelBar label="Sold" value={funnel.sold} max={funnel.leads} color={colors.green} />
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
  funnelRow: { gap: 6 },
  funnelHead: { flexDirection: "row", justifyContent: "space-between" },
  funnelLabel: { color: colors.text, fontWeight: "700", fontSize: 14 },
  funnelValue: { color: colors.text, fontWeight: "800", fontSize: 14 },
  hero: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 20, gap: 6, ...shadow },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLabel: { color: "#BFDBFE", fontWeight: "700", fontSize: 13, letterSpacing: 0.3 },
  heroPill: { backgroundColor: "rgba(255,255,255,0.16)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  heroPillText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  heroValue: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  heroSub: { color: "#BFDBFE", fontSize: 13, fontWeight: "600" },
  heroBar: { height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden", marginTop: 8 },
  heroFill: { height: 8, borderRadius: 8, backgroundColor: "#4ADE80" },
});
