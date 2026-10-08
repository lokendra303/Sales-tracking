import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Avatar, Button, Card, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useOffline } from "@/lib/offline";
import { accessLabel, isAdmin, isManager, isOffice, isSales, roleLabel } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";
import { when } from "@/lib/format";

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const offline = useOffline();
  const roles = user?.roles ?? [];
  const office = isOffice(roles);

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <Screen header={<ScreenHeader title="Profile" subtitle="Your account on this phone" />}>
      <Card style={styles.hero}>
        <Avatar name={user?.name ?? "?"} size={72} />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={typo.muted}>{roleLabel(roles)}</Text>
        <Text style={typo.muted}>{user?.phone}</Text>
        <Text style={typo.muted}>{user?.tenant.name}</Text>
      </Card>
      <Card>
        <Row label="Access" value={accessLabel(roles)} />
        {office ? (
          <>
            <Row label="Web portal" value="Yes — desk work" />
            <Row label="Mobile app" value="Yes — same login" />
          </>
        ) : (
          <Row label="Web portal" value="No — phone only" />
        )}
        {isSales(roles) ? (
          <>
            <Row label="Waiting to send" value={offline.pending ? String(offline.pending) : "None"} />
            <Row label="Last sync" value={offline.lastSync ? when(offline.lastSync) : "Not yet"} />
            <Row label="Live location" value={user?.liveLocationEnabled ? "On after Start Field Work" : "Off"} />
          </>
        ) : null}
        {isManager(roles) ? (
          <>
            <Row label="Manages" value="Sales executives" />
            <Row label="Live location" value={user?.liveLocationEnabled ? "On" : "Off"} />
          </>
        ) : null}
        {!isAdmin(roles) ? <Row label="Reminders" value="This phone only · no Firebase" /> : null}
        {isAdmin(roles) ? (
          <>
            <Row label="Manages" value="Managers only" />
            <Row label="Company settings" value="Open Settings tab" />
            <Row label="Live location" value={user?.liveLocationEnabled ? "On" : "Off"} />
          </>
        ) : null}
      </Card>
      {!isAdmin(roles) ? <Button title="Open reminders" onPress={() => router.push("/notifications")} /> : null}
      {offline.pending || !offline.online ? (
        <Button
          title={offline.online ? `Send ${offline.pending} saved items` : "No internet · retry when on Wi-Fi"}
          onPress={() => offline.flush()}
        />
      ) : null}
      {offline.jobs.slice(0, 5).map((job) => (
        <Text key={job.id} style={typo.muted}>
          {job.label}
        </Text>
      ))}
      <Button title="Log out" tone="red" onPress={onLogout} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: 22 },
  name: { fontSize: 22, fontWeight: "800", color: colors.text },
  row: { width: "100%", flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, gap: 12 },
  rowLabel: { color: colors.text, fontWeight: "700" },
  rowValue: { color: colors.muted, textAlign: "right", flex: 1, fontWeight: "600" },
});
