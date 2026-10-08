import { useState } from "react";
import { goBack } from "@/lib/nav";
import { Alert, Text } from "react-native";
import { Button, Field, PasswordField, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { isAdmin } from "@/lib/roles";
import { typo } from "@/lib/theme";

export default function NewUserScreen() {
  const { accessToken, user } = useAuth();
  const admin = isAdmin(user?.roles);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!accessToken) return;
    setLoading(true);
    try {
      await api("/users", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ name, phone, password }),
      });
      goBack("/team");
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard header={<ScreenHeader title={admin ? "Add manager" : "Add sales executive"} back align="center" fallback="/team" />}>
      <Text style={typo.muted}>
        {admin
          ? "System admins add managers only. Managers then run their own sales team."
          : "Managers add sales executives only."}
      </Text>
      <Field label="Full name *" value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" />
      <Field
        label="Phone *"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="10-digit mobile"
        autoCapitalize="none"
      />
      <PasswordField label="Password *" value={password} onChangeText={setPassword} />
      <Button title={admin ? "Save manager" : "Save sales executive"} tone="green" onPress={save} loading={loading} />
    </Screen>
  );
}
