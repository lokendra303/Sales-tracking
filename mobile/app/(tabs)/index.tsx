import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Avatar, Badge, Button, Card, EmptyState, Screen, ScreenHeader, Stat } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useField } from "@/lib/field";
import { useOffline } from "@/lib/offline";
import { api, type BeatPlan, type BeatToday, type FollowUp } from "@/lib/api";
import { ageLabel, tomorrowDay, when } from "@/lib/format";
import { isAdmin, isManager, isOffice, isSales, roleLabel } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const { user, accessToken } = useAuth();
  const field = useField();
  const offline = useOffline();
  const firstName = user?.name.split(" ")[0] ?? "there";
  const roles = user?.roles ?? [];
  const offlineMessage = !offline.online
    ? offline.pending
      ? `${offline.pending} waiting to send · no internet`
      : "No internet · showing last saved work"
    : `${offline.pending} waiting to send · tap to retry`;
  const [todayLeads, setTodayLeads] = useState(0);
  const [todayVisits, setTodayVisits] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [monthTarget, setMonthTarget] = useState(0);
  const [targetPercent, setTargetPercent] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [upcoming, setUpcoming] = useState<FollowUp[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [nextStop, setNextStop] = useState<BeatToday["stops"][number] | null>(null);
  const [tomorrow, setTomorrow] = useState<BeatPlan | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      api<{
        todayLeads: number;
        overdueFollowUps: number;
        todayVisits?: number;
        todaySalesAmount?: number;
        monthSalesAmount?: number;
        monthTarget?: number;
        targetPercent?: number;
        upcoming: FollowUp[];
      }>("/home", { token: accessToken })
        .then((data) => {
          setTodayLeads(data.todayLeads);
          setTodayVisits(data.todayVisits ?? 0);
          setTodaySales(data.todaySalesAmount ?? 0);
          setMonthSales(data.monthSalesAmount ?? 0);
          setMonthTarget(data.monthTarget ?? 0);
          setTargetPercent(data.targetPercent ?? 0);
          setOverdue(data.overdueFollowUps);
          setUpcoming(data.upcoming);
        })
        .catch(() => undefined);
      if (isSales(roles)) {
        api<BeatPlan>(`/beat?date=${tomorrowDay()}`, { token: accessToken })
          .then(setTomorrow)
          .catch(() => undefined);
        api<BeatToday>("/beat/today", { token: accessToken })
          .then((beat) => {
            if (beat.activeVisit) {
              setNextStop({
                id: beat.activeVisit.beatStopId,
                sequence: 0,
                leadId: beat.activeVisit.leadId,
                customerId: beat.activeVisit.customerId,
                name: beat.activeVisit.name,
                phone: beat.activeVisit.phone,
                address: beat.activeVisit.address,
                city: beat.activeVisit.city,
                placeLat: beat.activeVisit.placeLat,
                placeLng: beat.activeVisit.placeLng,
                visitId: beat.activeVisit.id,
                visitStatus: beat.activeVisit.status,
                visitOutcome: beat.activeVisit.outcome,
              });
              return;
            }
            setNextStop(beat.stops.find((item) => item.visitStatus !== "COMPLETED") ?? null);
          })
          .catch(() => undefined);
      }
      if (isOffice(roles)) {
        api<{ id: number }[]>("/users", { token: accessToken })
          .then((rows) => setTeamCount(rows.length))
          .catch(() => undefined);
      }
    }, [accessToken, roles.join(",")]),
  );

  return (
    <Screen
      header={
        <ScreenHeader
          title={`${greeting()}, ${firstName}`}
          subtitle={roleLabel(roles)}
          right={
            <View style={styles.headerRight}>
              {!isAdmin(roles) ? (
                <Pressable style={styles.bell} onPress={() => router.push("/notifications")} accessibilityLabel="Reminders">
                  <Ionicons name="notifications-outline" size={20} color={colors.text} />
                </Pressable>
              ) : null}
              <Avatar name={firstName} size={40} />
            </View>
          }
        />
      }
    >
      {!offline.online || offline.pending ? (
        <Pressable style={styles.offline} onPress={() => offline.flush()}>
          <Text style={styles.offlineText}>{offlineMessage}</Text>
        </Pressable>
      ) : null}

      {isSales(roles) ? (
        <Card>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>Field work</Text>
            <Badge
              label={field.session?.status === "ACTIVE" ? (field.session.liveStreaming ? "Live" : "Active") : "Not started"}
              tone={field.session?.status === "ACTIVE" ? "green" : "amber"}
            />
          </View>
          {field.session?.status === "ACTIVE" ? (
            <Text style={typo.muted}>
              {field.session.durationMinutes} min today
              {field.session.liveStreaming ? ` · ${field.session.pointCount} GPS points` : ""}
            </Text>
          ) : (
            <Text style={typo.muted}>Start your day, then visit today’s beat.</Text>
          )}
          <Text style={styles.live}>
            Live location: {field.session?.liveLocationEnabled ?? user?.liveLocationEnabled ? "On" : "Off"}
            {field.session?.liveStreaming ? " · streaming" : ""}
          </Text>
          {field.session?.lastSeenAt && field.session.liveStreaming ? (
            <Text style={typo.muted}>Last point {ageLabel(field.session.lastSeenAgeSeconds)}</Text>
          ) : null}
          {field.weakGps ? <Text style={styles.warn}>GPS is weak. Keep the visit going — we will not stop the day.</Text> : null}
          {field.notice ? <Text style={styles.warn}>{field.notice}</Text> : null}
          {field.session?.status === "ACTIVE" ? (
            <Button title="End Field Work" tone="red" onPress={() => field.end()} />
          ) : (
            <Button title="Start Field Work" tone="green" onPress={() => field.start()} />
          )}
          <Button title="Open today’s beat" tone="outline" onPress={() => router.push("/visits")} />
        </Card>
      ) : null}

      {isSales(roles) ? (
        <Card>
          <Text style={styles.cardTitle}>Tomorrow</Text>
          {tomorrow?.stops.length ? (
            <>
              <Text style={styles.live}>{tomorrow.stops.length} stops planned</Text>
              <Text style={typo.muted}>{tomorrow.stops.map((stop) => stop.name).join(" → ")}</Text>
            </>
          ) : (
            <Text style={typo.muted}>Manager has not planned tomorrow yet.</Text>
          )}
        </Card>
      ) : null}

      {isSales(roles) && nextStop ? (
        <Card>
          <Text style={styles.cardTitle}>{nextStop.visitStatus === "IN_PROGRESS" ? "Continue visit" : "Next stop"}</Text>
          <Text style={styles.live}>{nextStop.name}</Text>
          <Text style={typo.muted}>{[nextStop.address, nextStop.city].filter(Boolean).join(", ") || "Open Visits to check in"}</Text>
          <Button
            title={nextStop.visitStatus === "IN_PROGRESS" ? "Continue visit" : "Check location"}
            tone="green"
            onPress={() =>
              nextStop.visitId
                ? router.push(`/visit/${nextStop.visitId}`)
                : router.push({
                    pathname: "/visit/check-in",
                    params: {
                      leadId: nextStop.leadId ? String(nextStop.leadId) : undefined,
                      customerId: nextStop.customerId ? String(nextStop.customerId) : undefined,
                      beatStopId: nextStop.id ? String(nextStop.id) : undefined,
                    },
                  })
            }
          />
        </Card>
      ) : null}

      {isAdmin(roles) ? (
        <Card>
          <Text style={styles.cardTitle}>Company</Text>
          <Text style={styles.live}>{user?.tenant.name}</Text>
          <Text style={typo.muted}>
            You manage managers only. Same login on the web portal and this app. Live location is{" "}
            {user?.liveLocationEnabled ? "On" : "Off"} for their teams.
          </Text>
          <Button title="Open settings" onPress={() => router.push("/settings")} />
        </Card>
      ) : null}

      {isManager(roles) ? (
        <Card>
          <Text style={styles.cardTitle}>Monitor the field</Text>
          <Text style={typo.muted}>
            Assign leads to each executive on Leads. Then pick that person on Proof or Team to review only their
            photos, GPS and sales. All executives stay listed unless you filter.
          </Text>
          <Button title="Watch team live" onPress={() => router.push("/team")} />
          <Button title="Visit photos and GPS" tone="outline" onPress={() => router.push("/visits")} />
        </Card>
      ) : null}

      {isAdmin(roles) ? (
        <Card>
          <Text style={styles.cardTitle}>Managers</Text>
          <View style={styles.stats}>
            <Stat label="Managers" value={String(teamCount)} />
          </View>
          <Button title="Manage managers" onPress={() => router.push("/team")} />
        </Card>
      ) : (
        <Card>
          <Text style={styles.cardTitle}>{isSales(roles) ? "Today" : "Company today"}</Text>
          {isSales(roles) ? (
            <>
              <Text style={styles.target}>
                ₹{monthSales.toLocaleString("en-IN")} / ₹{monthTarget ? monthTarget.toLocaleString("en-IN") : "—"}
              </Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${Math.min(100, targetPercent)}%` }]} />
              </View>
              <Text style={typo.muted}>
                {monthTarget ? `${targetPercent}% of monthly target` : "Ask your manager to set a monthly target"}
                {todaySales ? ` · today ₹${todaySales.toLocaleString("en-IN")}` : ""}
              </Text>
            </>
          ) : null}
          <View style={styles.stats}>
            {isManager(roles) ? <Stat label="Team" value={String(teamCount)} /> : null}
            <Stat label="Leads" value={String(todayLeads)} />
            {isSales(roles) ? <Stat label="Visits" value={String(todayVisits)} /> : null}
            <Stat label="Overdue" value={String(overdue)} />
          </View>
        </Card>
      )}

      {isAdmin(roles) ? null : (
        <Card>
          <Pressable onPress={() => router.push("/notifications")} style={styles.row}>
            <Text style={styles.cardTitle}>{isSales(roles) ? "Upcoming" : "Team follow-ups"}</Text>
            <Text style={styles.link}>Reminders</Text>
          </Pressable>
          {upcoming.length === 0 ? (
            <EmptyState icon="calendar-outline" text="Nothing scheduled" />
          ) : (
            upcoming.map((item) => (
              <Pressable key={item.id} onPress={() => item.leadId && router.push(`/lead/${item.leadId}`)} style={styles.follow}>
                <Text style={styles.live}>{item.name}</Text>
                <Text style={typo.muted}>
                  {item.type} · {when(item.dueAt)}
                  {item.overdue ? " · Overdue" : ""}
                </Text>
              </Pressable>
            ))
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  live: { color: colors.text, fontWeight: "700", fontSize: 15 },
  warn: { color: "#92400E", fontWeight: "700", lineHeight: 20 },
  target: { fontSize: 22, fontWeight: "800", color: colors.text },
  barBg: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 8, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: colors.green },
  stats: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  follow: { paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  link: { color: colors.blue, fontWeight: "800", fontSize: 13 },
  offline: { backgroundColor: colors.amberSoft, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#F59E0B" },
  offlineText: { color: "#92400E", fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
