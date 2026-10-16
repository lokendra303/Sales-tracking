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
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!accessToken) return;
    if (admin) {
      Alert.alert("Managers register themselves", "Approve new companies under Registrations on the desk.");
      return;
    }
    setLoading(true);
    try {
      await api("/users", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name,
          phone,
          email,
          employeeId,
          designation,
          city,
          address: address || undefined,
          joiningDate: joiningDate || undefined,
          password,
        }),
      });
      goBack("/team");
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard header={<ScreenHeader title={admin ? "Add manager" : "Add employee"} back align="center" fallback="/team" />}>
      <Text style={typo.muted}>
        {admin
          ? "System admins approve manager registrations on the desk. They do not add employees here."
          : "All fields marked * are required. The employee logs in on the phone app only."}
      </Text>
      {admin ? null : (
        <>
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
          <PasswordField label="App password *" value={password} onChangeText={setPassword} />
          <Button title="Save employee" tone="green" onPress={save} loading={loading} />
        </>
      )}
    </Screen>
  );
}
