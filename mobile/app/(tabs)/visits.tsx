import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, router, useLocalSearchParams, type Href } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ExecFilter, useExecutives, type ExecValue } from "@/components/exec-filter";
import { ActionRow, Badge, Button, Card, Chip, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { VisitHistory } from "@/components/visit-history";
import { useAuth } from "@/lib/auth";
import { api, type BeatPlan, type BeatStop, type BeatToday } from "@/lib/api";
import { readLocalVisits, type LocalVisit } from "@/lib/local-visits";
import { useOffline } from "@/lib/offline";
import { openCall, openNavigate, openWhatsApp, tomorrowDay, when } from "@/lib/format";
import { isManager } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

function stopBadge(stop: BeatStop, sending: boolean) {
  if (sending) return { label: "Sending", tone: "amber" as const };
  if (stop.visitStatus === "IN_PROGRESS") return { label: "In progress", tone: "blue" as const };
  if (stop.visitStatus === "COMPLETED") {
    if (stop.visitOutcome === "UNAVAILABLE") return { label: "Missed", tone: "amber" as const };
    return { label: "Done", tone: "green" as const };
  }
  return { label: "Pending", tone: "slate" as const };
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

  if (manager) {
    return (
      <Screen header={<ScreenHeader title="Team visits" subtitle="Filter by executive, date and status" />}>
        <ExecFilter people={people} value={exec} onChange={setExec} />
        <VisitHistory userId={typeof exec === "number" ? exec : undefined} showPerson />
      </Screen>
    );
  }

  return (
      <Screen header={<ScreenHeader title="Visits" subtitle={tab === "today" ? "Today’s beat · check in, then take a shop photo" : "Filter completed visits by start and end date"} />}>
      <View style={styles.tabs}>
        <Chip label="Today" on={tab === "today"} onPress={() => setTab("today")} />
        <Chip label="History" on={tab === "history"} onPress={() => setTab("history")} />
      </View>
      {tab === "history" ? <VisitHistory /> : null}
      {tab === "today" ? (
      <>
      {drafts.map((draft) => (
        <Pressable key={draft.localId} style={styles.active} onPress={() => router.push({ pathname: "/visit/draft", params: { id: draft.localId } } as unknown as Href)}>
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
          {beat.activeVisit ? (
            <Pressable style={styles.active} onPress={() => router.push(`/visit/${beat.activeVisit!.id}`)}>
              <Badge label="In progress" tone="green" />
              <Text style={styles.name}>{beat.activeVisit.name}</Text>
              <Text style={typo.muted}>Continue to take the place photo and complete.</Text>
            </Pressable>
          ) : null}
          <Text style={styles.count}>
            {beat.completedToday} done · {beat.stops.length} stops · finish within 300 m
          </Text>
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
              <Card key={`${stop.leadId}-${stop.customerId}-${stop.sequence}`}>
                <View style={styles.row}>
                  <View style={styles.seq}>
                    <Text style={styles.seqText}>{stop.sequence}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{stop.name}</Text>
                    <Text style={typo.muted}>{[stop.address, stop.city].filter(Boolean).join(", ") || "No address"}</Text>
                    <Text style={typo.muted}>{stop.phone}</Text>
                    {done && stop.visitAt ? <Text style={typo.muted}>Finished {when(stop.visitAt)}</Text> : null}
                  </View>
                  <Badge label={badge.label} tone={badge.tone} />
                </View>
                <ActionRow>
                  {stop.phone ? <Button title="Call" flex onPress={() => openCall(stop.phone!)} /> : null}
                  {stop.phone ? <Button title="WhatsApp" tone="outline" flex onPress={() => openWhatsApp(stop.phone!)} /> : null}
                  <Button
                    title="Navigate"
                    tone="outline"
                    flex
                    onPress={() => openNavigate(stop.placeLat, stop.placeLng, [stop.address, stop.city].filter(Boolean).join(", "))}
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
                ) : beat.activeVisit || drafts.some((draft) => draft.leadId === stop.leadId || draft.customerId === stop.customerId) ? null : (
                  <Button title="Start visit" tone="green" onPress={() => router.push({ pathname: "/visit/check-in", params })} />
                )}
              </Card>
            );
          })}
          {!beat.stops.length ? <EmptyState icon="location-outline" text="No stops today. Open a lead and start a visit." /> : null}
          <Text style={styles.count}>Tomorrow · {tomorrow?.stops.length ?? 0} planned</Text>
          {(tomorrow?.stops ?? []).map((stop) => (
            <Card key={`t-${stop.id}`}>
              <View style={styles.row}>
                <View style={styles.seq}>
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
            <EmptyState icon="calendar-outline" text="Manager has not planned tomorrow yet." />
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
  count: { color: colors.muted, fontWeight: "700" },
  active: {
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
    gap: 6,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  seq: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  seqText: { color: "#fff", fontWeight: "800" },
  name: { fontWeight: "800", color: colors.text, fontSize: 16 },
  ok: { color: colors.green, fontWeight: "800" },
});
