import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ExecPicker, useExecutives } from "@/components/exec-filter";
import { ActionRow, Badge, Button, Card, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Lead } from "@/lib/api";
import { useReminders } from "@/lib/reminders-context";
import { money, openCall, openNavigate, openWhatsApp, statusLabel, tempColor, when } from "@/lib/format";
import { isManager, isSales } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const reminders = useReminders();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const office = isManager(user?.roles);
  const sales = isSales(user?.roles);
  const { people } = useExecutives();
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      setLead(await api<Lead>(`/leads/${id}`, { token: accessToken }));
    } catch {
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function convert() {
    if (!accessToken || !id) return;
    try {
      await api(`/leads/${id}/convert`, { method: "POST", token: accessToken });
      Alert.alert("Converted", "This lead is now a customer.");
      load();
    } catch (err) {
      Alert.alert("Could not convert", err instanceof Error ? err.message : "Try again.");
    }
  }

  async function assignTo(userId: number) {
    if (!accessToken || !id) return;
    setAssigning(true);
    try {
      await api(`/leads/${id}/assign`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ userId }),
      });
      await load();
    } catch (err) {
      Alert.alert("Could not assign", err instanceof Error ? err.message : "Try again.");
    } finally {
      setAssigning(false);
    }
  }

  async function markLost() {
    if (!accessToken || !id) return;
    await api(`/leads/${id}`, {
      method: "PUT",
      token: accessToken,
      body: JSON.stringify({ status: "LOST" }),
    });
    load();
  }

  if (loading || !lead) {
    return (
      <Screen header={<ScreenHeader title="Lead" back align="center" fallback="/leads" />}>
        <ActivityIndicator color={colors.blue} />
      </Screen>
    );
  }

  const temp = tempColor(lead.temperature);

  return (
    <Screen header={<ScreenHeader title="Lead" back align="center" fallback="/leads" />}>
      <Card>
        <View style={styles.row}>
          <Text style={styles.name}>{lead.name}</Text>
          <Badge label={temp.label} tone={lead.temperature === "HOT" ? "red" : lead.temperature === "COLD" ? "blue" : "amber"} />
        </View>
        {lead.customerId ? <Badge label="Customer" tone="green" /> : null}
        <Text style={typo.muted}>{lead.contactPerson || "No contact person"}</Text>
        <Text style={typo.body}>{lead.phone}</Text>
        <Text style={typo.muted}>{[lead.address, lead.city].filter(Boolean).join(", ") || "No address"}</Text>
        {lead.latitude != null && lead.longitude != null ? (
          <Text style={typo.muted}>
            Map pin {lead.latitude.toFixed(5)}, {lead.longitude.toFixed(5)}
          </Text>
        ) : null}
        <Text style={typo.muted}>
          {money(lead.potential)} · {statusLabel(lead.status)}
          {lead.assigneeName ? ` · ${lead.assigneeName}` : ""}
        </Text>
        {lead.notes ? <Text style={typo.body}>{lead.notes}</Text> : null}
      </Card>

      <ActionRow>
        <Button
          title="Call"
          flex
          onPress={() => {
            openCall(lead.phone);
            api(`/leads/${lead.id}/contacted`, { method: "POST", token: accessToken }).catch(() => undefined);
          }}
        />
        <Button title="WhatsApp" tone="green" flex onPress={() => openWhatsApp(lead.phone)} />
      </ActionRow>
      {lead.latitude != null && lead.longitude != null ? (
        <Pressable
          onPress={() => openNavigate(lead.latitude, lead.longitude, [lead.address, lead.city].filter(Boolean).join(", "))}
        >
          <Image
            source={{
              uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${lead.latitude},${lead.longitude}&zoom=16&size=560x240&markers=${lead.latitude},${lead.longitude},red-pushpin`,
            }}
            style={styles.map}
            accessibilityLabel="Shop location map"
          />
        </Pressable>
      ) : null}
      {lead.latitude != null || lead.address || lead.city ? (
        <Button
          title="Follow map to shop"
          tone="green"
          onPress={() => openNavigate(lead.latitude, lead.longitude, [lead.address, lead.city].filter(Boolean).join(", "))}
        />
      ) : null}
      {sales ? (
        <Button
          title="Start visit"
          tone="green"
          onPress={() => router.push({ pathname: "/visit/check-in", params: { leadId: String(lead.id) } })}
        />
      ) : null}

      {office ? (
        <Card>
          <Text style={styles.section}>Assigned executive</Text>
          <Text style={typo.muted}>
            {lead.assigneeName
              ? `${lead.assigneeName} sees this lead on the phone. Pick another person to move it.`
              : "Nobody yet. Pick an executive — only that person will see this lead."}
          </Text>
          {assigning ? (
            <ActivityIndicator color={colors.blue} />
          ) : people.length ? (
            <ExecPicker people={people} value={lead.assigneeId} onChange={assignTo} />
          ) : (
            <Text style={typo.muted}>Add a sales executive on Team first.</Text>
          )}
        </Card>
      ) : null}

      <Button
        title="Add follow-up"
        tone="outline"
        onPress={() => router.push({ pathname: "/follow-up/new", params: { leadId: String(lead.id) } })}
      />

      {!lead.customerId && lead.status !== "LOST" ? (
        <Button title="Convert to customer" tone="outline" onPress={convert} />
      ) : null}

      {lead.status !== "LOST" && !lead.customerId ? (
        <Button title="Mark lost" tone="ghost" onPress={markLost} />
      ) : null}

      <Text style={styles.section}>Follow-ups</Text>
      {(lead.followUps ?? []).length === 0 ? (
        <EmptyState icon="calendar-outline" text="None yet. Add one so this lead does not disappear." />
      ) : (
        (lead.followUps ?? []).map((item) => (
          <Card key={item.id}>
            <Text style={styles.followTitle}>
              {item.type} · {when(item.dueAt)}
            </Text>
            <Text style={typo.muted}>{item.doneAt ? "Done" : item.overdue ? "Overdue" : "Upcoming"}</Text>
            {item.notes ? <Text style={typo.muted}>{item.notes}</Text> : null}
            {!item.doneAt ? (
              <Pressable
                onPress={async () => {
                  await api(`/follow-ups/${item.id}/done`, { method: "POST", token: accessToken });
                  await reminders.refresh();
                  load();
                }}
              >
                <Text style={styles.link}>Mark done</Text>
              </Pressable>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 22, fontWeight: "800", color: colors.text, flex: 1 },
  section: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 8 },
  followTitle: { fontWeight: "800", color: colors.text },
  link: { color: colors.blue, fontWeight: "800" },
  map: { width: "100%", height: 180, borderRadius: 16, backgroundColor: "#E2E8F0" },
});
