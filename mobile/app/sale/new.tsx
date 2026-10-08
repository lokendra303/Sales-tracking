import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button, Field, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, apiUpload, isOfflineError, type Sale } from "@/lib/api";
import { useOffline } from "@/lib/offline";
import { colors, typo } from "@/lib/theme";

export default function RecordSaleScreen() {
  const { visitId, name } = useLocalSearchParams<{ visitId?: string; name?: string }>();
  const { accessToken } = useAuth();
  const offline = useOffline();
  const [amount, setAmount] = useState("");
  const [collection, setCollection] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!accessToken || !visitId) return;
    const value = Number(amount);
    if (!(value > 0)) {
      Alert.alert("Sale amount", "Enter the rupee amount of this sale.");
      return;
    }
    const collected = collection.trim() ? Number(collection) : undefined;
    if (collected != null && !(collected >= 0)) {
      Alert.alert("Collection", "Collection must be zero or more.");
      return;
    }
    setBusy(true);
    try {
      const sale = await api<Sale>("/sales", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          visitId: Number(visitId),
          amount: value,
          collectionAmount: collected,
          note: note.trim() || undefined,
          clientRequestId: `visit:${visitId}`,
        }),
      });

      const camera = await ImagePicker.requestCameraPermissionsAsync();
      if (camera.granted) {
        const shot = await ImagePicker.launchCameraAsync({ quality: 0.55, allowsEditing: false });
        if (!shot.canceled && shot.assets[0]) {
          await apiUpload<Sale>(`/sales/${sale.id}/bill`, {
            token: accessToken,
            fileUri: shot.assets[0].uri,
          });
        }
      }
      router.replace("/visits");
    } catch (err) {
      if (isOfflineError(err)) {
        await offline.enqueue({
          kind: "sale",
          label: `Sale · ${name || "shop"}`,
          path: "/sales",
          body: {
            visitId: Number(visitId),
            amount: value,
            collectionAmount: collected,
            note: note.trim() || undefined,
            clientRequestId: `visit:${visitId}`,
          },
        });
        Alert.alert("Saved on this phone", "The sale will send when you are back on Wi-Fi.");
        router.replace("/visits");
        return;
      }
      Alert.alert("Could not save sale", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard header={<ScreenHeader title="Record sale" back align="center" fallback="/visits" />}>
      <Text style={styles.shop}>{name || "Shop"}</Text>
      <Text style={typo.muted}>Amount only. There is no product catalog. Bill photo is optional.</Text>
      <Field label="Sale amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
      <Field
        label="Collection today"
        value={collection}
        onChangeText={setCollection}
        keyboardType="decimal-pad"
        placeholder="Optional"
      />
      <Field label="Note" value={note} onChangeText={setNote} multiline placeholder="Optional note" />
      <Button title="Save sale" tone="green" onPress={save} loading={busy} />
      <Text style={styles.hint}>After save you can shoot the bill. Skip the camera if there is no bill.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shop: { fontSize: 22, fontWeight: "800", color: colors.text },
  hint: { ...typo.muted, textAlign: "center" },
});
