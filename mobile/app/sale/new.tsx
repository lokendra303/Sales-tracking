import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button, Field, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, apiUpload, isOfflineError, type Sale } from "@/lib/api";
import { useOffline } from "@/lib/offline";
import { keepPhoto } from "@/lib/photos";
import { colors, typo } from "@/lib/theme";

export default function RecordSaleScreen() {
  const { visitId, name, checkInJobId, completeJobId, localId } = useLocalSearchParams<{
    visitId?: string;
    name?: string;
    checkInJobId?: string;
    completeJobId?: string;
    localId?: string;
  }>();
  const { accessToken } = useAuth();
  const offline = useOffline();
  const [amount, setAmount] = useState("");
  const [collection, setCollection] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveBill(fileUri: string, saleId: number | null, saleJobId: string | null) {
    const kept = await keepPhoto(fileUri, `bill-${localId || saleId || Date.now()}`);
    if (saleId) {
      try {
        await apiUpload<Sale>(`/sales/${saleId}/bill`, { token: accessToken, fileUri: kept });
        return;
      } catch (err) {
        if (!isOfflineError(err)) throw err;
      }
    }
    await offline.enqueue({
      kind: "sale-bill",
      label: `Bill photo · ${name || "shop"}`,
      path: saleId ? `/sales/${saleId}/bill` : "/sales/{saleId}/bill",
      fileUri: kept,
      afterId: saleId ? undefined : saleJobId ?? undefined,
      bindFrom: saleId ? undefined : saleJobId ?? undefined,
      bind: saleId ? undefined : "sale",
    });
  }

  async function save() {
    if (!accessToken) return;
    const linked = !visitId && completeJobId && checkInJobId;
    if (!visitId && !linked) return;
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
    const clientRequestId = localId ? `local:${localId}` : `visit:${visitId}`;
    const payload = {
      visitId: visitId ? Number(visitId) : 0,
      amount: value,
      collectionAmount: collected,
      note: note.trim() || undefined,
      clientRequestId,
    };
    let serverSaleId: number | null = null;
    let saleJobId: string | null = null;
    try {
      if (linked) {
        const job = await offline.enqueue({
          kind: "sale",
          label: `Sale · ${name || "shop"}`,
          path: "/sales",
          body: payload,
          afterId: completeJobId,
          bindFrom: checkInJobId,
          bind: "visit",
        });
        saleJobId = job.id;
      } else {
        try {
          const sale = await api<Sale>("/sales", {
            method: "POST",
            token: accessToken,
            body: JSON.stringify(payload),
          });
          serverSaleId = sale.id;
        } catch (err) {
          if (!isOfflineError(err)) throw err;
          const job = await offline.enqueue({
            kind: "sale",
            label: `Sale · ${name || "shop"}`,
            path: "/sales",
            body: payload,
          });
          saleJobId = job.id;
        }
      }

      const camera = await ImagePicker.requestCameraPermissionsAsync();
      if (camera.granted) {
        const shot = await ImagePicker.launchCameraAsync({ quality: 0.55, allowsEditing: false });
        if (!shot.canceled && shot.assets[0] && (serverSaleId || saleJobId)) {
          await saveBill(shot.assets[0].uri, serverSaleId, saleJobId);
        }
      }
      if (saleJobId) {
        void offline.flush();
        Alert.alert("Saved on this phone", "The sale and bill photo will send when the network is back.");
      }
      router.replace("/visits");
    } catch (err) {
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
      <Text style={styles.hint}>Bill photo is optional. If there is no network, the sale and photo stay on this phone and send later.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shop: { fontSize: 22, fontWeight: "800", color: colors.text },
  hint: { ...typo.muted, textAlign: "center" },
});
