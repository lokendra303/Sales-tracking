import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ExecFilter, useExecutives, type ExecValue } from "@/components/exec-filter";
import { ActionRow, Badge, Button, Card, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type BeatPlan, type BeatToday, type Visit } from "@/lib/api";
import { openCall, openNavigate, openWhatsApp, tomorrowDay, when } from "@/lib/format";
import { isManager } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

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
  const [beat, setBeat] = useState<BeatToday | null>(null);
  const [tomorrow, setTomorrow] = useState<BeatPlan | null>(null);
  const [proofs, setProofs] = useState<Visit[]>([]);
  const [exec, setExec] = useState<ExecValue>(execFromParam(params.userId));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setExec(execFromParam(params.userId));
  }, [params.userId]);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      if (manager) {
        const qs = typeof exec === "number" ? `&userId=${exec}` : "";
        api<Visit[]>(`/visits?days=14${qs}`, { token: accessToken })
          .then(setProofs)
          .catch(() => undefined)
          .finally(() => setLoading(false));
        return;
      }
      api<BeatToday>("/beat/today", { token: accessToken })
        .then(setBeat)
        .catch(() => undefined)
        .finally(() => setLoading(false));
      api<BeatPlan>(`/beat?date=${tomorrowDay()}`, { token: accessToken })
        .then(setTomorrow)
        .catch(() => undefined);
    }, [accessToken, manager, exec]),
  );

  if (manager) {
    return (
      <Screen header={<ScreenHeader title="Visit proof" subtitle="Pick an executive, or keep the whole team" />}>
        <ExecFilter people={people} value={exec} onChange={setExec} />
        {loading ? (
          <ActivityIndicator color={colors.blue} />
        ) : proofs.length === 0 ? (
          <EmptyState icon="camera-outline" text="No visits in this view. The executive uploads a shop photo after check-in." />
        ) : (
          proofs.map((visit) => (
            <Pressable key={visit.id} onPress={() => router.push(`/visit/${visit.id}`)}>
              <Card>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{visit.name}</Text>
                    <Text style={typo.muted}>
                      {visit.userName || "Sales"} · {when(visit.checkedInAt)}
                    </Text>
                    <Text style={typo.muted}>
                      {visit.hasPhoto ? "Photo uploaded" : "No photo"}
                      {visit.verified ? " · GPS verified" : " · GPS not verified"}
                      {visit.distanceMeters != null ? ` · ${visit.distanceMeters} m` : ""}
                    </Text>
                  </View>
                  <Badge
                    label={visit.managerConfirmedAt ? "Confirmed" : visit.outcome === "UNAVAILABLE" ? "Missed" : visit.status === "IN_PROGRESS" ? "Live visit" : "Review"}
                    tone={visit.managerConfirmedAt ? "green" : visit.outcome === "UNAVAILABLE" ? "amber" : "blue"}
                  />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </Screen>
    );
  }

  return (
    <Screen header={<ScreenHeader title="Visits" subtitle="Today’s beat · check in, then take a shop photo" />}>
      {loading || !beat ? (
        <ActivityIndicator color={colors.blue} />
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
            {beat.completedToday} done · {beat.stops.length} stops · {beat.radiusMeters} m check-in
          </Text>
          {beat.stops.map((stop) => {
            const done = stop.visitStatus === "COMPLETED";
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
                  </View>
                  <Badge
                    label={done ? (stop.visitOutcome === "UNAVAILABLE" ? "Missed" : "Done") : "Pending"}
                    tone={done ? (stop.visitOutcome === "UNAVAILABLE" ? "amber" : "green") : "amber"}
                  />
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
                {done && stop.visitId ? (
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
                ) : beat.activeVisit ? null : (
                  <Button title="Check location" tone="green" onPress={() => router.push({ pathname: "/visit/check-in", params })} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
