import { useState } from "react";
import { Redirect, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Field, PasswordField, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, typo } from "@/lib/theme";

export default function LoginScreen() {
  const { user, login } = useAuth();
  const [phone, setPhone] = useState("8888888888");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  async function onSubmit() {
    setError("");
    setLoading(true);
    try {
      await login(phone.trim(), password);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="trending-up" size={34} color="#fff" />
        </View>
        <Text style={styles.brand}>SalesTrack</Text>
        <Text style={styles.sub}>Grow together</Text>
      </View>

      <View style={styles.card}>
        <Field
          label="Mobile number"
          placeholder="10-digit mobile"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoComplete="tel"
        />
        <PasswordField label="Password" value={password} onChangeText={setPassword} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Log in" onPress={onSubmit} loading={loading} />
        <Text style={styles.help}>Forgot password? Contact admin.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 28, paddingBottom: 8, gap: 8 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontSize: 30, fontWeight: "800", color: colors.text, letterSpacing: -0.6 },
  sub: { ...typo.muted, fontSize: 15 },
  card: { gap: 14, paddingTop: 12 },
  error: { color: colors.red, textAlign: "center", fontWeight: "700" },
  help: { ...typo.muted, textAlign: "center" },
});
