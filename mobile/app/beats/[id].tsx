import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, EmptyState, Screen, ScreenHeader, SearchBox } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Lead, type PermanentBeat } from "@/lib/api";
import { isManager } from "@/lib/roles";
import { colors, radius, shadow, typo } from "@/lib/theme";

export default function BeatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const beatId = Number(id);
  const { accessToken, user } = useAuth();
  const manager = isManager(user?.roles);
  const [beat, setBeat] = useState<PermanentBeat | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !manager || !beatId) return;
    setLoading(true);
    try {
      const [allBeats, pack] = await Promise.all([
        api<PermanentBeat[]>("/beats", { token: accessToken }),
        api<{ leads: Lead[] }>("/leads?filter=all", { token: accessToken }),
      ]);
      const found = allBeats.find((b) => b.id === beatId) ?? null;
      setBeat(found);
      setLeads(pack.leads ?? []);
    } catch {
      setBeat(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, beatId, manager]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const taken = useMemo(() => {
    const keys = new Set<number>();
    for (const m of beat?.members ?? []) {
      if (m.leadId) keys.add(m.leadId);
    }
    return keys;
  }, [beat]);

  const available = useMemo(() => {
    const hay = q.trim().toLowerCase();
    return leads.filter((lead) => {
      if (lead.status === "LOST" || lead.status === "WON") return false;
      if (lead.approvalStatus && lead.approvalStatus !== "APPROVED") return false;
      if (taken.has(lead.id)) return false;
      if (lead.assigneeId && beat && lead.assigneeId !== beat.assigneeId) return false;
      if (!hay) return true;
      return `${lead.name} ${lead.phone} ${lead.city ?? ""}`.toLowerCase().includes(hay);
    });
  }, [beat, leads, q, taken]);

  async function addLead(leadId: number) {
    if (!accessToken || !beat) return;
    setBusy(true);
    try {
      await api(`/beats/${beat.id}/members`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ leadId }),
      });
      await load();
    } catch (err) {
      Alert.alert("Could not add", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: number) {
    if (!accessToken) return;
    setBusy(true);
    try {
      await api(`/beats/members/${memberId}`, { method: "DELETE", token: accessToken });
      await load();
    } catch (err) {
      Alert.alert("Could not remove", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Put this beat on today’s slot in the executive’s cycle (same as desk schedule). */
  async function scheduleToday() {
    if (!accessToken || !beat) return;
    if (!beat.size) {
      Alert.alert("Add leads first", "A beat needs at least one lead before the salesperson can run it.");
      return;
    }
    Alert.alert(
      "Use for today?",
      `${beat.assigneeName ?? "Executive"} will get “${beat.name}” (${beat.size} leads) as today’s target on the phone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Schedule today", onPress: () => void runScheduleToday() },
      ],
    );
  }

  async function runScheduleToday() {
    if (!accessToken || !beat) return;
    setBusy(true);
    try {
      const sched = await api<{
        cycleLength: number;
        startDate: string;
        todayIndex: number | null;
        days: Record<string, { beatId: number; beatName: string } | null>;
      }>(`/beat/schedule?userId=${beat.assigneeId}`, { token: accessToken });

      const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const cycleLength = sched.cycleLength || 7;
      const days: Record<string, number | null> = {};
      for (let i = 0; i < cycleLength; i++) {
        days[String(i)] = sched.days?.[String(i)]?.beatId ?? null;
      }
      // Anchor cycle on today so day 0 is today, then assign this beat.
      days["0"] = beat.id;
      for (let i = 1; i < cycleLength; i++) {
        if (days[String(i)] === beat.id) days[String(i)] = null;
      }

      await api("/beat/schedule", {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({
          userId: beat.assigneeId,
          cycleLength,
          startDate: todayIso,
          days,
        }),
      });
      Alert.alert(
        "Scheduled for today",
        `${beat.assigneeName ?? "Executive"} will see “${beat.name}” with ${beat.size} leads under Visits → Today.`,
      );
    } catch (err) {
      Alert.alert("Could not schedule", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!manager) {
    return (
      <Screen header={<ScreenHeader title="Beat" back />}>
        <EmptyState icon="map-outline" text="Only managers edit beats." />
      </Screen>
    );
  }

  if (loading && !beat) {
    return (
      <Screen header={<ScreenHeader title="Beat" back />}>
        <ActivityIndicator color={colors.blue} />
      </Screen>
    );
  }

  if (!beat) {
    return (
      <Screen header={<ScreenHeader title="Beat" back />}>
        <EmptyState icon="map-outline" text="Beat not found." />
        <Button title="Back to beats" onPress={() => router.replace("/beats" as Href)} />
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title={beat.name}
          subtitle={`${beat.assigneeName ?? "Executive"} · ${beat.size} leads in this target`}
          back
        />
      }
    >
      <Card style={styles.hero}>
        <Text style={styles.heroKicker}>Beat target</Text>
        <Text style={styles.heroTitle}>{beat.name}</Text>
        {beat.territory ? <Text style={typo.muted}>{beat.territory}</Text> : null}
        <Text style={styles.heroMeta}>
          {beat.size} shop{beat.size === 1 ? "" : "s"} · salesperson runs these one by one today
        </Text>
        <Button
          title={busy ? "Working…" : "Use this beat for today"}
          tone="green"
          onPress={scheduleToday}
          disabled={busy || !beat.size}
        />
      </Card>

      <Text style={styles.section}>Leads on this beat</Text>
      {!beat.members.length ? (
        <EmptyState icon="briefcase-outline" text="No leads yet. Add several below — that list is the salesperson’s target." />
      ) : (
        beat.members.map((m) => (
          <View key={m.id} style={styles.row}>
            <View style={styles.seq}>
              <Text style={styles.seqText}>{m.sequence}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={typo.muted}>{[m.phone, m.city].filter(Boolean).join(" · ") || "—"}</Text>
            </View>
            <Pressable onPress={() => removeMember(m.id)} disabled={busy} hitSlop={8}>
              <Badge label="Remove" tone="red" />
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.section}>Add more leads</Text>
      <SearchBox value={q} onChangeText={setQ} placeholder="Search approved leads" />
      {available.slice(0, 40).map((lead) => (
        <Pressable key={lead.id} style={styles.row} onPress={() => addLead(lead.id)} disabled={busy}>
          <Ionicons name="add-circle" size={22} color={colors.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{lead.name}</Text>
            <Text style={typo.muted}>{[lead.phone, lead.city].filter(Boolean).join(" · ")}</Text>
          </View>
        </Pressable>
      ))}
      {!available.length ? <Text style={typo.muted}>No more matching leads to add.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8, backgroundColor: "#0F172A" },
  heroKicker: { color: "#94A3B8", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  heroMeta: { color: "#BFDBFE", fontWeight: "600", marginBottom: 4 },
  section: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  seq: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  seqText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
});
