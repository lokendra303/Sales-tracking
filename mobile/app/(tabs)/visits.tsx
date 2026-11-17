import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, router, type Href } from "expo-router";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import BeatsScreen from "@/app/beats";
import { Badge, Button, Card, Chip, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { VisitHistory } from "@/components/visit-history";
import { useAuth } from "@/lib/auth";
import {
  api,
  type BeatStop,
  type BeatToday,
  type Lead,
  type UpcomingBeatDay,
  type UpcomingBeats,
} from "@/lib/api";
import { readLocalVisits, type LocalVisit } from "@/lib/local-visits";
import { useOffline } from "@/lib/offline";
import { isoDay, openCall, openNavigate, openWhatsApp } from "@/lib/format";
import { isManager } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

function stopBadge(stop: BeatStop, sending: boolean) {
  if (sending) return { label: "Sending", tone: "amber" as const };
  if (stop.visitStatus === "IN_PROGRESS") return { label: "In progress", tone: "blue" as const };
  if (stop.visitStatus === "COMPLETED") {
    if (stop.visitOutcome === "LATER") return { label: "Do later", tone: "slate" as const };
    if (stop.visitOutcome === "UNAVAILABLE") return { label: "Missed", tone: "amber" as const };
    return { label: "Done", tone: "green" as const };
  }
  return { label: "Pending", tone: "slate" as const };
}

function formatPlanDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
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
  const draft = drafts.find(
    (item) => item.leadId === lead.id || (stop?.customerId != null && item.customerId === stop.customerId),
  );
  const blocked =
    Boolean(beat.activeVisit) ||
    drafts.some((item) => item.leadId === lead.id || item.customerId === stop?.customerId);
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
      <View style={styles.actions}>
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
      </View>
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

function StopOnlyCard({
  stop,
  beat,
  drafts,
  sending,
  canStart,
}: {
  stop: BeatStop;
  beat: BeatToday;
  drafts: LocalVisit[];
  sending: boolean;
  canStart: boolean;
}) {
  const finished = stop.visitStatus === "COMPLETED" && stop.visitOutcome !== "LATER" && stop.visitId != null;
  const openVisitId = stop.visitStatus === "IN_PROGRESS" && stop.visitId ? stop.visitId : null;
  const draft = drafts.find(
    (item) =>
      (stop.leadId != null && item.leadId === stop.leadId) ||
      (stop.customerId != null && item.customerId === stop.customerId),
  );
  const blocked =
    Boolean(beat.activeVisit) ||
    drafts.some(
      (item) =>
        (stop.leadId != null && item.leadId === stop.leadId) ||
        (stop.customerId != null && item.customerId === stop.customerId),
    );
  const badge = stopBadge(stop, sending);
  return (
    <Card style={styles.leadCard}>
      <View style={styles.leadBody}>
        <View style={styles.stopHead}>
          <Text style={styles.leadName} numberOfLines={1}>
            {stop.name}
          </Text>
          <Badge label={badge.label} tone={badge.tone} />
        </View>
        <Text style={styles.leadMeta} numberOfLines={1}>
          {[stop.city, stop.phone].filter(Boolean).join(" · ") || "No phone"}
        </Text>
      </View>
      <View style={styles.actions}>
        {stop.phone ? <Button title="Call" tone="outline" size="sm" flex onPress={() => openCall(stop.phone!)} /> : null}
        {stop.phone ? (
          <Button title="WhatsApp" tone="outline" size="sm" flex onPress={() => openWhatsApp(stop.phone!)} />
        ) : null}
        {stop.placeLat != null || stop.address ? (
          <Button
            title="Map"
            tone="outline"
            size="sm"
            flex
            onPress={() => openNavigate(stop.placeLat, stop.placeLng, [stop.address, stop.city].filter(Boolean).join(", "))}
          />
        ) : null}
      </View>
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
        <Button title="View visit" tone="green" size="sm" onPress={() => router.push(`/visit/${stop.visitId}`)} />
      ) : canStart && !blocked && stop.leadId ? (
        <Button
          title="Start visit"
          tone="green"
          size="sm"
          onPress={() =>
            router.push({
              pathname: "/visit/check-in",
              params: {
                leadId: String(stop.leadId),
                beatStopId: stop.id ? String(stop.id) : undefined,
              },
            })
          }
        />
      ) : null}
    </Card>
  );
}

function UpcomingCard({ day }: { day: UpcomingBeatDay }) {
  return (
    <Card style={styles.upcomingCard}>
      <View style={styles.groupHead}>
        <Text style={styles.groupTitle}>{day.beatName}</Text>
        <Badge label="Upcoming" tone="slate" />
      </View>
      <Text style={styles.groupMeta}>
        {formatPlanDay(day.date)}
        {day.territory?.trim() ? ` · HQ · ${day.territory.trim()}` : ""}
        {" · "}
        {day.shops} shop{day.shops === 1 ? "" : "s"}
      </Text>
      <Text style={styles.upcomingHint}>Start visit opens on this day.</Text>
    </Card>
  );
}

export default function VisitsScreen() {
  const { accessToken, user } = useAuth();
  const manager = isManager(user?.roles);
  const offline = useOffline();
  const [beat, setBeat] = useState<BeatToday | null>(null);
  const [shopLeads, setShopLeads] = useState<Lead[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingBeatDay[]>([]);
  const [drafts, setDrafts] = useState<LocalVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [tab, setTab] = useState<"today" | "upcoming" | "history">("today");

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
  }, [accessToken, manager]);

  const loadUpcoming = useCallback(() => {
    if (!accessToken || manager) return;
    setUpcomingLoading(true);
    api<UpcomingBeats>("/beat/upcoming?days=30", { token: accessToken })
      .then((data) => setUpcoming(data.days.filter((day) => day.date > isoDay())))
      .catch(() => setUpcoming([]))
      .finally(() => setUpcomingLoading(false));
  }, [accessToken, manager]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (tab === "upcoming") loadUpcoming();
    }, [load, loadUpcoming, tab]),
  );

  useEffect(() => {
    load();
  }, [offline.pending, load]);

  useEffect(() => {
    if (tab === "upcoming") loadUpcoming();
  }, [tab, loadUpcoming]);

  const sendingVisit = (visitId: number | null) =>
    visitId != null && offline.jobs.some((job) => job.kind === "visit-complete" && job.path === `/visits/${visitId}/complete`);

  const coverage = useMemo(() => {
    if (!beat) return { visited: 0, total: 0, missed: 0 };
    const total = beat.beatSize ?? beat.stops.length;
    const visited = beat.visitedOnBeat ?? beat.completedToday;
    const missed = beat.missedOnBeat ?? Math.max(0, total - visited);
    return { visited, total, missed };
  }, [beat]);

  const header =
    tab === "today"
      ? {
          title: "Today’s beats",
          subtitle: "Only today’s plan. Start visit is here.",
        }
      : tab === "upcoming"
        ? {
            title: "Upcoming beats",
            subtitle: "Future plans. Start visit opens on the day.",
          }
        : {
            title: "Visit history",
            subtitle: "Past visits and place-photo proof",
          };

  if (manager) {
    return <BeatsScreen embedded />;
  }

  return (
    <Screen header={<ScreenHeader title={header.title} subtitle={header.subtitle} />}>
      <View style={styles.tabs}>
        <Chip label="Today’s beats" on={tab === "today"} onPress={() => setTab("today")} />
        <Chip label="Upcoming" on={tab === "upcoming"} onPress={() => setTab("upcoming")} />
        <Chip label="History" on={tab === "history"} onPress={() => setTab("history")} />
      </View>

      {tab === "history" ? <VisitHistory /> : null}

      {tab === "upcoming" ? (
        upcomingLoading && !upcoming.length ? (
          <ActivityIndicator color={colors.blue} />
        ) : !upcoming.length ? (
          <EmptyState icon="calendar-outline" text="No upcoming beats yet. When a manager saves future dates, they show here." />
        ) : (
          <>
            <Text style={styles.sectionLabel}>Next {upcoming.length} planned day{upcoming.length === 1 ? "" : "s"}</Text>
            {upcoming.map((day) => (
              <UpcomingCard key={`${day.date}-${day.beatId}`} day={day} />
            ))}
          </>
        )
      ) : null}

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
                    When a manager assigns today’s beat, shops and Start visit show up here. Future dates stay under Upcoming.
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

              {beat.stops.length ? (
                <View style={styles.group}>
                  {beat.stops.map((stop) => {
                    const lead = stop.leadId ? shopLeads.find((item) => item.id === stop.leadId) ?? null : null;
                    if (lead) {
                      return (
                        <LeadStop
                          key={`stop-${stop.id ?? stop.leadId}-${stop.sequence}`}
                          lead={lead}
                          stop={stop}
                          beat={beat}
                          drafts={drafts}
                          sending={sendingVisit(stop.visitId)}
                          canStart
                        />
                      );
                    }
                    return (
                      <StopOnlyCard
                        key={`stop-${stop.id ?? stop.customerId}-${stop.sequence}`}
                        stop={stop}
                        beat={beat}
                        drafts={drafts}
                        sending={sendingVisit(stop.visitId)}
                        canStart
                      />
                    );
                  })}
                </View>
              ) : beat.beatName ? (
                <EmptyState icon="location-outline" text="Today’s beat has no shops yet." />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  active: {
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
    gap: 6,
  },
  stopHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  name: { fontWeight: "800", color: colors.text, fontSize: 16, flex: 1 },
  sectionLabel: { color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: 4 },
  todayCard: { padding: 12, gap: 4 },
  upcomingCard: { padding: 12, gap: 4, backgroundColor: "#F8FAFC" },
  upcomingHint: { color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  group: { gap: 8 },
  groupTitle: { color: colors.text, fontSize: 16, fontWeight: "600", flex: 1 },
  groupMeta: { color: colors.muted, fontSize: 13, fontWeight: "400" },
  leadCard: { padding: 12, gap: 8 },
  leadBody: { gap: 2 },
  leadName: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  leadMeta: { color: colors.muted, fontSize: 13, fontWeight: "400" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
