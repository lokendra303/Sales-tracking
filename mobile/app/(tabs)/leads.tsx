import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useExecutives, type ExecValue } from "@/components/exec-filter";
import {
  ActionRow,
  Badge,
  Button,
  Card,
  EmptyState,
  ListScroll,
  Screen,
  ScreenHeader,
  SearchBox,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLayout } from "@/lib/layout";
import { api, type Customer, type Lead } from "@/lib/api";
import { leadIsOpen, money, openCall, openNavigate, openWhatsApp, tempColor } from "@/lib/format";
import { leadStage, sortByStage, stageColors, type LeadStage, type StageBucket } from "@/lib/lead-stage";
import { isSales } from "@/lib/roles";
import { colors, radius, shadow } from "@/lib/theme";

type HqFilter = "all" | "none" | string;
type BeatFilter = "all" | "none" | number;

function leadBeatLine(lead: Lead) {
  const beats = lead.beats ?? [];
  if (!beats.length) return "No beat";
  return beats.map((b) => b.name).join(", ");
}

function matchesBeatFilters(lead: Lead, hqFilter: HqFilter, beatFilter: BeatFilter) {
  const beats = lead.beats ?? [];
  if (hqFilter === "none" && beatFilter === "none") return beats.length === 0;
  if (hqFilter === "none") return beats.length === 0 || beats.every((b) => !b.hq);
  if (beatFilter === "none") return beats.length === 0;
  if (hqFilter !== "all") {
    const onHq = beats.some((b) => (b.hq ?? "").toLowerCase() === hqFilter.toLowerCase());
    if (!onHq) return false;
  }
  if (beatFilter !== "all") {
    return beats.some((b) => b.id === beatFilter);
  }
  return true;
}

const tabs: { id: StageBucket; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "later", label: "Later" },
  { id: "done", label: "Done" },
  { id: "waiting", label: "Waiting" },
];

const emptyText: Record<StageBucket, string> = {
  todo: "Nothing to do right now. Planned follow-ups are under Later.",
  later: "No follow-ups planned for later days.",
  done: "Nothing finished today yet. Shops you visit or sell to show here.",
  waiting: "No leads are waiting.",
};

function FilterMenu({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.id === value)?.label ?? options[0]?.label ?? "";
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
          {options.map((option) => {
            const on = option.id === value;
            return (
              <Pressable
                key={option.id}
                style={[styles.menuItem, on && styles.menuItemOn]}
                onPress={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                <Text style={[styles.menuItemText, on && styles.menuItemTextOn]} numberOfLines={1}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function execFromParam(raw?: string): ExecValue {
  if (!raw) return "all";
  if (raw === "unassigned") return "unassigned";
  const id = Number(raw);
  return id > 0 ? id : "all";
}

type Row = { lead: Lead; stage: LeadStage };

export default function LeadsScreen() {
  const { accessToken, user } = useAuth();
  const params = useLocalSearchParams<{ assigneeId?: string; filter?: string }>();
  const { manager: office, people } = useExecutives();
  const sales = isSales(user?.roles);
  const { pagePad } = useLayout();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(params.filter === "pending" ? "pending" : "all");
  const [tab, setTab] = useState<StageBucket>(params.filter === "pending" ? "waiting" : "todo");
  const [exec, setExec] = useState<ExecValue>(execFromParam(params.assigneeId));
  const [hqFilter, setHqFilter] = useState<HqFilter>("all");
  const [beatFilter, setBeatFilter] = useState<BeatFilter>("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setExec(execFromParam(params.assigneeId));
  }, [params.assigneeId]);

  useEffect(() => {
    if (params.filter === "pending" || params.filter === "new" || params.filter === "follow-up" || params.filter === "won" || params.filter === "all") {
      setFilter(params.filter);
      if (params.filter === "pending") setTab("waiting");
    }
  }, [params.filter]);

  const serverFilter = sales ? "all" : filter;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const assignee =
      !office || exec === "all" ? "" : exec === "unassigned" ? "&assigneeId=unassigned" : `&assigneeId=${exec}`;
    try {
      const data = await api<{ leads: Lead[]; customers: Customer[] }>(
        `/leads?filter=${serverFilter}&q=${encodeURIComponent(q)}${assignee}`,
        { token: accessToken },
      );
      setLeads(data.leads);
      setCustomers(serverFilter === "new" || serverFilter === "follow-up" ? [] : data.customers);
    } catch {
      setLeads([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, serverFilter, q, exec, office]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hqOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of leads) {
      for (const beat of lead.beats ?? []) {
        const hq = beat.hq?.trim();
        if (!hq) continue;
        const key = hq.toLowerCase();
        if (!map.has(key)) map.set(key, hq);
      }
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const beatOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; hq: string | null }>();
    for (const lead of leads) {
      for (const beat of lead.beats ?? []) {
        if (hqFilter !== "all" && hqFilter !== "none") {
          if ((beat.hq ?? "").toLowerCase() !== hqFilter.toLowerCase()) continue;
        }
        if (hqFilter === "none" && beat.hq) continue;
        if (!map.has(beat.id)) map.set(beat.id, beat);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, hqFilter]);

  const rows = useMemo<Row[]>(() => {
    const now = new Date();
    return leads
      .filter((lead) => matchesBeatFilters(lead, hqFilter, beatFilter))
      .map((lead) => ({ lead, stage: leadStage(lead, now) }));
  }, [leads, hqFilter, beatFilter]);

  const counts = useMemo(() => {
    const out: Record<StageBucket, number> = { todo: 0, later: 0, done: 0, waiting: 0 };
    for (const row of rows) out[row.stage.bucket] += 1;
    return out;
  }, [rows]);

  const searching = q.trim().length > 0;
  const pendingCount = useMemo(
    () => leads.filter((lead) => lead.approvalStatus === "PENDING").length,
    [leads],
  );
  const visible = useMemo(() => {
    if (!sales) {
      // Manager: portal-style — pending approval first, then newest activity.
      const list = [...rows];
      list.sort((a, b) => {
        const ap = a.lead.approvalStatus === "PENDING" ? 0 : 1;
        const bp = b.lead.approvalStatus === "PENDING" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return (b.lead.createdAt || "").localeCompare(a.lead.createdAt || "");
      });
      return list;
    }
    const list = searching ? rows : rows.filter((row) => row.stage.bucket === tab);
    return [...list].sort((a, b) => sortByStage(a.stage, b.stage));
  }, [rows, sales, searching, tab]);

  const visitedToday = rows.filter((row) => row.stage.bucket === "done" && row.stage.rank === 0).length;
  const dayTotal = visitedToday + counts.todo;
  // Managers review leads like the desk; customers stay off this list.
  const showCustomers = sales && (searching || tab === "done");

  return (
    <Screen
      scroll={false}
      keyboard
      padded={false}
      header={
        <ScreenHeader
          title="Leads"
          subtitle={
            office
              ? "Approve, assign, and review — same workflow as the desk portal"
              : "All your shops. To visit one, open Beat and tap Start visit."
          }
          right={
            <Pressable style={styles.add} onPress={() => router.push("/lead/new")} accessibilityLabel="Add lead">
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          }
        />
      }
    >
      <View style={[styles.head, { paddingHorizontal: pagePad }]}>
        {office && pendingCount > 0 && filter !== "pending" ? (
          <Pressable
            style={styles.pendingBanner}
            onPress={() => {
              setFilter("pending");
              setTab("waiting");
            }}
          >
            <Ionicons name="hourglass-outline" size={18} color={colors.amber} />
            <Text style={styles.pendingText}>
              {pendingCount} lead{pendingCount === 1 ? "" : "s"} waiting for approval — tap to review
            </Text>
          </Pressable>
        ) : null}
        <SearchBox placeholder="Search name or phone" value={q} onChangeText={setQ} onSubmit={load} />
        <View style={[styles.menus, { zIndex: 3 }]}>
          <FilterMenu
            value={hqFilter === "none" ? "none" : hqOptions.some((hq) => hq.toLowerCase() === hqFilter.toLowerCase()) ? hqFilter : "all"}
            options={[
              { id: "all", label: "All HQ" },
              ...hqOptions.map((hq) => ({ id: hq, label: hq })),
              { id: "none", label: "No HQ" },
            ]}
            onChange={(id) => {
              setHqFilter(id);
              setBeatFilter("all");
            }}
          />
          <FilterMenu
            value={beatFilter === "all" || beatFilter === "none" ? beatFilter : String(beatFilter)}
            options={[
              { id: "all", label: "All beats" },
              ...beatOptions.map((beat) => ({ id: String(beat.id), label: beat.name })),
              { id: "none", label: "No beat" },
            ]}
            onChange={(id) => setBeatFilter(id === "all" || id === "none" ? id : Number(id))}
          />
        </View>
        {sales ? (
          <>
            {!searching ? (
              <View style={styles.progress}>
                <View style={styles.progressTop}>
                  <Text style={styles.progressTitle}>Today</Text>
                  <Text style={styles.progressText}>
                    {visitedToday} done · {counts.todo} to do
                  </Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${dayTotal ? Math.round((visitedToday / dayTotal) * 100) : 0}%` }]} />
                </View>
              </View>
            ) : null}
            {!searching ? (
              <View style={styles.tabs}>
                {tabs.map((item) => {
                  const on = tab === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setTab(item.id)}
                      style={[styles.tab, on && styles.tabOn]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <View style={[styles.count, on && styles.countOn, item.id === "todo" && counts.todo > 0 && !on && styles.countHot]}>
                        <Text style={[styles.countText, (on || (item.id === "todo" && counts.todo > 0)) && styles.countTextOn]}>
                          {counts[item.id]}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.searchNote}>Showing every lead that matches your search.</Text>
            )}
          </>
        ) : (
          <>
            <View style={styles.menus}>
              <FilterMenu
                value={filter}
                options={[
                  { id: "all", label: "All types" },
                  { id: "pending", label: "To approve" },
                  { id: "new", label: "New" },
                  { id: "follow-up", label: "Follow-up" },
                  { id: "interested", label: "Interested" },
                  { id: "won", label: "Won" },
                ]}
                onChange={setFilter}
              />
              {office ? (
                <FilterMenu
                  value={exec === "all" || exec === "unassigned" ? exec : String(exec)}
                  options={[
                    { id: "all", label: "All executives" },
                    { id: "unassigned", label: "Unassigned" },
                    ...people.map((person) => ({ id: String(person.id), label: person.name })),
                  ]}
                  onChange={(id) => setExec(id === "all" || id === "unassigned" ? id : Number(id))}
                />
              ) : null}
            </View>
          </>
        )}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.blue} />
      ) : (
        <ListScroll>
          {visible.map((row) => {
            const { lead, stage } = row;
            const temp = tempColor(lead.temperature);
            const tone = stageColors[stage.tone];
            const inProgress = lead.lastVisit?.status === "IN_PROGRESS";
            const initial = (lead.name.trim()[0] || "?").toUpperCase();
            return (
              <Card key={`lead-${lead.id}`} style={{ ...styles.leadCard, borderLeftColor: tone.fg }}>
                <Pressable onPress={() => router.push(`/lead/${lead.id}`)} style={styles.leadBody}>
                  <View style={styles.leadTop}>
                    <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.avatarText, { color: tone.fg }]}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.row}>
                        <Text style={styles.name} numberOfLines={1}>
                          {lead.name}
                        </Text>
                        <Badge
                          label={temp.label}
                          tone={lead.temperature === "HOT" ? "red" : lead.temperature === "COLD" ? "blue" : "amber"}
                        />
                      </View>
                      <View style={styles.stage}>
                        <Ionicons name={stage.icon} size={12} color={tone.fg} />
                        <Text style={[styles.stageText, { color: tone.fg }]} numberOfLines={1}>
                          {stage.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[
                      leadBeatLine(lead),
                      lead.city,
                      lead.phone,
                      lead.productInterest || lead.businessType,
                      lead.potential ? money(lead.potential) : null,
                      office && lead.assigneeName ? `→ ${lead.assigneeName}` : null,
                      office && lead.createdByName ? `by ${lead.createdByName}` : null,
                      lead.latitude != null ? "Pinned" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Pressable>
                {sales && inProgress && lead.lastVisit?.id ? (
                  <Button
                    title="Finish visit"
                    tone="green"
                    size="sm"
                    icon="time-outline"
                    onPress={() => router.push(`/visit/${lead.lastVisit!.id}`)}
                  />
                ) : null}
                <ActionRow>
                  <Button
                    title="Call"
                    tone="outline"
                    size="sm"
                    icon="call-outline"
                    flex
                    onPress={() => {
                      openCall(lead.phone);
                      if (leadIsOpen(lead)) {
                        api(`/leads/${lead.id}/contacted`, { method: "POST", token: accessToken }).catch(() => undefined);
                      }
                    }}
                  />
                  <Button title="WhatsApp" tone="outline" size="sm" icon="logo-whatsapp" flex onPress={() => openWhatsApp(lead.phone)} />
                  {lead.latitude != null || lead.address || lead.mapsLink ? (
                    <Button
                      title="Map"
                      tone="outline"
                      size="sm"
                      icon="map-outline"
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
                  {office && lead.approvalStatus === "PENDING" ? (
                    <>
                      <Button
                        title="Approve"
                        tone="green"
                        size="sm"
                        flex
                        onPress={() => {
                          api(`/leads/${lead.id}/approval`, {
                            method: "POST",
                            token: accessToken,
                            body: JSON.stringify({ decision: "APPROVED" }),
                          })
                            .then(load)
                            .catch((err) =>
                              Alert.alert("Could not approve", err instanceof Error ? err.message : "Try again."),
                            );
                        }}
                      />
                      <Button
                        title="Reject"
                        tone="red"
                        size="sm"
                        flex
                        onPress={() =>
                          Alert.alert("Reject this lead?", `${lead.name} will stay off the salesperson's visits.`, [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Reject",
                              style: "destructive",
                              onPress: () => {
                                api(`/leads/${lead.id}/approval`, {
                                  method: "POST",
                                  token: accessToken,
                                  body: JSON.stringify({ decision: "REJECTED" }),
                                })
                                  .then(load)
                                  .catch((err) =>
                                    Alert.alert("Could not reject", err instanceof Error ? err.message : "Try again."),
                                  );
                              },
                            },
                          ])
                        }
                      />
                    </>
                  ) : null}
                  {office && lead.approvalStatus !== "PENDING" ? (
                    <Button title="Open / assign" tone="outline" size="sm" flex onPress={() => router.push(`/lead/${lead.id}`)} />
                  ) : null}
                </ActionRow>
              </Card>
            );
          })}
          {showCustomers && customers.length ? (
            <>
              {sales ? <Text style={styles.section}>Customers</Text> : null}
              {customers.map((customer) => (
                <Card key={`cust-${customer.id}`}>
                  <View style={styles.row}>
                    <Text style={styles.name} numberOfLines={2}>
                      {customer.name}
                    </Text>
                    <Badge label="Customer" tone="green" />
                  </View>
                  <Text style={styles.meta}>{customer.phone}</Text>
                  <ActionRow>
                    <Button title="Call" tone="outline" icon="call-outline" flex onPress={() => openCall(customer.phone)} />
                    <Button title="WhatsApp" tone="outline" icon="logo-whatsapp" flex onPress={() => openWhatsApp(customer.phone)} />
                  </ActionRow>
                </Card>
              ))}
            </>
          ) : null}
          {!visible.length && !(showCustomers && customers.length) ? (
            <EmptyState
              icon={sales && tab === "done" ? "checkmark-done-outline" : "briefcase-outline"}
              text={
                sales
                  ? searching
                    ? "No lead matches this search."
                    : leads.length
                      ? emptyText[tab]
                      : "No leads assigned to you yet. Add a lead and it appears here right away."
                  : filter === "pending"
                    ? "No leads are waiting for approval."
                    : filter === "new"
                      ? "No new leads in this filter."
                      : "No leads in this view. Tap + to add a lead and assign an executive."
              }
            />
          ) : null}
        </ListScroll>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: 8, paddingBottom: 12, gap: 12, zIndex: 4 },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingText: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 13 },
  menus: { flexDirection: "row", gap: 8, zIndex: 2 },
  menu: { flex: 1 },
  menuOpen: { zIndex: 3 },
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
  menuList: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    overflow: "hidden",
    ...shadow,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 9 },
  menuItemOn: { backgroundColor: "#EEF4FF" },
  menuItemText: { color: colors.text, fontSize: 14, fontWeight: "400" },
  menuItemTextOn: { fontWeight: "600", color: colors.blue },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1, flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 13, fontWeight: "400", lineHeight: 18, flexShrink: 1 },
  leadCard: { borderLeftWidth: 3, overflow: "hidden", padding: 12, gap: 8 },
  leadBody: { gap: 4 },
  leadTop: { flexDirection: "row", gap: 10, alignItems: "center" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "600", fontSize: 14 },
  stage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  stageText: { fontWeight: "400", fontSize: 12, flexShrink: 1 },
  progress: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8,
    ...shadow,
  },
  progressTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle: { color: colors.text, fontWeight: "500", fontSize: 14 },
  progressText: { color: colors.muted, fontWeight: "400", fontSize: 13 },
  barBg: { height: 8, borderRadius: 8, backgroundColor: "#E5E7EB", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 8, backgroundColor: colors.green },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#E8EEF6",
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 40,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
  },
  tabOn: { backgroundColor: colors.card, elevation: 2, shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tabText: { color: colors.muted, fontWeight: "700", fontSize: 13, flexShrink: 1 },
  tabTextOn: { color: colors.text, fontWeight: "800" },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  countOn: { backgroundColor: colors.blue },
  countHot: { backgroundColor: colors.red },
  countText: { color: colors.text, fontWeight: "800", fontSize: 11 },
  countTextOn: { color: "#fff" },
  searchNote: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  section: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 6 },
});
