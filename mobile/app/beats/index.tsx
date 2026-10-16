import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect, type Href } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExecPicker, useExecutives } from "@/components/exec-filter";
import { Button, Card, EmptyState, Field, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type PermanentBeat } from "@/lib/api";
import { isManager } from "@/lib/roles";
import { colors, radius, shadow, typo } from "@/lib/theme";

export default function BeatsScreen() {
  const { accessToken, user } = useAuth();
  const manager = isManager(user?.roles);
  const { people } = useExecutives();
  const [beats, setBeats] = useState<PermanentBeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [territory, setTerritory] = useState("");
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!accessToken || !manager) return;
    setLoading(true);
    api<PermanentBeat[]>("/beats", { token: accessToken })
      .then((rows) => {
        setBeats(rows);
        if (!assigneeId && people[0]) setAssigneeId(people[0].id);
      })
      .catch(() => setBeats([]))
      .finally(() => setLoading(false));
  }, [accessToken, assigneeId, manager, people]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    const map = new Map<number, PermanentBeat[]>();
    for (const beat of beats) {
      const list = map.get(beat.assigneeId) ?? [];
      list.push(beat);
      map.set(beat.assigneeId, list);
    }
    return map;
  }, [beats]);

  async function create() {
    if (!accessToken || !assigneeId || name.trim().length < 2) {
      Alert.alert("Name needed", "Enter a beat name (e.g. North Zone).");
      return;
    }
    setBusy(true);
    try {
      const beat = await api<PermanentBeat>("/beats", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: name.trim(),
          assigneeId,
          territory: territory.trim() || undefined,
        }),
      });
      setName("");
      setTerritory("");
      setCreating(false);
      load();
      router.push(`/beats/${beat.id}` as Href);
    } catch (err) {
      Alert.alert("Could not create", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!manager) {
    return (
      <Screen header={<ScreenHeader title="Beats" back />}>
        <EmptyState icon="map-outline" text="Only managers build beats. Sales sees today’s beat under Visits." />
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title="Beats"
          subtitle="Route groups · add many leads, then schedule for the executive"
          back
          right={
            <Pressable style={styles.add} onPress={() => setCreating((v) => !v)} accessibilityLabel="New beat">
              <Ionicons name={creating ? "close" : "add"} size={22} color="#fff" />
            </Pressable>
          }
        />
      }
    >
      {creating ? (
        <Card>
          <Text style={styles.section}>New beat (group)</Text>
          <Text style={typo.muted}>Like the portal: name the route, pick who owns it, then add shops.</Text>
          <Field label="Beat name" value={name} onChangeText={setName} placeholder="North Zone / Sector 12" />
          <Field label="Area (optional)" value={territory} onChangeText={setTerritory} placeholder="Territory label" />
          <Text style={styles.label}>Assigned executive</Text>
          <ExecPicker people={people} value={assigneeId} onChange={setAssigneeId} />
          <Button title={busy ? "Saving…" : "Create beat"} tone="green" onPress={create} disabled={busy} />
        </Card>
      ) : null}

      {loading ? <ActivityIndicator color={colors.blue} /> : null}

      {!loading && !beats.length ? (
        <EmptyState icon="map-outline" text="No beats yet. Create one, add multiple leads, then put it on the schedule." />
      ) : null}

      {people.map((person) => {
        const list = grouped.get(person.id) ?? [];
        if (!list.length && !creating) return null;
        return (
          <View key={person.id} style={styles.group}>
            <Text style={styles.groupTitle}>{person.name}</Text>
            <Text style={typo.muted}>{list.length} beat{list.length === 1 ? "" : "s"}</Text>
            {list.map((beat) => (
              <Pressable
                key={beat.id}
                style={styles.card}
                onPress={() => router.push(`/beats/${beat.id}` as Href)}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.name}>{beat.name}</Text>
                  {beat.territory ? <Text style={typo.muted}>{beat.territory}</Text> : null}
                  <Text style={styles.meta}>
                    {beat.size} lead{beat.size === 1 ? "" : "s"} · tap to add more
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { fontSize: 17, fontWeight: "700", color: colors.ink },
  label: { ...typo.muted, marginTop: 8, marginBottom: 4 },
  group: { gap: 8, marginBottom: 8 },
  groupTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 13, fontWeight: "600", color: colors.blue },
});
