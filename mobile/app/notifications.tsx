import { useCallback } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ActionRow, Button, Card, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { useReminders } from "@/lib/reminders-context";
import { openCall, openWhatsApp, when } from "@/lib/format";
import { colors, typo } from "@/lib/theme";

export default function NotificationsScreen() {
  const reminders = useReminders();

  useFocusEffect(
    useCallback(() => {
      reminders.refresh();
    }, [reminders.refresh]),
  );

  return (
    <Screen header={<ScreenHeader title="Reminders" back align="center" fallback="/(tabs)" />}>
      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Phone reminders</Text>
            <Text style={typo.muted}>Local only. No Firebase. The phone rings for your follow-ups.</Text>
          </View>
          <Switch value={reminders.enabled} onValueChange={reminders.setEnabled} />
        </View>
        <Text style={typo.muted}>
          {reminders.enabled ? `${reminders.scheduled} set on this phone` : "Reminders are off"}
        </Text>
      </Card>

      {reminders.items.map((item) => (
        <Card key={item.id}>
          <Pressable onPress={() => item.leadId && router.push(`/lead/${item.leadId}`)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={item.overdue ? styles.warn : typo.muted}>
              {item.type} · {when(item.dueAt)}
              {item.overdue ? " · Overdue" : ""}
            </Text>
            {item.notes ? <Text style={typo.muted}>{item.notes}</Text> : null}
          </Pressable>
          {item.phone ? (
            <ActionRow>
              <Button title="Call" flex onPress={() => openCall(item.phone!)} />
              <Button title="WhatsApp" tone="outline" flex onPress={() => openWhatsApp(item.phone!)} />
            </ActionRow>
          ) : null}
        </Card>
      ))}
      {!reminders.items.length ? <EmptyState icon="notifications-outline" text="No open follow-ups. Add one on a lead." /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  name: { fontWeight: "800", color: colors.text, fontSize: 16 },
  warn: { color: "#92400E", fontWeight: "800" },
});
