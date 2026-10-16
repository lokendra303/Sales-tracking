import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, router, useLocalSearchParams, type Href } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExecFilter, useExecutives, type ExecValue } from "@/components/exec-filter";
import { ProgressRing } from "@/components/progress-charts";
import { ActionRow, Badge, Button, Card, Chip, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { VisitHistory } from "@/components/visit-history";
import { useAuth } from "@/lib/auth";
import { api, type BeatPlan, type BeatStop, type BeatToday } from "@/lib/api";
import { readLocalVisits, type LocalVisit } from "@/lib/local-visits";
import { useOffline } from "@/lib/offline";
import { openCall, openNavigate, openWhatsApp, tomorrowDay, when } from "@/lib/format";
import { isManager } from "@/lib/roles";
import { colors, radius, shadow, typo } from "@/lib/theme";

function stopBadge(stop: BeatStop, sending: boolean) {
  if (sending) return { label: "Sending", tone: "amber" as const, color: colors.amber, soft: colors.amberSoft };
  if (stop.visitStatus === "IN_PROGRESS") return { label: "In progress", tone: "blue" as const, color: colors.blue, soft: colors.blueSoft };
  if (stop.visitStatus === "COMPLETED") {
    if (stop.visitOutcome === "UNAVAILABLE") {
      return { label: "Missed", tone: "amber" as const, color: colors.amber, soft: colors.amberSoft };
    }
    return { label: "Done", tone: "green" as const, color: colors.green, soft: colors.greenSoft };
  }
  return { label: "Pending", tone: "slate" as const, color: colors.muted, soft: "#F1F5F9" };
}

function execFromParam(raw?: string): ExecValue {
  if (!raw) return "all";
  const id = Number(raw);
  return id > 0 ? id : "all";
}

export default function VisitsScreen() {
  const { accessToken, user } = useAuth();
  const params = useLocalSearchParams<{ userId?: string }>();
  const manager = isManager(user?.roles);
  const { people } = useExecutives();
  const offline = useOffline();
  const [beat, setBeat] = useState<BeatToday | null>(null);
  const [tomorrow, setTomorrow] = useState<BeatPlan | null>(null);
  const [drafts, setDrafts] = useState<LocalVisit[]>([]);
  const [exec, setExec] = useState<ExecValue>(execFromParam(params.userId));
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "history">("today");

  useEffect(() => {
    setExec(execFromParam(params.userId));
  }, [params.userId]);

  const load = useCallback(() => {
    if (!accessToken || manager) return;
    readLocalVisits().then(setDrafts);
    api<BeatToday>("/beat/today", { token: accessToken })
      .then(setBeat)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    api<BeatPlan>(`/beat?date=${tomorrowDay()}`, { token: accessToken })
      .then(setTomorrow)
      .catch(() => undefined);
  }, [accessToken, manager]);

  useFocusEffect(load);

  useEffect(() => {
    load();
  }, [offline.pending, load]);

  const sendingVisit = (visitId: number | null) =>
    visitId != null && offline.jobs.some((job) => job.kind === "visit-complete" && job.path === `/visits/${visitId}/complete`);

  const coverage = useMemo(() => {
    if (!beat) return { visited: 0, total: 0, missed: 0, percent: 0 };
    const total = beat.beatSize ?? beat.stops.length;
    const visited = beat.visitedOnBeat ?? beat.completedToday;
    const missed = beat.missedOnBeat ?? Math.max(0, total - visited);
    return {
      visited,
      total,
      missed,
      percent: total ? Math.round((visited / total) * 100) : 0,
    };
  }, [beat]);

  if (manager) {
    return (
      <Screen
        header={
          <ScreenHeader
            title="Visit proof"
            subtitle="Place photo + GPS · same proof as the desk portal. Tap a visit to open."
          />
        }
      >
        <ExecFilter people={people} value={exec} onChange={setExec} />
        <VisitHistory userId={typeof exec === "number" ? exec : undefined} showPerson />
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title="Visits"
          subtitle={
            tab === "today"
              ? "Today’s beat target · every lead on the beat · check in one by one"
              : "Filter completed visits by start and end date"
          }
        />
      }
    >
      <View style={styles.tabs}>
        <Chip label="Today" on={tab === "today"} onPress={() => setTab("today")} />
        <Chip label="History" on={tab === "history"} onPress={() => setTab("history")} />
      </View>
      {tab === "history" ? <VisitHistory /> : null}
      {tab === "today" ? (
        <>
          {drafts.map((draft) => (
            <Pressable
              key={draft.localId}
              style={styles.active}
              onPress={() => router.push({ pathname: "/visit/draft", params: { id: draft.localId } } as unknown as Href)}
            >
              <Badge label="Saved on phone" tone="amber" />
              <Text style={styles.name}>{draft.name}</Text>
              <Text style={typo.muted}>
                {draft.photoUri ? "Live photo and GPS saved" : "GPS saved · take the live photo"}
                {" · sends when the network is back"}
              </Text>
            </Pressable>
          ))}
          {loading && !beat ? (
            <ActivityIndicator color={colors.blue} />
          ) : !beat ? (
            <EmptyState icon="location-outline" text="No network. Visits saved on this phone will send automatically." />
          ) : (
            <>
              <View style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.heroKicker}>Today’s beat</Text>
                    <Text style={styles.heroTitle} numberOfLines={2}>
                      {beat.beatName || "No beat assigned"}
                    </Text>
                    {beat.territory ? (
                      <View style={styles.territoryRow}>
                        <Ionicons name="map-outline" size={14} color="#BFDBFE" />
                        <Text style={styles.territory} numberOfLines={1}>
                          {beat.territory}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <ProgressRing
                    percent={coverage.percent}
                    size={88}
                    thickness={8}
                    color="#4ADE80"
                    trackColor="rgba(255,255,255,0.2)"
                    label={`${coverage.percent}%`}
                    sublabel="done"
                    lightLabel
                  />
                </View>
                <View style={styles.heroStats}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{coverage.visited}</Text>
                    <Text style={styles.heroStatLabel}>Visited</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{coverage.missed}</Text>
                    <Text style={styles.heroStatLabel}>Pending</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{coverage.total}</Text>
                    <Text style={styles.heroStatLabel}>Stops</Text>
                  </View>
                </View>
                <Text style={styles.heroHint}>Finish each stop within 300 m of the shop pin</Text>
              </View>

              {beat.activeVisit ? (
                <Pressable style={styles.active} onPress={() => router.push(`/visit/${beat.activeVisit!.id}`)}>
                  <Badge label="In progress" tone="green" />
                  <Text style={styles.name}>{beat.activeVisit.name}</Text>
                  <Text style={typo.muted}>Continue to take the place photo and complete.</Text>
                </Pressable>
              ) : null}

              {beat.message ? (
                <Card>
                  <Text style={typo.muted}>{beat.message}</Text>
                </Card>
              ) : null}

              {beat.stops.map((stop) => {
                const done = stop.visitStatus === "COMPLETED";
                const sending = sendingVisit(stop.visitId);
                const badge = stopBadge(stop, sending);
                const params = {
                  leadId: stop.leadId ? String(stop.leadId) : undefined,
                  customerId: stop.customerId ? String(stop.customerId) : undefined,
                  beatStopId: stop.id ? String(stop.id) : undefined,
                };
                return (
                  <Card key={`${stop.leadId}-${stop.customerId}-${stop.sequence}`} style={{ ...styles.stopCard, borderLeftColor: badge.color }}>
                    <View style={styles.row}>
                      <View style={[styles.seq, { backgroundColor: badge.color }]}>
                        <Text style={styles.seqText}>{stop.sequence}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.stopHead}>
                          <Text style={styles.name} numberOfLines={2}>
                            {stop.name}
                          </Text>
                          <Badge label={badge.label} tone={badge.tone} />
                        </View>
                        <Text style={typo.muted} numberOfLines={2}>
                          {[stop.address, stop.city].filter(Boolean).join(", ") || "No address"}
                        </Text>
                        {stop.phone ? <Text style={styles.phone}>{stop.phone}</Text> : null}
                        {done && stop.visitAt ? <Text style={typo.muted}>Finished {when(stop.visitAt)}</Text> : null}
                      </View>
                    </View>
                    <ActionRow>
                      {stop.phone ? <Button title="Call" flex onPress={() => openCall(stop.phone!)} /> : null}
                      {stop.phone ? (
                        <Button title="WhatsApp" tone="outline" flex onPress={() => openWhatsApp(stop.phone!)} />
                      ) : null}
                      <Button
                        title="Navigate"
                        tone="outline"
                        flex
                        onPress={() =>
                          openNavigate(stop.placeLat, stop.placeLng, [stop.address, stop.city].filter(Boolean).join(", "))
                        }
                      />
                    </ActionRow>
                    {sending ? (
                      <Text style={typo.muted}>Visit finished on this phone. It sends automatically.</Text>
                    ) : stop.visitStatus === "IN_PROGRESS" && stop.visitId ? (
                      <Button title="Continue visit" tone="green" onPress={() => router.push(`/visit/${stop.visitId}`)} />
                    ) : done && stop.visitId ? (
                      <>
                        <Button title="View visit" tone="green" onPress={() => router.push(`/visit/${stop.visitId}`)} />
                        {stop.visitOutcome === "SUCCESS" && !stop.saleId ? (
                          <Button
                            title="Record sale"
                            tone="outline"
                            onPress={() =>
                              router.push({
                                pathname: "/sale/new",
                                params: { visitId: String(stop.visitId), name: stop.name },
                              })
                            }
                          />
                        ) : stop.saleAmount != null ? (
                          <Text style={styles.ok}>Sale ₹{stop.saleAmount}</Text>
                        ) : null}
                      </>
                    ) : beat.activeVisit ||
                      drafts.some((draft) => draft.leadId === stop.leadId || draft.customerId === stop.customerId) ? null : (
                      <Button title="Start visit" tone="green" onPress={() => router.push({ pathname: "/visit/check-in", params })} />
                    )}
                  </Card>
                );
              })}

              {!beat.stops.length ? (
                <EmptyState
                  icon="location-outline"
                  text={beat.message || "No beat scheduled for today. Ask your manager to set the beat cycle on the desk."}
                />
              ) : null}

              <View style={styles.tomorrowHead}>
                <Ionicons name="calendar-outline" size={18} color={colors.ink} />
                <Text style={styles.tomorrowTitle}>Tomorrow · {tomorrow?.stops.length ?? 0} planned</Text>
              </View>
              {(tomorrow?.stops ?? []).map((stop) => (
                <Card key={`t-${stop.id}`} style={styles.tomorrowCard}>
                  <View style={styles.row}>
                    <View style={[styles.seq, { backgroundColor: colors.ink }]}>
                      <Text style={styles.seqText}>{stop.sequence}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{stop.name}</Text>
                      <Text style={typo.muted}>{[stop.address, stop.city].filter(Boolean).join(", ") || "No address"}</Text>
                    </View>
                    <Badge label="Planned" tone="slate" />
                  </View>
                </Card>
              ))}
              {tomorrow && !tomorrow.stops.length ? (
                <EmptyState icon="calendar-outline" text="No beat on the cycle for tomorrow yet." />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 8 },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: 18,
    gap: 14,
    ...shadow,
  },
  heroTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  heroKicker: { color: "#93C5FD", fontWeight: "700", fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" },
  heroTitle: { color: "#fff", fontWeight: "800", fontSize: 20, lineHeight: 26 },
  territoryRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  territory: { color: "#BFDBFE", fontWeight: "600", fontSize: 13, flex: 1 },
  heroStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  heroStat: { flex: 1, alignItems: "center", gap: 2 },
  heroStatValue: { color: "#fff", fontWeight: "800", fontSize: 18 },
  heroStatLabel: { color: "#BFDBFE", fontWeight: "600", fontSize: 11 },
  heroStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.18)" },
  heroHint: { color: "#93C5FD", fontSize: 12, fontWeight: "600" },
  active: {
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
    gap: 6,
  },
  stopCard: { borderLeftWidth: 5, gap: 10 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stopHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  seq: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  seqText: { color: "#fff", fontWeight: "800" },
  name: { fontWeight: "800", color: colors.text, fontSize: 16, flex: 1 },
  phone: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  ok: { color: colors.green, fontWeight: "800" },
  tomorrowHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  tomorrowTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  tomorrowCard: { backgroundColor: "#F8FAFC" },
});
