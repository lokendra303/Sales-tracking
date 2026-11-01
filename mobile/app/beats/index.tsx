import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect, type Href } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, EmptyState, Field, Screen, ScreenHeader, SearchBox } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Hq, type Lead, type PermanentBeat } from "@/lib/api";
import { isManager } from "@/lib/roles";
import { colors, radius, shadow, typo } from "@/lib/theme";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type HqFilter = "all" | "none" | number;

function planLabel(days: number[] | null | undefined, every?: number | null) {
  const cycle = every && every >= 2 ? every : 7;
  if (!days?.length) return "No daily plan yet";
  if (cycle === 7) {
    if (days.length === 7) return "Repeats every day";
    const names = DAY_ORDER.filter((day) => days.includes(day)).map((day) => DAY_NAMES[day]);
    return `Repeats ${names.join(", ")}`;
  }
  if (days.length === 1 && days[0] === 0) return `Repeats every ${cycle} days`;
  const labels = [...days].sort((a, b) => a - b).map((day) => day + 1);
  return `Days ${labels.join(", ")} · every ${cycle} days`;
}

function beatCountLabel(count: number) {
  return `${count} beat${count === 1 ? "" : "s"}`;
}

function HqFilterMenu({
  value,
  hqs,
  beatTotal,
  onChange,
  onOpenChange,
}: {
  value: HqFilter;
  hqs: Hq[];
  beatTotal: number;
  onChange: (next: HqFilter) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value === "all" || value === "none" ? null : hqs.find((hq) => hq.id === value);
  const label = value === "all" ? "All HQ" : value === "none" ? "No HQ" : (selected?.name ?? "HQ");
  const count = value === "all" ? beatTotal : (selected?.beatCount ?? 0);

  function choose(next: HqFilter) {
    onChange(next);
    setOpen(false);
    onOpenChange?.(false);
  }

  return (
    <View style={[styles.menu, open && styles.menuOpen]}>
      <Pressable
        style={styles.menuBtn}
        onPress={() => {
          const next = !open;
          setOpen(next);
          onOpenChange?.(next);
        }}
        accessibilityRole="button"
      >
        <Text style={styles.menuText} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.menuCount}>{beatCountLabel(count)}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.menuList}>
          <Pressable style={[styles.menuItem, styles.menuItemRow, value === "all" && styles.menuItemOn]} onPress={() => choose("all")}>
            <Text style={[styles.menuItemText, value === "all" && styles.menuItemTextOn]} numberOfLines={1}>
              All HQ
            </Text>
            <Text style={styles.menuCount}>{beatCountLabel(beatTotal)}</Text>
          </Pressable>
          {hqs.map((hq) => {
            const on = hq.id === value;
            return (
              <Pressable key={hq.id} style={[styles.menuItem, styles.menuItemRow, on && styles.menuItemOn]} onPress={() => choose(hq.id)}>
                <Text style={[styles.menuItemText, on && styles.menuItemTextOn]} numberOfLines={1}>
                  {hq.name}
                </Text>
                <Text style={styles.menuCount}>{beatCountLabel(hq.beatCount)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function HqSelect({
  value,
  options,
  onChange,
}: {
  value: number | "new" | null;
  options: Hq[];
  onChange: (next: number | "new" | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = value === "new" ? "Add new HQ" : (options.find((hq) => hq.id === value)?.name ?? "Select HQ");
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
          {options.map((hq) => {
            const on = hq.id === value;
            return (
              <Pressable
                key={hq.id}
                style={[styles.menuItem, on && styles.menuItemOn]}
                onPress={() => {
                  onChange(hq.id);
                  setOpen(false);
                }}
              >
                <Text style={[styles.menuItemText, on && styles.menuItemTextOn]} numberOfLines={1}>
                  {hq.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.menuItem, value === "new" && styles.menuItemOn]}
            onPress={() => {
              onChange("new");
              setOpen(false);
            }}
          >
            <Text style={[styles.menuItemText, value === "new" && styles.menuItemTextOn]}>Add new HQ</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function BeatsScreen({ embedded = false }: { embedded?: boolean }) {
  const { accessToken, user } = useAuth();
  const manager = isManager(user?.roles);
  const [beats, setBeats] = useState<PermanentBeat[]>([]);
  const [hqs, setHqs] = useState<Hq[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [hqDraft, setHqDraft] = useState("");
  const [hqChoice, setHqChoice] = useState<number | "new" | null>(null);
  const [newHq, setNewHq] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [leadQ, setLeadQ] = useState("");
  const [hqFilter, setHqFilter] = useState<HqFilter>("all");
  const [hqMenuOpen, setHqMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!accessToken || !manager) return;
    setLoading(true);
    Promise.all([
      api<PermanentBeat[]>("/beats", { token: accessToken }),
      api<Hq[]>("/hqs", { token: accessToken }),
      api<{ leads: Lead[] }>("/leads?filter=all", { token: accessToken }),
    ])
      .then(([nextBeats, nextHqs, pack]) => {
        setBeats(nextBeats);
        setHqs(nextHqs);
        setLeads(pack.leads ?? []);
      })
      .catch(() => {
        setBeats([]);
        setHqs([]);
        setLeads([]);
      })
      .finally(() => setLoading(false));
  }, [accessToken, manager]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredBeats = useMemo(() => {
    return beats.filter((beat) => {
      if (hqFilter === "all") return true;
      if (hqFilter === "none") return !beat.hqId;
      return beat.hqId === hqFilter;
    });
  }, [beats, hqFilter]);

  const shown = useMemo(() => [...filteredBeats].sort((a, b) => a.name.localeCompare(b.name)), [filteredBeats]);

  const availableLeads = useMemo(() => {
    const hay = leadQ.trim().toLowerCase();
    return leads.filter((lead) => {
      if (lead.status === "LOST" || lead.status === "WON") return false;
      if (lead.approvalStatus && lead.approvalStatus !== "APPROVED") return false;
      if (!hay) return true;
      return `${lead.name} ${lead.phone} ${lead.city ?? ""}`.toLowerCase().includes(hay);
    });
  }, [leadQ, leads]);

  function toggleLead(id: number) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function addHq() {
    if (!accessToken || hqDraft.trim().length < 1) {
      setError("Enter an HQ name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const hq = await api<Hq>("/hqs", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ name: hqDraft.trim() }),
      });
      setHqDraft("");
      setHqChoice(hq.id);
      setHqFilter(hq.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the HQ.");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!accessToken || name.trim().length < 2) {
      setError("Enter a beat name.");
      return;
    }
    if (hqChoice == null) {
      setError("Select an HQ, or add a new one.");
      return;
    }
    if (hqChoice === "new" && newHq.trim().length < 1) {
      setError("Enter the new HQ name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const beat = await api<PermanentBeat>("/beats", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: name.trim(),
          ...(hqChoice === "new" ? { hqName: newHq.trim() } : { hqId: hqChoice }),
          leadIds: picked,
        }),
      });
      setName("");
      setNewHq("");
      setPicked([]);
      setLeadQ("");
      setCreating(false);
      load();
      router.push(`/beats/${beat.id}` as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the beat.");
    } finally {
      setBusy(false);
    }
  }

  if (!manager) {
    return (
      <Screen header={<ScreenHeader title="Beats" back />}>
        <EmptyState icon="map-outline" text="Only managers build beats. Sales sees today’s beat under Beat." />
      </Screen>
    );
  }

  const filterLabel = hqFilter === "all" ? "All HQ" : hqFilter === "none" ? "No HQ" : (hqs.find((hq) => hq.id === hqFilter)?.name ?? "HQ");

  return (
    <Screen
      header={
        <ScreenHeader
          title="Beats"
          subtitle="HQ, then the beat and its leads. Assign the salesperson after."
          back={!embedded}
          right={
            <Pressable
              style={styles.add}
              onPress={() => {
                setCreating((open) => !open);
                if (typeof hqFilter === "number") setHqChoice(hqFilter);
              }}
              accessibilityLabel="New beat"
            >
              <Ionicons name={creating ? "close" : "add"} size={22} color="#fff" />
            </Pressable>
          }
        />
      }
    >
      <Card style={hqMenuOpen ? styles.hqCardOpen : undefined}>
        <Text style={styles.section}>Headquarters</Text>
        <Text style={typo.muted}>Create the HQ first. Every beat belongs to one HQ.</Text>
        <Field label="New HQ" value={hqDraft} onChangeText={setHqDraft} placeholder="e.g. New Delhi, Sector 18" />
        <Button title={busy ? "Saving…" : "Add HQ"} onPress={addHq} disabled={busy} />
        <Text style={styles.fieldLabel}>Show beats for</Text>
        <HqFilterMenu
          value={hqFilter}
          hqs={hqs}
          beatTotal={beats.length}
          onChange={setHqFilter}
          onOpenChange={setHqMenuOpen}
        />
        {!hqs.length && !loading ? <Text style={typo.muted}>No HQ yet. Add one above.</Text> : null}
      </Card>

      {creating ? (
        <Card>
          <Text style={styles.section}>New beat</Text>
          <Text style={typo.muted}>Pick the HQ and the leads. The salesperson is chosen after the beat is created.</Text>
          <Field label="Beat name" value={name} onChangeText={setName} placeholder="North Zone / Sector 12" />
          <Text style={styles.fieldLabel}>HQ</Text>
          <HqSelect value={hqChoice} options={hqs} onChange={setHqChoice} />
          {hqChoice === "new" ? (
            <Field label="New HQ name" value={newHq} onChangeText={setNewHq} placeholder="e.g. Sector 155" />
          ) : null}
          <Text style={styles.fieldLabel}>Leads on this beat</Text>
          <SearchBox value={leadQ} onChangeText={setLeadQ} placeholder="Search approved leads" />
          {availableLeads.slice(0, 40).map((lead) => {
            const on = picked.includes(lead.id);
            return (
              <Pressable key={lead.id} style={styles.leadRow} onPress={() => toggleLead(lead.id)}>
                <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? colors.blue : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.leadName}>{lead.name}</Text>
                  <Text style={typo.muted}>{[lead.phone, lead.city].filter(Boolean).join(" · ")}</Text>
                </View>
              </Pressable>
            );
          })}
          {!availableLeads.length ? <Text style={typo.muted}>No approved leads match.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={busy ? "Saving…" : `Create beat${picked.length ? ` · ${picked.length} lead${picked.length === 1 ? "" : "s"}` : ""}`}
            tone="green"
            onPress={create}
            disabled={busy}
          />
        </Card>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {loading ? <ActivityIndicator color={colors.blue} /> : null}

      {!loading && !shown.length ? (
        <EmptyState
          icon="map-outline"
          text={
            hqFilter === "all"
              ? "No beats yet. Add an HQ, then create a beat and choose its leads."
              : `No beats for ${filterLabel}.`
          }
        />
      ) : null}

      {shown.map((beat) => (
        <Pressable key={beat.id} style={styles.card} onPress={() => router.push(`/beats/${beat.id}` as Href)}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{beat.name}</Text>
            <Text style={typo.muted}>{beat.territory?.trim() || "No HQ"}</Text>
            <Text style={beat.assigneeName ? styles.assigned : styles.unassigned}>
              {beat.assigneeName ? `Assigned to ${beat.assigneeName}` : "Not assigned"}
            </Text>
            <Text style={beat.repeatDays?.length ? styles.plan : styles.unassigned}>{planLabel(beat.repeatDays, beat.repeatEvery)}</Text>
            <Text style={styles.meta}>
              {beat.size} lead{beat.size === 1 ? "" : "s"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ))}
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
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.muted, marginTop: 4 },
  error: { color: colors.red, fontWeight: "600" },
  hqCardOpen: { zIndex: 40 },
  menu: { zIndex: 4 },
  menuOpen: { zIndex: 30 },
  menuBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "500" },
  menuCount: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  menuList: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    zIndex: 30,
    elevation: 8,
    ...shadow,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" },
  menuItemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  menuItemOn: { backgroundColor: colors.blueSoft },
  menuItemText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "400" },
  menuItemTextOn: { color: colors.blue, fontWeight: "600" },
  leadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  leadName: { fontSize: 15, fontWeight: "600", color: colors.ink },
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
  assigned: { fontSize: 13, fontWeight: "600", color: colors.green },
  unassigned: { fontSize: 13, fontWeight: "600", color: colors.amber },
  plan: { fontSize: 13, fontWeight: "600", color: colors.blue },
});
