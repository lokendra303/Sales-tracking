import { useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Field, PasswordField, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { isAdmin } from "@/lib/roles";
import { colors, radius, typo } from "@/lib/theme";

type AccountKind = "SALES_EXECUTIVE" | "MANAGER";

export default function NewUserScreen() {
  const { accessToken, user } = useAuth();
  const admin = isAdmin(user?.roles);
  const params = useLocalSearchParams<{ kind?: string }>();
  const startAsDesk = params.kind === "desk" || params.kind === "manager";
  const [role, setRole] = useState<AccountKind>(startAsDesk ? "MANAGER" : "SALES_EXECUTIVE");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState(startAsDesk ? "Desk assistant" : "Sales Executive");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    if (admin) return "Add manager";
    return role === "MANAGER" ? "Add desk login" : "Add field employee";
  }, [admin, role]);

  function pickRole(next: AccountKind) {
    setRole(next);
    if (next === "MANAGER" && (designation === "Sales Executive" || !designation.trim())) {
      setDesignation("Desk assistant");
    }
    if (next === "SALES_EXECUTIVE" && (designation === "Desk assistant" || !designation.trim())) {
      setDesignation("Sales Executive");
    }
  }

  async function save() {
    if (!accessToken) return;
    if (admin) {
      Alert.alert("Managers register themselves", "Approve new companies under Registrations on the desk.");
      return;
    }
    if (!name.trim() || !employeeId.trim() || phone.replace(/\D/g, "").length < 10) {
      Alert.alert("Missing details", "Enter name, employee ID, and a 10-digit mobile.");
      return;
    }
    if (!email.trim() || !designation.trim() || !city.trim()) {
      Alert.alert("Missing details", "Email, designation, and city are required.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters for the password.");
      return;
    }
    setLoading(true);
    try {
      await api("/users", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: name.trim(),
          phone,
          email: email.trim(),
          employeeId: employeeId.trim(),
          designation: designation.trim(),
          city: city.trim(),
          address: address.trim() || undefined,
          joiningDate: joiningDate.trim() || undefined,
          password,
          role,
        }),
      });
      Alert.alert(
        role === "MANAGER" ? "Desk login saved" : "Employee saved",
        role === "MANAGER"
          ? `${name.trim()} can sign in on SalesTrack Desk with mobile + password (their own — not yours).`
          : `${name.trim()} can sign in on the phone with mobile + password.`,
      );
      goBack("/team");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Try again.";
      const needsApi =
        /only add sales executives|Managers can only add/i.test(message) ||
        /forbidden/i.test(message);
      Alert.alert(
        "Could not save",
        needsApi
          ? `${message}\n\nThe live API may be old. Redeploy the backend so desk logins work.`
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard header={<ScreenHeader title={title} back align="center" fallback="/team" />}>
      <Text style={typo.muted}>
        {admin
          ? "System admins approve manager registrations on the desk. They do not add employees here."
          : role === "MANAGER"
            ? "Create another login for the same company desk. They get their own mobile + password — never share yours."
            : "Add a field executive for the phone app, or switch to Desk login for another portal user."}
      </Text>
      {admin ? null : (
        <>
          <Text style={styles.kindLabel}>Account type *</Text>
          <View style={styles.kindRow}>
            <Pressable
              style={[styles.kindChip, role === "SALES_EXECUTIVE" && styles.kindOn]}
              onPress={() => pickRole("SALES_EXECUTIVE")}
              accessibilityRole="button"
              accessibilityState={{ selected: role === "SALES_EXECUTIVE" }}
            >
              <Text style={[styles.kindTitle, role === "SALES_EXECUTIVE" && styles.kindTitleOn]}>Field</Text>
              <Text style={styles.kindHint}>Phone app only</Text>
            </Pressable>
            <Pressable
              style={[styles.kindChip, role === "MANAGER" && styles.kindOn]}
              onPress={() => pickRole("MANAGER")}
              accessibilityRole="button"
              accessibilityState={{ selected: role === "MANAGER" }}
            >
              <Text style={[styles.kindTitle, role === "MANAGER" && styles.kindTitleOn]}>Desk login</Text>
              <Text style={styles.kindHint}>Same portal, own password</Text>
            </Pressable>
          </View>
          <Field label="Full name *" value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" />
          <Field label="Employee ID *" value={employeeId} onChangeText={setEmployeeId} placeholder="EMP001" autoCapitalize="characters" />
          <Field
            label="Phone *"
            value={phone}
            onChangeText={setPhone}
            keyboardType="number-pad"
            digitsOnly
            placeholder="10-digit mobile"
            autoCapitalize="none"
          />
          <Field label="Email *" value={email} onChangeText={setEmail} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" />
          <Field label="Designation *" value={designation} onChangeText={setDesignation} placeholder="Sales Executive" autoCapitalize="words" />
          <Field label="City *" value={city} onChangeText={setCity} placeholder="City" autoCapitalize="words" />
          <Field label="Joining date (YYYY-MM-DD)" value={joiningDate} onChangeText={setJoiningDate} placeholder="2026-10-15" autoCapitalize="none" />
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="Optional" multiline />
          <PasswordField label={role === "MANAGER" ? "Desk password *" : "App password *"} value={password} onChangeText={setPassword} />
          <Button
            title={role === "MANAGER" ? "Save desk login" : "Save field employee"}
            tone="green"
            onPress={save}
            loading={loading}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kindLabel: { ...typo.muted, fontWeight: "700", marginTop: 4 },
  kindRow: { flexDirection: "row", gap: 10 },
  kindChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#fff",
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 2,
  },
  kindOn: { borderColor: colors.blue, backgroundColor: "#EFF6FF" },
  kindTitle: { fontWeight: "800", color: colors.text },
  kindTitleOn: { color: colors.blue },
  kindHint: { ...typo.muted, fontSize: 12 },
});
