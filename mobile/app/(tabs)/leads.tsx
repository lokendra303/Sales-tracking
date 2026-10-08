import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExecFilter, useExecutives, type ExecValue } from "@/components/exec-filter";
import {
  ActionRow,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ListScroll,
  Screen,
  ScreenHeader,
  SearchBox,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Customer, type Lead } from "@/lib/api";
import { leadIsOpen, leadStateLabel, money, openCall, openNavigate, openWhatsApp, tempColor, when } from "@/lib/format";
import { isSales } from "@/lib/roles";
import { colors } from "@/lib/theme";

const filters = [
  { id: "all", label: "All" },
  { id: "pending", label: "Approval" },
  { id: "new", label: "New" },
  { id: "follow-up", label: "Follow-up" },
  { id: "won", label: "Won" },
];

function execFromParam(raw?: string): ExecValue {
  if (!raw) return "all";
  if (raw === "unassigned") return "unassigned";
  const id = Number(raw);
  return id > 0 ? id : "all";
}

export default function LeadsScreen() {
  const { accessToken, user } = useAuth();
  const params = useLocalSearchParams<{ assigneeId?: string; filter?: string }>();
  const { manager: office, people } = useExecutives();
  const sales = isSales(user?.roles);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(params.filter === "pending" ? "pending" : "all");
  const [exec, setExec] = useState<ExecValue>(execFromParam(params.assigneeId));
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setExec(execFromParam(params.assigneeId));
  }, [params.assigneeId]);

  useEffect(() => {
    if (params.filter === "pending" || params.filter === "new" || params.filter === "follow-up" || params.filter === "won" || params.filter === "all") {
      setFilter(params.filter);
    }
  }, [params.filter]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const assignee =
      !office || exec === "all" ? "" : exec === "unassigned" ? "&assigneeId=unassigned" : `&assigneeId=${exec}`;
    try {
      const data = await api<{ leads: Lead[]; customers: Customer[] }>(
        `/leads?filter=${filter}&q=${encodeURIComponent(q)}${assignee}`,
        { token: accessToken },
      );
      setLeads(data.leads);
      setCustomers(filter === "new" || filter === "follow-up" ? [] : data.customers);
    } catch {
      setLeads([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter, q, exec, office]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen
      scroll={false}
      keyboard
      padded={false}
      header={
        <ScreenHeader
          title="Leads"
          subtitle={office ? "Assign and review by executive" : "Only leads assigned to you"}
          right={
            <Pressable style={styles.add} onPress={() => router.push("/lead/new")} accessibilityLabel="Add lead">
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          }
        />
      }
    >
      <View style={styles.head}>
        <SearchBox placeholder="Search name or phone" value={q} onChangeText={setQ} onSubmit={load} />
        <View style={styles.filters}>
          {filters.map((item) => (
            <Chip
              key={item.id}
              label={item.id === "pending" ? (office ? "To approve" : "Waiting") : item.label}
              on={filter === item.id}
              onPress={() => setFilter(item.id)}
            />
          ))}
        </View>
        {office ? <ExecFilter people={people} value={exec} onChange={setExec} includeUnassigned /> : null}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.blue} />
      ) : (
        <ListScroll>
          {leads.map((lead) => {
            const temp = tempColor(lead.temperature);
            return (
              <Card key={`lead-${lead.id}`}>
                <Pressable onPress={() => router.push(`/lead/${lead.id}`)}>
                  <View style={styles.row}>
                    <Text style={styles.name}>{lead.name}</Text>
                    <Badge label={temp.label} tone={lead.temperature === "HOT" ? "red" : lead.temperature === "COLD" ? "blue" : "amber"} />
                  </View>
                  <Text style={styles.meta}>
                    {money(lead.potential)} · {leadStateLabel(lead)}
                    {office && lead.createdByName ? ` · ${lead.createdByName}` : ""}
                    {office && lead.assigneeName ? ` · ${lead.assigneeName}` : ""}
                    {lead.city ? ` · ${lead.city}` : ""}
                    {lead.latitude != null ? " · Map pin" : ""}
                  </Text>
                  {lead.nextFollowUp ? <Text style={styles.follow}>Follow-up {when(lead.nextFollowUp.dueAt)}</Text> : null}
                </Pressable>
                <ActionRow>
                  <Button
                    title="Call"
                    flex
                    onPress={() => {
                      openCall(lead.phone);
                      if (leadIsOpen(lead)) {
                        api(`/leads/${lead.id}/contacted`, { method: "POST", token: accessToken }).catch(() => undefined);
                      }
                    }}
                  />
                  <Button title="WhatsApp" tone="green" flex onPress={() => openWhatsApp(lead.phone)} />
                  {lead.latitude != null || lead.address ? (
                    <Button
                      title="Map"
                      tone="outline"
                      flex
                      onPress={() => openNavigate(lead.latitude, lead.longitude, [lead.address, lead.city].filter(Boolean).join(", "))}
                    />
                  ) : null}
                  {sales && leadIsOpen(lead) ? (
                    <Button
                      title="Visit"
                      tone="outline"
                      flex
                      onPress={() => router.push({ pathname: "/visit/check-in", params: { leadId: String(lead.id) } })}
                    />
                  ) : null}
                  {office && lead.approvalStatus === "PENDING" ? (
                    <>
                      <Button
                        title="Approve"
                        tone="green"
                        flex
                        onPress={() => {
                          api(`/leads/${lead.id}/approval`, {
                            method: "POST",
                            token: accessToken,
                            body: JSON.stringify({ decision: "APPROVED" }),
                          })
                            .then(load)
                            .catch(() => undefined);
                        }}
                      />
                      <Button
                        title="Reject"
                        tone="red"
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
                                  .catch(() => undefined);
                              },
                            },
                          ])
                        }
                      />
                    </>
                  ) : null}
                </ActionRow>
              </Card>
            );
          })}
          {customers.map((customer) => (
            <Card key={`cust-${customer.id}`}>
              <View style={styles.row}>
                <Text style={styles.name}>{customer.name}</Text>
                <Badge label="Customer" tone="green" />
              </View>
              <Text style={styles.meta}>{customer.phone}</Text>
              <ActionRow>
                <Button title="Call" flex onPress={() => openCall(customer.phone)} />
                <Button title="WhatsApp" tone="green" flex onPress={() => openWhatsApp(customer.phone)} />
              </ActionRow>
            </Card>
          ))}
          {!leads.length && !customers.length ? (
            <EmptyState
              icon="briefcase-outline"
              text={
                filter === "pending"
                  ? office
                    ? "No leads are waiting for approval."
                    : "No leads are waiting for your manager."
                  : sales
                    ? "No leads assigned to you yet. A lead you add waits here until your manager approves it."
                    : "No leads in this view. Assign a shop to an executive, or tap +."
              }
            />
          ) : null}
        </ListScroll>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 17, fontWeight: "800", color: colors.text, flex: 1 },
  meta: { color: colors.muted, marginTop: 4 },
  follow: { color: colors.text, fontWeight: "700", marginTop: 4 },
});
