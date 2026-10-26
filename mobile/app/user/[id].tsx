import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Button, Chip, Field, PasswordField, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type TeamPerson } from "@/lib/api";
import { isManager, roleLabel } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

function dayValue(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function EditUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const manager = isManager(user?.roles);
  const [person, setPerson] = useState<TeamPerson | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const deskLogin = Boolean(person?.roles?.includes("MANAGER"));
  const isMainOwner = Boolean(person?.isOwner);
  const iAmOwner = Boolean(user?.isOwner);
  const canToggleStatus =
    Boolean(person) &&
    person!.id !== user?.id &&
    !isMainOwner &&
    (iAmOwner || !deskLogin);
  const screenTitle = isMainOwner ? "Main manager" : deskLogin ? "Desk login" : "Field employee";

  const load = useCallback(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    api<TeamPerson>(`/users/${id}`, { token: accessToken })
      .then((row) => {
        setPerson(row);
        setName(row.name);
        setPhone(row.phone);
        setEmail(row.email ?? "");
        setEmployeeId(row.employeeId ?? "");
        setDesignation(row.designation ?? "");
        setCity(row.city ?? "");
        setAddress(row.address ?? "");
        setJoiningDate(dayValue(row.joiningDate));
        setStatus(row.status === "DISABLED" ? "DISABLED" : "ACTIVE");
        setPassword(row.loginPassword ?? "");
      })
      .catch(() => setPerson(null))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  useFocusEffect(load);

  async function save() {
    if (!accessToken || !id || !manager) return;
    const nextPassword = password.trim();
    const passwordChanged = nextPassword !== (person?.loginPassword ?? "").trim();
    if (passwordChanged && nextPassword.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters, or leave the password as it is.");
      return;
    }
    setSaving(true);
    try {
      await api(`/users/${id}`, {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({
          name,
          phone,
          email,
          employeeId,
          designation,
          city,
          address: address || null,
          joiningDate: joiningDate || null,
          ...(canToggleStatus ? { status } : {}),
          ...(passwordChanged && nextPassword ? { password: nextPassword } : {}),
        }),
      });
      Alert.alert(
        "Saved",
        passwordChanged && nextPassword
          ? `Details updated. Password is now ${nextPassword}.`
          : isMainOwner
            ? "Main manager details updated."
            : deskLogin
              ? "Desk login details updated."
              : "Field employee details updated.",
      );
      router.replace("/team");
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen header={<ScreenHeader title={screenTitle} back align="center" fallback="/team" />}>
        <ActivityIndicator color={colors.blue} />
      </Screen>
    );
  }

  if (!person) {
    return (
      <Screen header={<ScreenHeader title={screenTitle} back align="center" fallback="/team" />}>
        <Text style={typo.muted}>Could not load this person.</Text>
      </Screen>
    );
  }

  return (
    <Screen keyboard header={<ScreenHeader title={person.name} back align="center" fallback="/team" />}>
      <Text style={typo.muted}>
        {isMainOwner
          ? "Main manager (registered with email). This login cannot be turned off by desk helpers."
          : deskLogin
            ? `${roleLabel(person.roles)} · same company portal with their own mobile + password.${iAmOwner ? " You can set status to Off." : ""}`
            : `${roleLabel(person.roles)} · phone app only. Update profile details here.`}
      </Text>
      <Field label="Full name *" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Employee ID *" value={employeeId} onChangeText={setEmployeeId} autoCapitalize="characters" />
      <Field label="Phone *" value={phone} onChangeText={setPhone} keyboardType="number-pad" digitsOnly />
      <Field label="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Designation *" value={designation} onChangeText={setDesignation} autoCapitalize="words" />
      <Field label="City *" value={city} onChangeText={setCity} autoCapitalize="words" />
      <PasswordField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Not set yet"
        startVisible
      />
      <Field label="Joining date (YYYY-MM-DD)" value={joiningDate} onChangeText={setJoiningDate} autoCapitalize="none" />
      <Field label="Address" value={address} onChangeText={setAddress} multiline />
      {canToggleStatus ? (
        <>
          <Text style={styles.label}>Status</Text>
          <View style={styles.row}>
            <Chip label="Active" on={status === "ACTIVE"} onPress={() => setStatus("ACTIVE")} />
            <Chip label="Off" on={status === "DISABLED"} onPress={() => setStatus("DISABLED")} />
          </View>
        </>
      ) : (
        <Text style={typo.muted}>
          Status: {isMainOwner ? "Main manager (always on)" : status === "ACTIVE" ? "Active" : "Off"}
        </Text>
      )}
      {manager ? <Button title={saving ? "Saving…" : "Save"} tone="green" onPress={save} disabled={saving} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typo.muted, marginTop: 8, marginBottom: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
});
