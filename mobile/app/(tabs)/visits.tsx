import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, router, useLocalSearchParams, type Href } from "expo-router";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BeatsScreen from "@/app/beats";
import { ActionRow, Badge, Button, Card, Chip, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { VisitHistory } from "@/components/visit-history";
import { useAuth } from "@/lib/auth";
import { api, type BeatPlan, type BeatStop, type BeatToday, type Lead } from "@/lib/api";
import { readLocalVisits, type LocalVisit } from "@/lib/local-visits";
import { useOffline } from "@/lib/offline";
import { openCall, openNavigate, openWhatsApp, tomorrowDay } from "@/lib/format";
import { isManager } from "@/lib/roles";
import { colors, radius, shadow, typo } from "@/lib/theme";

function stopBadge(stop: BeatStop, sending: boolean) {
  if (sending) return { label: "Sending", tone: "amber" as const, color: colors.amber, soft: colors.amberSoft };
  if (stop.visitStatus === "IN_PROGRESS") return { label: "In progress", tone: "blue" as const, color: colors.blue, soft: colors.blueSoft };
  if (stop.visitStatus === "COMPLETED") {
    if (stop.visitOutcome === "LATER") return { label: "Do later", tone: "slate" as const, color: colors.muted, soft: "#F1F5F9" };
    if (stop.visitOutcome === "UNAVAILABLE") {
      return { label: "Missed", tone: "amber" as const, color: colors.amber, soft: colors.amberSoft };
    }
    return { label: "Done", tone: "green" as const, color: colors.green, soft: colors.greenSoft };
  }
  return { label: "Pending", tone: "slate" as const, color: colors.muted, soft: "#F1F5F9" };
}

function beatGroups(leads: Lead[]) {
  const map = new Map<number, { id: number; name: string; hq: string | null; leads: Lead[] }>();
  const unassigned: Lead[] = [];
  for (const lead of leads) {
    const beats = lead.beats ?? [];
    if (!beats.length) {
      unassigned.push(lead);
      continue;
    }
    for (const item of beats) {
      const group = map.get(item.id) ?? { id: item.id, name: item.name, hq: item.hq, leads: [] };
      group.leads.push(lead);
      map.set(item.id, group);
    }
  }
  const groups = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { groups, unassigned };
}

function LeadStop({
  lead,
  stop,
  beat,
  drafts,
  sending,
  canStart,
}: {
  lead: Lead;
  stop: BeatStop | null;
  beat: BeatToday;
  drafts: LocalVisit[];
  sending: boolean;
  canStart: boolean;
}) {
  const finished =
    stop?.visitStatus === "COMPLETED" && stop.visitOutcome !== "LATER" && stop.visitId != null;
  const openVisitId =
    stop?.visitStatus === "IN_PROGRESS" && stop.visitId
      ? stop.visitId
      : lead.lastVisit?.status === "IN_PROGRESS"
        ? lead.lastVisit.id
        : null;
  const draft = drafts.find((item) => item.leadId === lead.id || (stop?.customerId != null && item.customerId === stop.customerId));
  const blocked =
    Boolean(beat.activeVisit) || drafts.some((draft) => draft.leadId === lead.id || draft.customerId === stop?.customerId);
  const badge = stop ? stopBadge(stop, sending) : null;
  return (
    <Card style={styles.leadCard}>
      <Pressable onPress={() => router.push(`/lead/${lead.id}`)} style={styles.leadBody}>
        <View style={styles.stopHead}>
          <Text style={styles.leadName} numberOfLines={1}>
            {lead.name}
          </Text>
          {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
        </View>
        <Text style={styles.leadMeta} numberOfLines={1}>
          {[lead.city, lead.phone].filter(Boolean).join(" · ") || "No phone"}
        </Text>
      </Pressable>
      <ActionRow>
        {lead.phone ? <Button title="Call" tone="outline" size="sm" flex onPress={() => openCall(lead.phone)} /> : null}
        {lead.phone ? (
          <Button title="WhatsApp" tone="outline" size="sm" flex onPress={() => openWhatsApp(lead.phone)} />
        ) : null}
        {lead.latitude != null || lead.address || lead.mapsLink ? (
          <Button
            title="Map"
            tone="outline"
            size="sm"
            flex
            onPress={() => {
              if (lead.latitude == null && lead.mapsLink) {
                Linking.openURL(lead.mapsLink).catch(() => undefined);
                return;
              }
              openNavigate(lead.latitude, lead.longitude, [lead.address, lead.city].filter(Boolean).join(", "));
            }}
          />
        ) : null}
      </ActionRow>
      {sending ? (
        <Text style={styles.leadMeta}>Visit finished on this phone. It sends automatically.</Text>
      ) : draft && !draft.outcome ? (
        <Button
          title="Continue"
          tone="green"
          size="sm"
          onPress={() => router.push({ pathname: "/visit/draft", params: { id: draft.localId } } as unknown as Href)}
        />
      ) : openVisitId ? (
        <Button title="Continue" tone="green" size="sm" onPress={() => router.push(`/visit/${openVisitId}`)} />
      ) : finished ? (
        <Button title="View visit" tone="green" size="sm" onPress={() => router.push(`/visit/${stop!.visitId}`)} />
      ) : canStart && !blocked ? (
        <Button
          title="Start visit"
          tone="green"
          size="sm"
          onPress={() =>
            router.push({
              pathname: "/visit/check-in",
              params: {
                leadId: String(lead.id),
                beatStopId: stop?.id ? String(stop.id) : undefined,
              },
            })
          }
        />
      ) : null}
    </Card>
  );
}

export default function VisitsScreen() {
  const { accessToken, user } = useAuth();
  const manager = isManager(user?.roles);
  const offline = useOffline();
  const [beat, setBeat] = useState<BeatToday | null>(null);
  const [shopLeads, setShopLeads] = useState<Lead[]>([]);
  const [tomorrow, setTomorrow] = useState<BeatPlan | null>(null);
  const [drafts, setDrafts] = useState<LocalVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "history">("today");

  const load = useCallback(() => {
    if (!accessToken || manager) return;
    readLocalVisits().then(setDrafts);
    api<BeatToday>("/beat/today", { token: accessToken })
      .then(setBeat)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    api<{ leads: Lead[] }>("/leads?filter=all", { token: accessToken })
      .then((data) => setShopLeads(data.leads))
      .catch(() => setShopLeads([]));
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

  const assigned = useMemo(() => beatGroups(shopLeads), [shopLeads]);

  if (manager) {
    return <BeatsScreen embedded />;
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title={tab === "today" ? "Beat" : "Visit history"}
          subtitle={
            tab === "today"
              ? "Start a visit here, on a lead under a beat"
              : "Past visits and place-photo proof"
          }
        />
      }
    >
      <View style={styles.tabs}>
        <Chip label="Beats" on={tab === "today"} onPress={() => setTab("today")} />
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
              <Text style={styles.sectionLabel}>Today</Text>
              {beat.beatName ? (
                <Card style={styles.todayCard}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupTitle}>{beat.beatName}</Text>
                    <Badge label="Today" tone="green" />
                  </View>
                  <Text style={styles.groupMeta}>
                    {beat.territory?.trim() ? `HQ · ${beat.territory.trim()}` : "No HQ"}
                    {" · "}
                    {coverage.visited} visited · {coverage.missed} pending
                  </Text>
                </Card>
              ) : (
                <Card style={styles.todayCard}>
                  <Text style={styles.groupTitle}>No beat targeted for today</Text>
                  <Text style={styles.leadMeta}>
                    Start today’s visits from the leads under All beats. A manager assigns this beat to you and saves a repeating plan. It then shows up here on those days by itself.
                  </Text>
                </Card>
              )}

              {beat.activeVisit ? (
                <Pressable style={styles.active} onPress={() => router.push(`/visit/${beat.activeVisit!.id}`)}>
                  <Badge label="In progress" tone="green" />
                  <Text style={styles.name}>{beat.activeVisit.name}</Text>
                  <Text style={typo.muted}>Continue to take the place photo and complete.</Text>
                </Pressable>
              ) : null}

              {(() => {
                const todayGroup = assigned.groups.find((group) => group.id === beat.beatId) ?? null;
                const otherGroups = assigned.groups.filter((group) => group.id !== beat.beatId);
                const renderLeads = (groupId: number | "none", leads: Lead[], canStart: boolean) =>
                  leads.map((lead) => {
                    const stop = beat.stops.find((item) => item.leadId === lead.id) ?? null;
                    return (
                      <LeadStop
                        key={`${groupId}-${lead.id}`}
                        lead={lead}
                        stop={stop}
                        beat={beat}
                        drafts={drafts}
                        sending={stop ? sendingVisit(stop.visitId) : false}
                        canStart={canStart}
                      />
                    );
                  });
                return (
                  <>
                    {todayGroup ? <View style={styles.group}>{renderLeads(todayGroup.id, todayGroup.leads, true)}</View> : null}

                    <Text style={styles.sectionLabel}>All beats</Text>
                    {todayGroup ? (
                      <View style={styles.group}>
                        <View style={styles.groupHead}>
                          <Text style={styles.groupTitle}>{todayGroup.name}</Text>
                          <Badge label="Today" tone="green" />
                        </View>
                        <Text style={styles.groupMeta}>
                          {todayGroup.hq ? `HQ · ${todayGroup.hq}` : "No HQ"} · {todayGroup.leads.length} lead
                          {todayGroup.leads.length === 1 ? "" : "s"} · listed under Today
                        </Text>
                      </View>
                    ) : null}
                    {otherGroups.map((group) => (
                      <View key={group.id} style={styles.group}>
                        <View style={styles.groupHead}>
                          <Text style={styles.groupTitle}>{group.name}</Text>
                        </View>
                        <Text style={styles.groupMeta}>
                          {group.hq ? `HQ · ${group.hq}` : "No HQ"} · {group.leads.length} lead{group.leads.length === 1 ? "" : "s"}
                        </Text>
                        {renderLeads(group.id, group.leads, true)}
                      </View>
                    ))}

                    {assigned.unassigned.length ? (
                      <View style={styles.group}>
                        <Text style={styles.groupTitle}>No beat</Text>
                        <Text style={styles.groupMeta}>
                          {assigned.unassigned.length} lead{assigned.unassigned.length === 1 ? "" : "s"} not on a beat
                        </Text>
                        {renderLeads("none", assigned.unassigned, false)}
                      </View>
                    ) : null}

                    {!assigned.groups.length && !assigned.unassigned.length ? (
                      <EmptyState icon="location-outline" text="No beats yet. A manager adds leads to a beat on the desk." />
                    ) : null}
                  </>
                );
              })()}

              {tomorrow?.stops.length ? (
                <>
                  <View style={styles.tomorrowHead}>
                    <Ionicons name="calendar-outline" size={18} color={colors.ink} />
                    <Text style={styles.tomorrowTitle}>Tomorrow · {tomorrow.stops.length} planned</Text>
                  </View>
                  {tomorrow.stops.map((stop) => (
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
                </>
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
  sectionLabel: { color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: 4 },
  todayCard: { padding: 12, gap: 4 },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  group: { gap: 8 },
  groupTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  groupMeta: { color: colors.muted, fontSize: 13, fontWeight: "400", marginTop: -4 },
  leadCard: { padding: 12, gap: 8 },
  leadBody: { gap: 2 },
  leadName: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  leadMeta: { color: colors.muted, fontSize: 13, fontWeight: "400" },
  tomorrowHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  tomorrowTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  tomorrowCard: { backgroundColor: "#F8FAFC" },
});
