import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button, Chip, Field, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, isOfflineError } from "@/lib/api";
import { requestId, useOffline } from "@/lib/offline";
import { useReminders } from "@/lib/reminders-context";
import { typo } from "@/lib/theme";

const types = [
  { id: "CALL", label: "Call" },
  { id: "WHATSAPP", label: "WhatsApp" },
  { id: "VISIT", label: "Visit" },
] as const;

export default function NewFollowUpScreen() {
  const { leadId, customerId } = useLocalSearchParams<{ leadId?: string; customerId?: string }>();
  const { accessToken } = useAuth();
  const offline = useOffline();
  const reminders = useReminders();
  const [kind, setKind] = useState<(typeof types)[number]["id"]>("CALL");
  const [whenText, setWhenText] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(11, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!accessToken) return;
    setLoading(true);
    const payload = {
      leadId: leadId ? Number(leadId) : undefined,
      customerId: customerId ? Number(customerId) : undefined,
      type: kind,
      dueAt: new Date(whenText).toISOString(),
      notes: notes || undefined,
      clientRequestId: requestId("follow"),
    };
    try {
      await api("/follow-ups", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      });
      await reminders.refresh();
      goBack("/leads");
    } catch (err) {
      if (isOfflineError(err)) {
        await offline.enqueue({
          kind: "follow-up",
          label: "Follow-up",
          path: "/follow-ups",
          body: payload,
        });
        Alert.alert(
          "Saved on this phone",
          "We will send this follow-up when you are back on Wi-Fi. The reminder is still set on this phone after sync.",
        );
        await reminders.refresh();
        goBack("/leads");
        return;
      }
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard header={<ScreenHeader title="Add follow-up" back align="center" fallback="/leads" />}>
      <Text style={styles.label}>What next?</Text>
      <View style={styles.row}>
        {types.map((item) => (
          <Chip key={item.id} label={item.label} on={kind === item.id} onPress={() => setKind(item.id)} />
        ))}
      </View>
      <Field label="Date and time" value={whenText} onChangeText={setWhenText} placeholder="2026-09-25T11:00" />
      <Text style={typo.muted}>Use 2026-09-25T11:00 format if the date picker is not available.</Text>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="What to say or do" />
      <Button title="Create follow-up" tone="green" onPress={save} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "800", color: "#0F172A" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
