import { useRef, useState } from "react";
import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExecPicker, useExecutives } from "@/components/exec-filter";
import { LocationPicker, type PickedPlace } from "@/components/location-picker";
import { bestFix, loadLocation } from "@/lib/device-location";
import { ActionRow, Button, Chip, Field, Screen, ScreenHeader } from "@/components/ui";
import { colors, radius } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { ApiError, api, isOfflineError } from "@/lib/api";
import { looksLikeMapsLink, parseMapsLink } from "@/lib/maps-link";
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
  const [productInterest, setProductInterest] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinning, setPinning] = useState(false);
  const [finding, setFinding] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const findSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinLabel, setPinLabel] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [potential, setPotential] = useState("");
  const [temperature, setTemperature] = useState<"HOT" | "WARM" | "COLD">("WARM");
  const [loading, setLoading] = useState(false);

  async function pinShop() {
    setPinning(true);
    try {
      const Location = await loadLocation();
      if (!Location) {
        Alert.alert("Location needed", "Allow location so the executive can follow the map to this shop.");
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Location needed", "Allow location so the executive can follow the map to this shop.");
        return;
      }
      const fix = await bestFix(Location);
      setPin({ lat: fix.lat, lng: fix.lng });
      setPinLabel("Pinned where you are standing");
      if ((fix.accuracy ?? 0) > 50) {
        Alert.alert("Weak GPS", `This pin may be off by about ${Math.round(fix.accuracy!)} m. Step outside the shop and pin again.`);
      }
    } catch (err) {
      Alert.alert("Could not pin", err instanceof Error ? err.message : "Try again at the shop.");
    } finally {
      setPinning(false);
    }
  }

  function scheduleLookup(nextAddress: string, nextCity: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const query = [nextAddress, nextCity].filter(Boolean).join(", ").trim();
    if (looksLikeMapsLink(query) || query.length < 5) return;
    searchTimer.current = setTimeout(() => {
      void findAddress({ quiet: true, address: nextAddress, city: nextCity });
    }, 700);
  }

  async function findAddress(opts?: { quiet?: boolean; address?: string; city?: string }) {
    if (!accessToken) return;
    const query = [opts?.address ?? address, opts?.city ?? city].filter(Boolean).join(", ").trim();
    if (query.length < 3) {
      if (!opts?.quiet) Alert.alert("Address needed", "Type the shop address, or paste a Google Maps link.");
      return;
    }
    const local = parseMapsLink(query);
    if (local) {
      setPin({ lat: local.lat, lng: local.lng });
      setPinLabel("From Google Maps link");
      return;
    }
    const seq = ++findSeq.current;
    setFinding(true);
    setLookupError("");
    try {
      const hits = await api<{ lat: number; lng: number; label?: string }[]>(`/geo?q=${encodeURIComponent(query)}`, {
        token: accessToken,
      });
      if (seq !== findSeq.current) return;
      const hit = hits[0];
      if (!hit) {
        setLookupError("No place matched that address. Add the area and city, or drop the pin on the map.");
        if (!opts?.quiet) {
          Alert.alert("Not found", "Add the area and city, or paste a Google Maps link.");
        }
        return;
      }
      setLookupError("");
      setPin({ lat: hit.lat, lng: hit.lng });
      setPinLabel(hit.label || "Matched address");
    } catch (err) {
      if (seq !== findSeq.current || opts?.quiet) return;
      Alert.alert("Could not find that address", err instanceof Error ? err.message : "Try again.");
    } finally {
      if (seq === findSeq.current) setFinding(false);
    }
  }

  function pickPlace(place: PickedPlace) {
    setPin({ lat: place.lat, lng: place.lng });
    setPinLabel(place.label || "Picked on the map");
    if (!address.trim() && place.address) setAddress(place.address);
    if (!city.trim() && place.city) setCity(place.city);
    setMapOpen(false);
  }

  async function save(createAnyway = false) {
    if (!accessToken) return;
    if (office && !assigneeId) {
      Alert.alert("Assign an executive", "Pick who will own this lead — same as on the desk portal.");
      return;
    }
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) {
      Alert.alert("Missing details", "Enter the business name and a 10-digit mobile.");
      return;
    }
    setLoading(true);
    const payload = {
      name,
      phone,
      contactPerson: contactPerson || undefined,
      businessType: businessType || undefined,
      productInterest: productInterest.trim() || undefined,
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
      <Field label="Phone *" value={phone} onChangeText={setPhone} digitsOnly keyboardType="number-pad" placeholder="10-digit mobile" autoCapitalize="none" />
      <Field label="Contact person" value={contactPerson} onChangeText={setContactPerson} placeholder="Who you meet" />
      <Field label="Business type" value={businessType} onChangeText={setBusinessType} placeholder="Retail, distributor…" />
      <Field
        label="Product / service interest"
        value={productInterest}
        onChangeText={setProductInterest}
        placeholder="What they may buy"
      />
      <Field
        label="Address or Google Maps link"
        value={address}
        onChangeText={(text) => {
          setAddress(text);
          const trimmed = text.trim();
          if (looksLikeMapsLink(trimmed)) {
            if (searchTimer.current) clearTimeout(searchTimer.current);
            const local = parseMapsLink(trimmed);
            if (local) {
              setPin({ lat: local.lat, lng: local.lng });
              setPinLabel("From Google Maps link");
              return;
            }
            if (!accessToken) return;
            api<{ lat: number; lng: number; label?: string }[]>(`/geo?q=${encodeURIComponent(trimmed)}`, {
              token: accessToken,
            })
              .then((hits) => {
                if (!hits[0]) return;
                setPin({ lat: hits[0].lat, lng: hits[0].lng });
                setPinLabel(hits[0].label || "From Google Maps link");
              })
              .catch(() => undefined);
            return;
          }
          scheduleLookup(trimmed, city);
        }}
        placeholder="Any street or area, or paste a Maps link"
        onEndEditing={() => {
          if (!looksLikeMapsLink(address)) void findAddress({ quiet: true });
        }}
      />
      <Field
        label="City"
        value={city}
        onChangeText={(text) => {
          setCity(text);
          scheduleLookup(address, text.trim());
        }}
        placeholder="City"
        onEndEditing={() => {
          if (address.trim().length >= 3 && !looksLikeMapsLink(address)) void findAddress({ quiet: true });
        }}
      />
      <View style={styles.field}>
        <Text style={styles.label}>Shop location</Text>
        {pin ? (
          <View style={styles.pinCard}>
            <Ionicons name="location" size={20} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pinTitle} numberOfLines={2}>
                {pinLabel}
              </Text>
              <Text style={styles.hint}>
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.hint}>
            {finding
              ? "Looking up this address…"
              : lookupError || "Any address is looked up when you pause. A Maps link drops the pin immediately."}
          </Text>
        )}
        <Button title="Find address" icon="search-outline" tone="outline" onPress={() => findAddress()} loading={finding} />
        <ActionRow>
          <Button title={pin ? "Change on map" : "Pick on map"} icon="map-outline" onPress={() => setMapOpen(true)} flex />
          <Button title="Use my GPS here" icon="locate-outline" tone="outline" onPress={pinShop} loading={pinning} flex />
        </ActionRow>
      </View>
      <LocationPicker
        visible={mapOpen}
        initial={pin}
        onClose={() => setMapOpen(false)}
        onPick={pickPlace}
        resolveSearch={
          accessToken
            ? async (q) =>
                api<{ lat: number; lng: number; label?: string }[]>(`/geo?q=${encodeURIComponent(q)}`, {
                  token: accessToken,
                })
            : undefined
        }
      />
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
  pinCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 12,
  },
  pinTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
});
