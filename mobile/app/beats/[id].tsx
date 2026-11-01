import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useExecutives } from "@/components/exec-filter";
import { Badge, Button, Card, EmptyState, Screen, ScreenHeader, SearchBox } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Lead, type PermanentBeat } from "@/lib/api";
import { isManager } from "@/lib/roles";
import { colors, radius, shadow, typo } from "@/lib/theme";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };

function AssignMenu({
  people,
  value,
  onChange,
}: {
  people: { id: number; name: string }[];
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = people.find((person) => person.id === value)?.name ?? "Not assigned";
  return (
    <View style={[styles.menu, open && styles.menuOpen]}>
      <Pressable style={styles.menuBtn} onPress={() => setOpen((on) => !on)} accessibilityRole="button">
        <Text style={styles.menuText} numberOfLines={1}>
          {current}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.menuList}>
          <Pressable
            style={[styles.menuItem, value == null && styles.menuItemOn]}
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <Text style={[styles.menuItemText, value == null && styles.menuItemTextOn]}>Not assigned</Text>
          </Pressable>
          {people.map((person) => {
            const on = person.id === value;
            return (
              <Pressable
                key={person.id}
                style={[styles.menuItem, on && styles.menuItemOn]}
                onPress={() => {
                  onChange(person.id);
                  setOpen(false);
                }}
              >
                <Text style={[styles.menuItemText, on && styles.menuItemTextOn]} numberOfLines={1}>
                  {person.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function BeatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const beatId = Number(id);
  const { accessToken, user } = useAuth();
  const manager = isManager(user?.roles);
  const { people } = useExecutives();
  const [beat, setBeat] = useState<PermanentBeat | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [planDays, setPlanDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [repeatEvery, setRepeatEvery] = useState(7);

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

  useEffect(() => {
    if (!beat) return;
    const every = beat.repeatEvery && beat.repeatEvery >= 2 ? beat.repeatEvery : 7;
    setRepeatEvery(every);
    setPlanDays(beat.repeatDays?.length ? beat.repeatDays : every === 7 ? [1, 2, 3, 4, 5, 6, 0] : [0]);
  }, [beat]);

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
      if (beat?.assigneeId && lead.assigneeId && lead.assigneeId !== beat.assigneeId) return false;
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

  async function assignTo(next: number | null) {
    if (!accessToken || !beat || next === beat.assigneeId) return;
    setBusy(true);
    try {
      await api(`/beats/${beat.id}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ assigneeId: next }),
      });
      setNote("");
      setError("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the salesperson.");
    } finally {
      setBusy(false);
    }
  }

  function toggleDay(day: number) {
    setPlanDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  }

  function chooseEvery(next: number) {
    const every = Math.min(30, Math.max(2, next));
    setRepeatEvery(every);
    setPlanDays((current) => {
      if (every === repeatEvery) return current;
      if (every === 7) return [1, 2, 3, 4, 5, 6, 0];
      return [0];
    });
  }

  async function savePlan() {
    if (!accessToken || !beat) return;
    if (!beat.assigneeId) {
      setError("Assign a salesperson before the daily plan.");
      return;
    }
    if (planDays.length && !beat.size) {
      setError("Add at least one lead before the daily plan.");
      return;
    }
    setBusy(true);
    setError("");
    setNote("");
    try {
      const saved = await api<PermanentBeat>(`/beats/${beat.id}/repeat`, {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({ weekdays: planDays.filter((day) => day < repeatEvery), every: repeatEvery }),
      });
      const who = saved.assigneeName ?? "The salesperson";
      const cycle = saved.repeatEvery && saved.repeatEvery >= 2 ? saved.repeatEvery : 7;
      const days = saved.repeatDays ?? [];
      setNote(
        !days.length
          ? "Daily plan cleared."
          : cycle === 7 && days.length === 7
            ? `${who} gets “${saved.name}” every day. It shows up as today’s beat on its own.`
            : cycle === 7
              ? `${who} gets “${saved.name}” on the selected days every week.`
              : days.length === 1 && days[0] === 0
                ? `${who} gets “${saved.name}” every ${cycle} days. It shows up as today’s beat on its own.`
                : `${who} gets “${saved.name}” on the selected days of every ${cycle} days.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the daily plan.");
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
          subtitle={`${beat.assigneeName ? `Assigned to ${beat.assigneeName}` : "Not assigned"} · ${beat.size} leads`}
          back
        />
      }
    >
      <Card style={styles.hero}>
        <Text style={styles.heroKicker}>Beat target</Text>
        <Text style={styles.heroTitle}>{beat.name}</Text>
        <Text style={typo.muted}>HQ · {beat.territory?.trim() || "Not set"}</Text>
        <Text style={styles.heroMeta}>
          {beat.size} shop{beat.size === 1 ? "" : "s"} · assign a salesperson, then they can run this beat
        </Text>
        <Text style={styles.assignLabel}>Salesperson</Text>
        <AssignMenu people={people} value={beat.assigneeId} onChange={(next) => void assignTo(next)} />
        <Text style={styles.assignLabel}>Repeating plan</Text>
        <Text style={styles.planHelp}>
          Choose 2 to 30 days. This beat is today’s task on the days you pick, then those same days come back after that many days. You do not assign it again.
        </Text>
        <Text style={styles.everyLabel}>Repeat every</Text>
        <View style={styles.everyRow}>
          <Pressable style={styles.everyBtn} onPress={() => chooseEvery(repeatEvery - 1)} disabled={busy || repeatEvery <= 2}>
            <Ionicons name="remove" size={18} color="#fff" />
          </Pressable>
          <Text style={styles.everyValue}>{repeatEvery}</Text>
          <Pressable style={styles.everyBtn} onPress={() => chooseEvery(repeatEvery + 1)} disabled={busy || repeatEvery >= 30}>
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
          <Text style={styles.planHelp}>days</Text>
          {[7, 15, 30].map((count) => {
            const on = repeatEvery === count;
            return (
              <Pressable key={count} style={[styles.day, on && styles.dayOn]} onPress={() => chooseEvery(count)} disabled={busy}>
                <Text style={[styles.dayText, on && styles.dayTextOn]}>{count}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.days}>
          {repeatEvery === 7
            ? DAY_ORDER.map((day) => {
                const on = planDays.includes(day);
                return (
                  <Pressable key={day} style={[styles.day, on && styles.dayOn]} onPress={() => toggleDay(day)} disabled={busy}>
                    <Text style={[styles.dayText, on && styles.dayTextOn]}>{DAY_LABEL[day]}</Text>
                  </Pressable>
                );
              })
            : Array.from({ length: repeatEvery }, (_, index) => {
                const on = planDays.includes(index);
                return (
                  <Pressable key={index} style={[styles.day, styles.dayNum, on && styles.dayOn]} onPress={() => toggleDay(index)} disabled={busy}>
                    <Text style={[styles.dayText, on && styles.dayTextOn]}>{index + 1}</Text>
                  </Pressable>
                );
              })}
        </View>
        {repeatEvery === 7 ? null : (
          <Text style={styles.planHelp}>1 is the first day. The same days return after {repeatEvery} days.</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <Button
          title={busy ? "Saving…" : beat.assigneeId ? "Save repeating plan" : "Assign a salesperson first"}
          tone="green"
          onPress={savePlan}
          disabled={busy || !beat.assigneeId || (!beat.size && planDays.length > 0)}
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
  assignLabel: { color: "#94A3B8", fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  planHelp: { color: "#CBD5E1", fontSize: 13, lineHeight: 18 },
  everyLabel: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  everyRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  everyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  everyValue: { color: "#fff", fontSize: 20, fontWeight: "800", minWidth: 28, textAlign: "center" },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayNum: { minWidth: 36, alignItems: "center", paddingHorizontal: 8 },
  day: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1E293B",
  },
  dayOn: { backgroundColor: "#fff" },
  dayText: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  dayTextOn: { color: colors.blue },
  error: { color: "#FCA5A5", fontWeight: "600" },
  note: { color: "#86EFAC", fontWeight: "600" },
  menu: { zIndex: 4 },
  menuOpen: { zIndex: 20 },
  menuBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  menuList: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 6,
    elevation: 8,
    ...shadow,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" },
  menuItemOn: { backgroundColor: colors.blueSoft },
  menuItemText: { color: colors.text, fontSize: 14 },
  menuItemTextOn: { color: colors.blue, fontWeight: "600" },
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
