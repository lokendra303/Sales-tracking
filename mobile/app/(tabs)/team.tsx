import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Badge, Button, Card, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type FieldTeammate } from "@/lib/api";
import { ageLabel, openNavigate } from "@/lib/format";
import { isAdmin, isManager, roleLabel } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

type TeamUser = {
  id: number;
  name: string;
  phone: string;
  status: string;
  roles: string[];
};

export default function TeamScreen() {
  const { accessToken, user, refreshUser } = useAuth();
  const admin = isAdmin(user?.roles);
  const manager = isManager(user?.roles);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [field, setField] = useState<FieldTeammate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLive, setSavingLive] = useState(false);
  const liveOn = Boolean(user?.liveLocationEnabled);

  const loadField = useCallback(() => {
    if (!accessToken || !manager) return;
    api<FieldTeammate[]>("/field/team", { token: accessToken }).then(setField).catch(() => undefined);
  }, [accessToken, manager]);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      api<TeamUser[]>("/users", { token: accessToken })
        .then(setUsers)
        .catch(() => undefined)
        .finally(() => setLoading(false));
      loadField();
      const tick = manager ? setInterval(loadField, 20000) : null;
      return () => {
        if (tick) clearInterval(tick);
      };
    }, [accessToken, loadField, manager]),
  );

  async function toggleLive(enabled: boolean) {
    if (!accessToken) return;
    setSavingLive(true);
    try {
      await api("/settings/live-location", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ enabled }),
      });
      await refreshUser();
      loadField();
    } catch (err) {
      Alert.alert("Could not update", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSavingLive(false);
    }
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title={admin ? "Managers" : "Team"}
          subtitle={admin ? "System admin — managers only" : "Every executive is listed. Open one to review their work."}
          right={
            <Pressable style={styles.add} onPress={() => router.push("/user/new")} accessibilityLabel={admin ? "Add manager" : "Add sales executive"}>
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          }
        />
      }
    >
      {manager ? (
        <Card>
          <View style={styles.liveRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.name}>Live location</Text>
              <Text style={typo.muted}>
                {liveOn
                  ? "On. After Start Field Work, GPS from the phone shows here. Visit photos still prove each shop."
                  : "Off. Executives still check in and upload a shop photo. Turn On to watch live GPS."}
              </Text>
            </View>
            {savingLive ? (
              <ActivityIndicator color={colors.blue} />
            ) : (
              <Switch
                value={liveOn}
                onValueChange={toggleLive}
                trackColor={{ false: colors.line, true: "#86EFAC" }}
                thumbColor={liveOn ? colors.green : "#fff"}
              />
            )}
          </View>
          <Button title="Open visit photos" tone="outline" onPress={() => router.push("/visits")} />
        </Card>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.blue} />
      ) : users.length === 0 ? (
        <EmptyState icon="people-outline" text={admin ? "No managers yet" : "No sales executives yet"} />
      ) : (
        users.map((item) => {
          const live = field.find((row) => row.userId === item.id);
          const streaming = Boolean(live?.liveStreaming && live.lastLat != null && live.lastLng != null);
          return (
            <Card key={item.id}>
              <View style={styles.row}>
                <Avatar name={item.name} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={typo.muted}>{roleLabel(item.roles)}</Text>
                  <Text style={typo.muted}>{item.phone}</Text>
                  {live?.fieldStatus === "ACTIVE" ? (
                    <Text style={typo.muted}>
                      In field · {live.durationMinutes} min
                      {live.liveStreaming ? ` · ${ageLabel(live.lastSeenAgeSeconds)}` : ""}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  label={streaming ? "Live" : live?.fieldStatus === "ACTIVE" ? "In field" : item.status === "ACTIVE" ? "Active" : "Off"}
                  tone={streaming || live?.fieldStatus === "ACTIVE" || item.status === "ACTIVE" ? "green" : "red"}
                />
              </View>
              {manager ? (
                <>
                  <Button
                    title="See this executive’s leads"
                    tone="outline"
                    onPress={() => router.push({ pathname: "/leads", params: { assigneeId: String(item.id) } })}
                  />
                  <Button
                    title="See this executive’s visits"
                    tone="outline"
                    onPress={() => router.push({ pathname: "/visits", params: { userId: String(item.id) } })}
                  />
                </>
              ) : null}
              {streaming ? (
                <Button
                  title="Open live location"
                  tone="green"
                  onPress={() => openNavigate(live!.lastLat, live!.lastLng, item.name)}
                />
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  liveRow: { flexDirection: "row", alignItems: "center" },
  name: { fontWeight: "800", color: colors.text, fontSize: 16 },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
});
