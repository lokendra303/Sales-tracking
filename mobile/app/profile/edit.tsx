import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Alert, StyleSheet, Text } from "react-native";
import { Button, Field, PasswordField, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type ApiUser } from "@/lib/api";
import { isOffice } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

export default function EditProfileScreen() {
  const { user, accessToken, refreshUser } = useAuth();
  const office = isOffice(user?.roles);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [designation, setDesignation] = useState(user?.designation ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setEmail(user?.email ?? "");
    setDesignation(user?.designation ?? "");
    setCity(user?.city ?? "");
    setAddress(user?.address ?? "");
  }, [user]);

  if (!office) {
    return (
      <Screen header={<ScreenHeader title="Edit profile" back align="center" fallback="/more" />}>
        <Text style={typo.muted}>Ask your manager to update your profile details.</Text>
      </Screen>
    );
  }

  async function saveProfile() {
    if (!accessToken) return;
    setBusy(true);
    try {
      await api<ApiUser>("/auth/me", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          designation: designation || undefined,
          city: city || undefined,
          address: address || null,
        }),
      });
      await refreshUser();
      Alert.alert("Saved", "Use the updated mobile number the next time you log in.");
      router.back();
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!accessToken) return;
    if (newPassword !== confirmPassword) {
      Alert.alert("Password", "New password and confirm password do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password updated", "Log in with the new password next time.");
    } catch (err) {
      Alert.alert("Could not update password", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard header={<ScreenHeader title="Edit profile" back align="center" fallback="/more" />}>
      <Text style={typo.muted}>
        Login is not fixed in the app. It uses the mobile number and password saved in the database. Change them here anytime.
      </Text>
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Mobile (login)" value={phone} onChangeText={setPhone} keyboardType="number-pad" digitsOnly />
      <Field label="Email (password reset)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Designation" value={designation} onChangeText={setDesignation} autoCapitalize="words" />
      <Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
      <Field label="Address" value={address} onChangeText={setAddress} multiline />
      <Button title="Save profile" tone="green" onPress={saveProfile} loading={busy} />

      <Text style={styles.section}>Change password</Text>
      <PasswordField label="Current password" value={oldPassword} onChangeText={setOldPassword} />
      <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} />
      <PasswordField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} />
      <Button title="Update password" onPress={savePassword} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: "800", color: colors.text, fontSize: 16, marginTop: 12 },
});
