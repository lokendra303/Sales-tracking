import { useState } from "react";
import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { ExecPicker, useExecutives } from "@/components/exec-filter";
import { Button, Chip, Field, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { ApiError, api, isOfflineError } from "@/lib/api";
import { requestId, useOffline } from "@/lib/offline";

export default function NewLeadScreen() {
  const { accessToken } = useAuth();
  const offline = useOffline();
  const { manager: office, people } = useExecutives();
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinning, setPinning] = useState(false);
  const [notes, setNotes] = useState("");
  const [potential, setPotential] = useState("");
  const [temperature, setTemperature] = useState<"HOT" | "WARM" | "COLD">("WARM");
  const [loading, setLoading] = useState(false);

  async function pinShop() {
    setPinning(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Location needed", "Allow location so the executive can follow the map to this shop.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPin({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch (err) {
      Alert.alert("Could not pin", err instanceof Error ? err.message : "Try again at the shop.");
    } finally {
      setPinning(false);
    }
  }

  async function save(createAnyway = false) {
    if (!accessToken) return;
    setLoading(true);
    const payload = {
      name,
      phone,
      contactPerson: contactPerson || undefined,
      businessType: businessType || undefined,
      address: address || undefined,
      city: city || undefined,
      latitude: pin?.lat,
      longitude: pin?.lng,
      notes: notes || undefined,
      potential: potential ? Number(potential) : undefined,
      temperature,
      createAnyway,
      clientRequestId: requestId("lead"),
      assigneeId: office && assigneeId ? assigneeId : undefined,
    };
    try {
      const lead = await api<{ id: number }>("/leads", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      });
      router.replace(`/lead/${lead.id}`);
    } catch (err) {
      if (isOfflineError(err)) {
        await offline.enqueue({
          kind: "lead",
          label: `Lead · ${name}`,
          path: "/leads",
          body: payload,
        });
        Alert.alert("Saved on this phone", "We will send this lead when you are back on Wi-Fi.");
        router.replace("/leads");
        return;
      }
      if (err instanceof ApiError && err.code === "DUPLICATE") {
        const extra = err.extra as { lead?: { name: string; assigneeName?: string | null } } | undefined;
        Alert.alert(
          "Possible duplicate",
          extra?.lead
            ? `${extra.lead.name} already exists${extra.lead.assigneeName ? `, assigned to ${extra.lead.assigneeName}` : ""}.`
            : err.message,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Create anyway", onPress: () => save(true) },
          ],
        );
      } else {
        Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard header={<ScreenHeader title="Add lead" back align="center" fallback="/leads" />}>
      <Field label="Business name *" value={name} onChangeText={setName} placeholder="Shop or company" />
      <Field label="Phone *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit mobile" />
      <Field label="Contact person" value={contactPerson} onChangeText={setContactPerson} placeholder="Who you meet" />
      <Field label="Business type" value={businessType} onChangeText={setBusinessType} placeholder="Retail, distributor…" />
      <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, area" />
      <Field label="City" value={city} onChangeText={setCity} placeholder="City" />
      <View style={styles.field}>
        <Text style={styles.label}>Shop location</Text>
        <Text style={styles.hint}>
          {pin
            ? `Pin saved ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}. The executive will follow this map.`
            : "Stand at the shop and pin it, or type the address. The map opens from this lead."}
        </Text>
        <Button title={pin ? "Update pin" : "Pin shop on map"} tone="outline" onPress={pinShop} loading={pinning} />
      </View>
      <Field label="Potential ₹" value={potential} onChangeText={setPotential} keyboardType="numeric" placeholder="Expected value" />
      <View style={styles.field}>
        <Text style={styles.label}>Temperature</Text>
        <View style={styles.temps}>
          {(["HOT", "WARM", "COLD"] as const).map((item) => (
            <Chip key={item} label={item} on={temperature === item} onPress={() => setTemperature(item)} />
          ))}
        </View>
      </View>
      {office ? (
        <View style={styles.field}>
          <Text style={styles.label}>Assign to executive</Text>
          <Text style={styles.hint}>Only the person you pick will see this lead on their phone.</Text>
          {people.length ? (
            <ExecPicker people={people} value={assigneeId} onChange={setAssigneeId} />
          ) : (
            <Text style={styles.hint}>Add a sales executive on Team first.</Text>
          )}
        </View>
      ) : null}
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="What to remember" />
      <Button title="Save lead" tone="green" onPress={() => save()} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  temps: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { fontSize: 13, color: "#64748B" },
});
