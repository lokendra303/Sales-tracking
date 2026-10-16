import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { ProgressRing } from "@/components/progress-charts";
import { ActionTile, Avatar, Badge, Card, EmptyState, KpiTile, SectionTitle, TileGrid } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type FieldTeammate, type FollowUp } from "@/lib/api";
import { ageLabel, money, when } from "@/lib/format";
import { colors, radius, shadow, typo } from "@/lib/theme";

type Props = {
  teamCount: number;
  todayLeads: number;
  todayVisits: number;
  todaySales: number;
  monthSales: number;
  monthTarget: number;
  targetPercent: number;
  overdue: number;
  pendingApprovals: number;
  upcoming: FollowUp[];
};

function monthName() {
  return new Date().toLocaleString("en-IN", { month: "long" });
}

function rank(row: FieldTeammate) {
  if (row.liveStreaming) return 0;
  if (row.fieldStatus === "ACTIVE") return 1;
  return 2;
}

export function ManagerHome({
  teamCount,
  todayLeads,
  todayVisits,
  todaySales,
  monthSales,
  monthTarget,
  targetPercent,
  overdue,
  pendingApprovals,
  upcoming,
}: Props) {
  const { accessToken } = useAuth();
  const [field, setField] = useState<FieldTeammate[]>([]);
  const [coverage, setCoverage] = useState<
    { userId: number; name: string; beatName: string | null; stops: number; completed: number }[]
  >([]);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      const load = () => {
        api<FieldTeammate[]>("/field/team", { token: accessToken })
          .then(setField)
          .catch(() => undefined);
        api<{ people: { userId: number; name: string; beatName: string | null; stops: number; completed: number }[] }>(
          "/beat/coverage/today",
          { token: accessToken },
        )
          .then((data) => setCoverage(data.people ?? []))
          .catch(() => undefined);
      };
      load();
      const tick = setInterval(load, 30000);
      return () => clearInterval(tick);
    }, [accessToken]),
  );

  const inField = field.filter((row) => row.fieldStatus === "ACTIVE").length;
  const live = field.filter((row) => row.liveStreaming).length;
  const people = [...field].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 5);
  const remaining = monthTarget ? Math.max(0, monthTarget - monthSales) : 0;
  const executives = field.length || teamCount;

  return (
    <>
      {pendingApprovals > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.alert, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: "/leads", params: { filter: "pending" } })}
          accessibilityRole="button"
        >
          <View style={styles.alertIcon}>
            <Ionicons name="hourglass-outline" size={20} color={colors.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>
              {pendingApprovals} lead{pendingApprovals === 1 ? "" : "s"} to approve
            </Text>
            <Text style={styles.alertText}>Added by your team in the field</Text>
          </View>
          <Text style={styles.alertCta}>Review</Text>
        </Pressable>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroMain}>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text style={styles.heroLabel}>Team sales · {monthName()}</Text>
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {money(monthSales)}
            </Text>
            <Text style={styles.heroSub}>
              {monthTarget ? `of ${money(monthTarget)} monthly target` : "No monthly target set yet"}
            </Text>
          </View>
          <ProgressRing
            percent={targetPercent}
            size={96}
            thickness={9}
            color="#4ADE80"
            trackColor="rgba(255,255,255,0.18)"
            label={`${Math.min(100, Math.round(targetPercent || 0))}%`}
            sublabel="target"
            lightLabel
          />
        </View>
        <View style={styles.heroFoot}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {money(todaySales)}
            </Text>
            <Text style={styles.heroStatLabel}>Sold today</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {monthTarget ? money(remaining) : "—"}
            </Text>
            <Text style={styles.heroStatLabel}>Still to go</Text>
          </View>
        </View>
      </View>

      <SectionTitle title="Today" />
      <TileGrid>
        <KpiTile
          icon="walk-outline"
          label="In the field"
          value={`${inField}/${executives}`}
          hint={live ? `${live} live now` : undefined}
          tone="green"
          onPress={() => router.push("/team")}
        />
        <KpiTile icon="location-outline" label="Visits" value={String(todayVisits)} onPress={() => router.push("/visits")} />
        <KpiTile icon="briefcase-outline" label="New leads" value={String(todayLeads)} tone="slate" onPress={() => router.push("/leads")} />
        <KpiTile
          icon="alarm-outline"
          label="Overdue follow-ups"
          value={String(overdue)}
          tone={overdue ? "red" : "slate"}
          onPress={() => router.push("/notifications")}
        />
      </TileGrid>

      {coverage.length ? (
        <>
          <SectionTitle title="Today’s beats" />
          <Card style={styles.list}>
            {coverage.slice(0, 6).map((row, index) => (
              <Pressable
                key={row.userId}
                onPress={() => router.push({ pathname: "/visits", params: { userId: String(row.userId) } })}
                style={({ pressed }) => [styles.person, index > 0 && styles.divider, pressed && styles.pressed]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={typo.muted} numberOfLines={1}>
                    {row.beatName
                      ? `${row.beatName} · ${row.completed}/${row.stops} visited`
                      : "No beat scheduled today"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle title="Quick actions" />
      <View style={styles.actions}>
        <ActionTile icon="navigate-outline" label="Live team" tone="green" onPress={() => router.push("/team")} />
        <ActionTile icon="map-outline" label="Beats" tone="green" onPress={() => router.push("/beats")} />
        <ActionTile icon="camera-outline" label="Visit proof" onPress={() => router.push("/visits")} />
        <ActionTile icon="briefcase-outline" label="Leads" tone="amber" onPress={() => router.push("/leads")} />
        <ActionTile icon="bar-chart-outline" label="Reports" tone="slate" onPress={() => router.push("/reports")} />
        <ActionTile icon="add-circle-outline" label="Add lead" tone="amber" onPress={() => router.push("/lead/new")} />
        <ActionTile icon="person-add-outline" label="Add employee" tone="green" onPress={() => router.push("/user/new")} />
      </View>

      <SectionTitle title="Team right now" action="See all" onAction={() => router.push("/team")} />
      <Card style={styles.list}>
        {people.length === 0 ? (
          <EmptyState icon="people-outline" text="No sales executives yet" />
        ) : (
          people.map((row, index) => {
            const active = row.fieldStatus === "ACTIVE";
            return (
              <Pressable
                key={row.userId}
                onPress={() => router.push({ pathname: "/visits", params: { userId: String(row.userId) } })}
                style={({ pressed }) => [styles.person, index > 0 && styles.divider, pressed && styles.pressed]}
              >
                <View>
                  <Avatar name={row.name} size={40} tone={active ? "green" : "blue"} />
                  <View style={[styles.dot, { backgroundColor: row.liveStreaming ? colors.green : active ? colors.amber : "#CBD5E1" }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={typo.muted} numberOfLines={1}>
                    {active
                      ? `${row.durationMinutes} min in field${row.liveStreaming ? ` · ${ageLabel(row.lastSeenAgeSeconds)}` : ""}`
                      : "Not in the field"}
                  </Text>
                </View>
                <Badge label={row.liveStreaming ? "Live" : active ? "In field" : "Off"} tone={row.liveStreaming || active ? "green" : "slate"} />
              </Pressable>
            );
          })
        )}
      </Card>

      <SectionTitle title="Team follow-ups" action="Reminders" onAction={() => router.push("/notifications")} />
      <Card style={styles.list}>
        {upcoming.length === 0 ? (
          <EmptyState icon="calendar-outline" text="Nothing scheduled" />
        ) : (
          upcoming.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => item.leadId && router.push(`/lead/${item.leadId}`)}
              style={({ pressed }) => [styles.person, index > 0 && styles.divider, pressed && styles.pressed]}
            >
              <View style={[styles.followIcon, item.overdue && { backgroundColor: colors.redSoft }]}>
                <Ionicons
                  name={item.type === "CALL" ? "call-outline" : "calendar-outline"}
                  size={18}
                  color={item.overdue ? colors.red : colors.blue}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={typo.muted} numberOfLines={1}>
                  {item.type} · {when(item.dueAt)}
                </Text>
              </View>
              {item.overdue ? <Badge label="Overdue" tone="red" /> : null}
            </Pressable>
          ))
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#FCD34D",
    padding: 14,
  },
  alertIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" },
  alertTitle: { color: "#92400E", fontWeight: "800", fontSize: 15 },
  alertText: { color: "#92400E", fontSize: 12, fontWeight: "600", marginTop: 2 },
  alertCta: { color: colors.amber, fontWeight: "800", fontSize: 14 },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: 20,
    gap: 6,
    ...shadow,
  },
  heroMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLabel: { color: "#BFDBFE", fontWeight: "700", fontSize: 13, letterSpacing: 0.3 },
  heroPill: { backgroundColor: "rgba(255,255,255,0.16)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  heroPillText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  heroValue: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  heroSub: { color: "#BFDBFE", fontSize: 13, fontWeight: "600" },
  heroBar: { height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden", marginTop: 8 },
  heroFill: { height: 8, borderRadius: 8, backgroundColor: "#4ADE80" },
  heroFoot: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  heroStat: { flex: 1, gap: 2 },
  heroStatValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  heroStatLabel: { color: "#BFDBFE", fontSize: 12, fontWeight: "600" },
  heroDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 16 },
  actions: { flexDirection: "row", gap: 10 },
  list: { paddingVertical: 4, gap: 0 },
  person: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  personName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  dot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
  },
  followIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
});
