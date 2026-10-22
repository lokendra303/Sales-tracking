import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExecPicker, useExecutives } from "@/components/exec-filter";
import { leadStage, stageColors } from "@/lib/lead-stage";
import { ActionRow, Badge, Button, Card, Chip, EmptyState, Field, Screen, ScreenHeader } from "@/components/ui";
import { mobileDigits } from "@/lib/phone";
import { useAuth } from "@/lib/auth";
import { api, type Lead } from "@/lib/api";
import { bestFix, loadLocation } from "@/lib/device-location";
import { useReminders } from "@/lib/reminders-context";
import { leadIsOpen, leadStateLabel, money, openCall, openMapPin, openNavigate, openWhatsApp, tempColor, when } from "@/lib/format";
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
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [matches, setMatches] = useState<{ lat: number; lng: number; label: string }[]>([]);
  const [locating, setLocating] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    contactPerson: "",
    businessType: "",
    potential: "",
    temperature: "WARM",
    notes: "",
  });

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      const next = await api<Lead>(`/leads/${id}`, { token: accessToken });
      setLead(next);
      setForm({
        name: next.name,
        phone: next.phone,
        contactPerson: next.contactPerson ?? "",
        businessType: next.businessType ?? "",
        potential: next.potential != null ? String(next.potential) : "",
        temperature: next.temperature ?? "WARM",
        notes: next.notes ?? "",
      });
      setAddress(next.address ?? "");
      setCity(next.city ?? "");
      setPin(next.latitude != null && next.longitude != null ? { lat: next.latitude, lng: next.longitude } : null);
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

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!accessToken || !id) return;
    try {
      await api(`/leads/${id}/approval`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ decision }),
      });
      Alert.alert(decision === "APPROVED" ? "Approved" : "Rejected", decision === "APPROVED" ? "The executive can visit this lead now." : "The salesperson will see that this lead was rejected.");
      load();
    } catch (err) {
      Alert.alert("Could not update", err instanceof Error ? err.message : "Try again.");
    }
  }

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

  async function assignTo(userId: number | null) {
    if (!accessToken || !id) return;
    if (userId === lead?.assigneeId) return;
    setAssigning(true);
    try {
      const data = await api<{ beatNotice?: string }>(`/leads/${id}/assign`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ userId }),
      });
      await load();
      if (data.beatNotice) Alert.alert("Beat updated", data.beatNotice);
    } catch (err) {
      Alert.alert("Could not assign", err instanceof Error ? err.message : "Try again.");
    } finally {
      setAssigning(false);
    }
  }

  async function saveDetails() {
    if (!accessToken || !id) return;
    if (form.name.trim().length < 2) {
      Alert.alert("Name needed", "Enter the business name.");
      return;
    }
    if (form.phone.length !== 10) {
      Alert.alert("Phone needed", "Enter a 10-digit mobile number.");
      return;
    }
    setSavingDetails(true);
    try {
      await api(`/leads/${id}`, {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone,
          contactPerson: form.contactPerson.trim(),
          businessType: form.businessType.trim(),
          potential: form.potential ? Number(form.potential) : null,
          temperature: form.temperature,
          notes: form.notes.trim(),
        }),
      });
      setEditingDetails(false);
      await load();
      Alert.alert("Saved", "Lead details updated.");
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function findAddress() {
    if (!accessToken) return;
    const query = [address, city].filter(Boolean).join(", ");
    if (query.length < 3) {
      Alert.alert("Address needed", "Type the shop address or city first.");
      return;
    }
    setLocating(true);
    try {
      const hits = await api<{ lat: number; lng: number; label: string }[]>(`/geo?q=${encodeURIComponent(query)}`, {
        token: accessToken,
      });
      setMatches(hits);
      if (!hits.length) Alert.alert("No match", "Stand at the shop and tap Use my GPS here.");
      else setPin({ lat: hits[0].lat, lng: hits[0].lng });
    } catch (err) {
      Alert.alert("Could not search", err instanceof Error ? err.message : "Try again.");
    } finally {
      setLocating(false);
    }
  }

  async function pinHere() {
    setLocating(true);
    try {
      const Location = await loadLocation();
      const permission = Location ? await Location.requestForegroundPermissionsAsync() : { granted: false };
      if (!Location || !permission.granted) {
        Alert.alert("Location needed", "Allow location to pin the shop from where you stand.");
        return;
      }
      const fix = await bestFix(Location);
      setPin({ lat: fix.lat, lng: fix.lng });
      setMatches([]);
      if ((fix.accuracy ?? 0) > 50) {
        Alert.alert("Weak GPS", `This pin may be off by about ${Math.round(fix.accuracy!)} m. Step outside and try again.`);
      }
    } catch (err) {
      Alert.alert("Could not read GPS", err instanceof Error ? err.message : "Try again.");
    } finally {
      setLocating(false);
    }
  }

  async function saveLocation() {
    if (!accessToken || !id || !pin) return;
    setLocating(true);
    try {
      await api(`/leads/${id}`, {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({ address: address.trim(), city: city.trim(), latitude: pin.lat, longitude: pin.lng }),
      });
      setEditing(false);
      setMatches([]);
      await load();
      Alert.alert("Location saved", "The executive finishes the visit within 300 m of this pin.");
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setLocating(false);
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
  const stage = leadStage(lead);
  const stageTone = stageColors[stage.tone];

  return (
    <Screen header={<ScreenHeader title="Lead" back align="center" fallback="/leads" />}>
      <Card>
        <View style={[styles.stage, { backgroundColor: stageTone.bg }]}>
          <Ionicons name={stage.icon} size={18} color={stageTone.fg} />
          <Text style={[styles.stageText, { color: stageTone.fg }]}>{stage.label}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={2}>
            {lead.name}
          </Text>
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
          {money(lead.potential)} · {leadStateLabel(lead)}
          {lead.assigneeName ? ` · ${lead.assigneeName}` : ""}
          {lead.createdByName ? ` · Added by ${lead.createdByName}` : ""}
        </Text>
        {lead.approvalStatus === "PENDING" ? (
          <Text style={typo.body}>
            {office ? "Approve this lead before the executive can visit it." : "Your manager still needs to approve this lead."}
          </Text>
        ) : null}
        {lead.approvalStatus === "REJECTED" ? (
          <Text style={typo.body}>{lead.rejectionNote || "Your manager rejected this lead."}</Text>
        ) : null}
        {lead.notes ? <Text style={typo.body}>{lead.notes}</Text> : null}
      </Card>

      {office && lead.approvalStatus === "PENDING" ? (
        <ActionRow>
          <Button title="Approve" tone="green" flex onPress={() => decide("APPROVED")} />
          <Button
            title="Reject"
            tone="red"
            flex
            onPress={() =>
              Alert.alert("Reject this lead?", "The salesperson will see that you rejected it.", [
                { text: "Cancel", style: "cancel" },
                { text: "Reject", style: "destructive", onPress: () => decide("REJECTED") },
              ])
            }
          />
        </ActionRow>
      ) : null}

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
      {sales && leadIsOpen(lead) ? (
        <Button
          title="Start visit"
          tone="green"
          onPress={() => router.push({ pathname: "/visit/check-in", params: { leadId: String(lead.id) } })}
        />
      ) : null}

      {office && lead.approvalStatus === "APPROVED" && lead.status !== "LOST" ? (
        <Button
          title="Add to a beat (multi-lead target)"
          tone="outline"
          onPress={() => router.push("/beats" as Href)}
        />
      ) : null}

      {office ? (
        <Card>
          <Text style={styles.section}>Lead details</Text>
          {editingDetails ? (
            <>
              <Field label="Business name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
              <Field
                label="Phone"
                value={form.phone}
                onChangeText={(phone) => setForm({ ...form, phone: mobileDigits(phone) })}
                keyboardType="number-pad"
                maxLength={10}
              />
              <Field
                label="Contact person"
                value={form.contactPerson}
                onChangeText={(contactPerson) => setForm({ ...form, contactPerson })}
              />
              <Field
                label="Business type"
                value={form.businessType}
                onChangeText={(businessType) => setForm({ ...form, businessType })}
              />
              <Field
                label="Potential (₹)"
                value={form.potential}
                onChangeText={(potential) => setForm({ ...form, potential: potential.replace(/[^\d.]/g, "") })}
                keyboardType="decimal-pad"
              />
              <View style={styles.chips}>
                {(["HOT", "WARM", "COLD"] as const).map((temp) => (
                  <Chip key={temp} label={tempColor(temp).label} on={form.temperature === temp} onPress={() => setForm({ ...form, temperature: temp })} />
                ))}
              </View>
              <Field label="Notes" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} multiline />
              <ActionRow>
                <Button title="Save details" tone="green" flex onPress={saveDetails} disabled={savingDetails} />
                <Button title="Cancel" tone="ghost" flex onPress={() => { setEditingDetails(false); load(); }} />
              </ActionRow>
            </>
          ) : (
            <Button title="Edit lead" tone="outline" onPress={() => setEditingDetails(true)} />
          )}
        </Card>
      ) : null}

      {office ? (
        <Card>
          <Text style={styles.section}>Shop location</Text>
          <Text style={typo.muted}>
            {lead.latitude != null ? "Executives finish the visit within 300 m of this pin." : "No pin yet. Executives cannot finish a visit until you set it."}
          </Text>
          {editing ? (
            <>
              <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, area, landmark" />
              <Field label="City" value={city} onChangeText={setCity} placeholder="City" />
              <ActionRow>
                <Button title="Find address" tone="outline" flex onPress={findAddress} disabled={locating} />
                <Button title="Use my GPS here" tone="outline" flex onPress={pinHere} disabled={locating} />
              </ActionRow>
              {matches.length > 1
                ? matches.map((hit) => (
                    <Pressable key={`${hit.lat},${hit.lng}`} onPress={() => setPin({ lat: hit.lat, lng: hit.lng })}>
                      <Text style={pin?.lat === hit.lat && pin?.lng === hit.lng ? styles.picked : styles.option}>{hit.label}</Text>
                    </Pressable>
                  ))
                : null}
              {locating ? <ActivityIndicator color={colors.blue} /> : null}
              <Text style={typo.muted}>{pin ? `Pin ${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}` : "No pin chosen yet."}</Text>
              {pin ? (
                <Button title="Check pin on map" tone="ghost" onPress={() => openMapPin(pin.lat, pin.lng)} />
              ) : null}
              <ActionRow>
                <Button title="Save location" tone="green" flex onPress={saveLocation} disabled={locating || !pin} />
                <Button title="Cancel" tone="ghost" flex onPress={() => { setEditing(false); load(); }} />
              </ActionRow>
            </>
          ) : (
            <Button title={lead.latitude != null ? "Correct location" : "Set location"} tone="outline" onPress={() => setEditing(true)} />
          )}
        </Card>
      ) : null}

      {office ? (
        <Card>
          <Text style={styles.section}>Assigned executive</Text>
          <Text style={typo.muted}>
            {lead.assigneeName
              ? `${lead.assigneeName} sees this lead on the phone. Moving or unassigning also removes it from beats that no longer match.`
              : "Nobody yet. Pick an executive — only that person will see this lead."}
          </Text>
          {assigning ? (
            <ActivityIndicator color={colors.blue} />
          ) : people.length ? (
            <ExecPicker people={people} value={lead.assigneeId} onChange={assignTo} allowUnassign={Boolean(lead.assigneeId)} />
          ) : (
            <Text style={typo.muted}>Add a sales executive on Team first.</Text>
          )}
        </Card>
      ) : null}

      {leadIsOpen(lead) ? (
        <Button
          title="Add follow-up"
          tone="outline"
          onPress={() => router.push({ pathname: "/follow-up/new", params: { leadId: String(lead.id) } })}
        />
      ) : null}

      {leadIsOpen(lead) && !lead.customerId && lead.status !== "LOST" ? (
        <Button title="Convert to customer" tone="outline" onPress={convert} />
      ) : null}

      {leadIsOpen(lead) && lead.status !== "LOST" && !lead.customerId ? (
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
  stage: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  stageText: { fontWeight: "800", fontSize: 14, flexShrink: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 22, fontWeight: "800", color: colors.text, flex: 1, flexShrink: 1 },
  section: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 8 },
  followTitle: { fontWeight: "800", color: colors.text },
  link: { color: colors.blue, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { ...typo.muted, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  picked: { color: colors.green, fontWeight: "800", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  map: { width: "100%", height: 180, borderRadius: 16, backgroundColor: "#E2E8F0" },
});
