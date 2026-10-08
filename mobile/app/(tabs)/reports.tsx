import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ExecFilter, useExecutives, type ExecValue } from "@/components/exec-filter";
import { Card, EmptyState, Screen, ScreenHeader, Stat } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Funnel, type ReportSummary, type Sale } from "@/lib/api";
import { isSales } from "@/lib/roles";
import { when } from "@/lib/format";
import { colors, typo } from "@/lib/theme";

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
          <Card>
            <Text style={styles.cardTitle}>This month</Text>
            <Text style={styles.total}>
              ₹{summary.monthSalesAmount.toLocaleString("en-IN")}
              <Text style={typo.muted}>
                {" "}
                / ₹{summary.monthTarget ? summary.monthTarget.toLocaleString("en-IN") : "—"}
              </Text>
            </Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(100, summary.targetPercent)}%` }]} />
            </View>
            <Text style={typo.muted}>{summary.monthTarget ? `${summary.targetPercent}% of target` : "No target set"}</Text>
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Today</Text>
            <View style={styles.stats}>
              <Stat label="Visits" value={String(summary.todayVisits)} />
              <Stat label="Sales" value={`₹${summary.todaySalesAmount.toLocaleString("en-IN")}`} />
              <Stat label="Missed" value={String(summary.missedStops)} />
              <Stat label="Overdue" value={String(summary.overdueFollowUps)} />
            </View>
            <Text style={typo.muted}>
              {summary.successVisits} successful · {summary.unavailableVisits} not there
            </Text>
            {summary.missed.map((stop) => (
              <Text key={stop.name} style={typo.muted}>
                Missed {stop.name}
              </Text>
            ))}
          </Card>

          {funnel ? (
            <Card>
              <Text style={styles.cardTitle}>Funnel · last {funnel.days} days</Text>
              <Text style={styles.live}>
                {funnel.leads} leads → {funnel.visited} visited → {funnel.sold} sold
              </Text>
              <Text style={typo.muted}>
                {funnel.leadToVisitPercent}% lead to visit · {funnel.visitToSalePercent}% visit to sale
              </Text>
            </Card>
          ) : null}

          <Text style={styles.cardTitle}>Recent sales</Text>
          {sales.map((sale) => (
            <Card key={sale.id}>
              <View style={styles.saleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{sale.name}</Text>
                  <Text style={typo.muted}>
                    {sale.userName ? `${sale.userName} · ` : ""}
                    {when(sale.createdAt)}
                  </Text>
                </View>
                <Text style={styles.amount}>₹{sale.amount}</Text>
              </View>
            </Card>
          ))}
          {!sales.length ? <EmptyState icon="cash-outline" text="No sales yet." /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  live: { color: colors.text, fontWeight: "700" },
  total: { fontSize: 28, fontWeight: "800", color: colors.text },
  name: { fontWeight: "800", color: colors.text },
  amount: { fontWeight: "800", color: colors.green, fontSize: 18 },
  barBg: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 8, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: colors.green },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  saleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
