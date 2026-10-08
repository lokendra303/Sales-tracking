import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from "react-native";
import { Card, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { colors, typo } from "@/lib/theme";

type Settings = {
  liveLocationEnabled: boolean;
  visitCheckinRadiusMeters: number;
  trackingIntervalSeconds: number;
  currency: string;
  timezone: string;
};

export default function SettingsScreen() {
  const { accessToken, user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    api<Settings>("/settings", { token: accessToken }).then(setSettings).catch(() => undefined);
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function toggleLive(enabled: boolean) {
    if (!accessToken || !settings) return;
    setSaving(true);
    try {
      await api("/settings/live-location", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ enabled }),
      });
      setSettings({ ...settings, liveLocationEnabled: enabled });
    } catch (err) {
      Alert.alert("Could not update", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen header={<ScreenHeader title="Settings" subtitle={user?.tenant.name} />}>
      {!settings ? (
        <ActivityIndicator color={colors.blue} />
      ) : (
        <>
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.label}>Live location</Text>
                <Text style={typo.muted}>
                  Off by default. When on, managers can see GPS from their sales team after Start Field Work. You do
                  not manage the field team directly.
                </Text>
              </View>
              {saving ? (
                <ActivityIndicator color={colors.blue} />
              ) : (
                <Switch
                  value={settings.liveLocationEnabled}
                  onValueChange={toggleLive}
                  trackColor={{ false: colors.line, true: "#86EFAC" }}
                  thumbColor={settings.liveLocationEnabled ? colors.green : "#fff"}
                />
              )}
            </View>
          </Card>
          <Card>
            <Row label="Visit check-in radius" value={`${settings.visitCheckinRadiusMeters} m`} />
            <Row label="Tracking interval" value={`${Math.round(settings.trackingIntervalSeconds / 60)} min`} />
            <Row label="Currency" value={settings.currency} />
            <Row label="Timezone" value={settings.timezone} />
          </Card>
        </>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={typo.muted}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  label: { fontWeight: "800", color: colors.text, fontSize: 16 },
  value: { fontWeight: "800", color: colors.text },
});
