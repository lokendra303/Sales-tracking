import { useCallback, useState } from "react";
import { router, useFocusEffect, type Href } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Badge, Card, EmptyState, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type FieldTeammate } from "@/lib/api";
import { ageLabel, openCall, openNavigate } from "@/lib/format";
import { isAdmin, isManager, roleLabel } from "@/lib/roles";
import { colors, radius, shadow, typo } from "@/lib/theme";

type TeamUser = {
  id: number;
  name: string;
  phone: string;
  employeeId?: string | null;
  designation?: string | null;
  city?: string | null;
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
          subtitle={admin ? "System admin — managers only" : "Your sales executives"}
          right={
            <Pressable style={styles.add} onPress={() => router.push("/user/new")} accessibilityLabel={admin ? "Add manager" : "Add sales executive"}>
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          }
        />
      }
    >
      {manager && users.length ? (
        <View style={styles.summary}>
          <SummaryCell value={field.filter((row) => row.liveStreaming).length} label="Live" color={colors.green} />
          <View style={styles.summaryDivider} />
          <SummaryCell value={field.filter((row) => row.fieldStatus === "ACTIVE").length} label="In field" color={colors.amber} />
          <View style={styles.summaryDivider} />
          <SummaryCell value={users.length} label="Executives" color={colors.blue} />
        </View>
      ) : null}
      {manager ? (
        <Card>
          <View style={styles.liveRow}>
            <View style={[styles.liveIcon, { backgroundColor: liveOn ? colors.greenSoft : colors.bg }]}>
              <Ionicons name="navigate" size={18} color={liveOn ? colors.green : colors.muted} />
            </View>
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
          const inField = live?.fieldStatus === "ACTIVE";
          return (
            <Card key={item.id}>
              <View style={styles.row}>
                <View>
                  <Avatar name={item.name} tone={inField ? "green" : "blue"} />
                  {manager ? (
                    <View style={[styles.dot, { backgroundColor: streaming ? colors.green : inField ? colors.amber : "#CBD5E1" }]} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={typo.muted} numberOfLines={1}>
                    {manager
                      ? [item.employeeId, item.designation, item.phone].filter(Boolean).join(" · ")
                      : `${roleLabel(item.roles)} · ${item.phone}`}
                  </Text>
                  {inField ? (
                    <Text style={styles.fieldLine} numberOfLines={1}>
                      In field · {live!.durationMinutes} min
                      {live!.liveStreaming ? ` · ${ageLabel(live!.lastSeenAgeSeconds)}` : ""}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  label={streaming ? "Live" : inField ? "In field" : item.status === "ACTIVE" ? "Active" : "Off"}
                  tone={streaming || inField ? "green" : item.status === "ACTIVE" ? "slate" : "red"}
                />
              </View>
              {manager ? (
                <View style={styles.actions}>
                  <MiniAction
                    icon="create-outline"
                    label="Edit"
                    onPress={() => router.push(`/user/${item.id}` as Href)}
                  />
                  <MiniAction
                    icon="briefcase-outline"
                    label="Leads"
                    onPress={() => router.push({ pathname: "/leads", params: { assigneeId: String(item.id) } })}
                  />
                  <MiniAction
                    icon="camera-outline"
                    label="Visits"
                    onPress={() => router.push({ pathname: "/visits", params: { userId: String(item.id) } })}
                  />
                  <MiniAction icon="call-outline" label="Call" onPress={() => openCall(item.phone)} />
                  {streaming ? (
                    <MiniAction
                      icon="navigate"
                      label="Map"
                      tone="green"
                      onPress={() => openNavigate(live!.lastLat, live!.lastLng, item.name)}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

function SummaryCell({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MiniAction({
  icon,
  label,
  onPress,
  tone = "blue",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "blue" | "green";
}) {
  const fg = tone === "green" ? colors.green : colors.blue;
  const bg = tone === "green" ? colors.greenSoft : colors.blueSoft;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.mini, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={16} color={fg} />
      <Text style={[styles.miniText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  liveIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  name: { fontWeight: "800", color: colors.text, fontSize: 16 },
  fieldLine: { color: colors.green, fontWeight: "700", fontSize: 12, marginTop: 2 },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  mini: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 38,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
  },
  miniText: { fontWeight: "800", fontSize: 12 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    ...shadow,
  },
  summaryCell: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { fontSize: 22, fontWeight: "800" },
  summaryLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.line },
});
