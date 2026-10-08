import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text } from "react-native";
import * as Location from "expo-location";
import { LiveCamera } from "@/components/live-camera";
import { ActionRow, Button, Card, Field, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, apiUpload, fetchVisitPhoto, isOfflineError, visitPhotoUri, type Visit } from "@/lib/api";
import { useOffline } from "@/lib/offline";
import { keepPhoto } from "@/lib/photos";
import { openCall, openNavigate, openWhatsApp, when } from "@/lib/format";
import { isManager, isSales } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const manager = isManager(user?.roles);
  const sales = isSales(user?.roles);
  const offline = useOffline();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      const data = await api<Visit>(`/visits/${id}`, { token: accessToken });
      setVisit(data);
      setNotes(data.notes ?? "");
    } catch {
      setVisit(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!visit?.hasPhoto || !accessToken) {
      setPhotoUrl(null);
      return;
    }
    if (Platform.OS === "web") {
      fetchVisitPhoto(visit.id, accessToken).then(setPhotoUrl).catch(() => setPhotoUrl(null));
      return;
    }
    setPhotoUrl(visitPhotoUri(visit.id, accessToken).uri);
  }, [accessToken, visit?.hasPhoto, visit?.id, visit?.photoReceivedAt]);

  async function saveLivePhoto(fileUri: string) {
    if (!accessToken || !visit) return;
    setBusy(true);
    const permission = await Location.requestForegroundPermissionsAsync();
    const position = permission.granted
      ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      : null;
    const kept = await keepPhoto(fileUri, `visit-${visit.id}-${Date.now()}`);
    const fields = {
      lat: position?.coords.latitude,
      lng: position?.coords.longitude,
      accuracy: position?.coords.accuracy ?? undefined,
      capturedAt: new Date().toISOString(),
    };
    try {
      await apiUpload<Visit>(`/visits/${visit.id}/photo`, {
        token: accessToken,
        fileUri: kept,
        fields,
      });
      setCapturing(false);
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await offline.enqueue({
          kind: "visit-photo",
          label: `Place photo · ${visit.name}`,
          path: `/visits/${visit.id}/photo`,
          fileUri: kept,
          body: fields,
        });
        setCapturing(false);
        Alert.alert("Saved on this phone", "The place photo will upload when you are back on Wi-Fi.");
        return;
      }
      Alert.alert("Could not save photo", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!accessToken || !visit) return;
    setBusy(true);
    try {
      setVisit(await api<Visit>(`/visits/${visit.id}/confirm`, { method: "POST", token: accessToken }));
    } catch (err) {
      Alert.alert("Could not confirm", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function complete(outcome: "SUCCESS" | "UNAVAILABLE") {
    if (!accessToken || !visit) return;
    if (outcome === "SUCCESS" && !visit.hasPhoto) {
      Alert.alert("Place photo required", "Shoot the shop now. A successful visit needs proof.");
      return;
    }
    setBusy(true);
    try {
      await api(`/visits/${visit.id}/complete`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ outcome, notes: notes || undefined, checkedOutAt: new Date().toISOString() }),
      });
      if (outcome === "SUCCESS") {
        router.replace({
          pathname: "/sale/new",
          params: { visitId: String(visit.id), name: visit.name },
        });
      } else {
        router.replace("/visits");
      }
    } catch (err) {
      if (isOfflineError(err)) {
        await offline.enqueue({
          kind: "visit-complete",
          label: `Complete visit · ${visit.name}`,
          path: `/visits/${visit.id}/complete`,
          body: { outcome, notes: notes || undefined, checkedOutAt: new Date().toISOString() },
        });
        Alert.alert("Saved on this phone", "Visit complete will send when you are back on Wi-Fi.");
        router.replace("/visits");
        return;
      }
      Alert.alert("Could not complete", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !visit) {
    return (
      <Screen header={<ScreenHeader title="Visit" back align="center" fallback="/visits" />}>
        <ActivityIndicator color={colors.blue} />
      </Screen>
    );
  }

  const open = visit.status === "IN_PROGRESS";

  return (
    <Screen keyboard={open} header={<ScreenHeader title={open ? "Visit" : "Visit proof"} back align="center" fallback="/visits" />}>
      <Card>
        <Text style={styles.name}>{visit.name}</Text>
        {visit.userName ? <Text style={typo.muted}>{visit.userName}</Text> : null}
        <Text style={typo.muted}>{[visit.address, visit.city].filter(Boolean).join(", ")}</Text>
        <Text style={typo.muted}>Checked in {when(visit.checkedInAt)}</Text>
        <Text style={visit.verified ? styles.ok : styles.warn}>
          {visit.distanceMeters != null ? `${visit.distanceMeters} m from shop pin` : "No shop pin"}
          {visit.verified ? " · Location verified" : " · Location not verified"}
        </Text>
      </Card>

      {visit.phone ? (
        <ActionRow>
          <Button title="Call" flex onPress={() => openCall(visit.phone!)} />
          <Button title="WhatsApp" tone="outline" flex onPress={() => openWhatsApp(visit.phone!)} />
        </ActionRow>
      ) : null}
      <Button
        title="Open shop on map"
        tone="outline"
        onPress={() => openNavigate(visit.placeLat, visit.placeLng, [visit.address, visit.city].filter(Boolean).join(", "))}
      />
      {visit.checkinLat != null && visit.checkinLng != null ? (
        <Button title="Open check-in GPS" tone="outline" onPress={() => openNavigate(visit.checkinLat, visit.checkinLng)} />
      ) : null}
      {visit.photoLat != null && visit.photoLng != null ? (
        <Button title="Open photo GPS" tone="outline" onPress={() => openNavigate(visit.photoLat, visit.photoLng)} />
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Place photo</Text>
        {capturing && sales ? (
          <>
            {busy ? <ActivityIndicator color={colors.blue} /> : null}
            <LiveCamera onCapture={saveLivePhoto} onCancel={() => setCapturing(false)} />
          </>
        ) : (
          <>
            {visit.hasPhoto && accessToken ? (
              <Image
                source={
                  Platform.OS === "web"
                    ? photoUrl
                      ? { uri: photoUrl }
                      : undefined
                    : visitPhotoUri(visit.id, accessToken)
                }
                style={styles.photo}
              />
            ) : (
              <Text style={typo.muted}>
                {manager
                  ? "No live shop photo yet."
                  : "Open the live camera at the shop. Gallery upload is blocked."}
              </Text>
            )}
            {visit.hasPhoto ? (
              <Text style={typo.muted}>
                Received {visit.photoReceivedAt ? when(visit.photoReceivedAt) : "just now"}
                {visit.photoCapturedAt ? ` · taken ${when(visit.photoCapturedAt)}` : ""}
              </Text>
            ) : null}
            {open && sales ? (
              <Button
                title={visit.hasPhoto ? "Retake with live camera" : "Take live photo"}
                tone="green"
                onPress={() => setCapturing(true)}
                disabled={busy}
              />
            ) : null}
          </>
        )}
      </Card>

      {open && sales ? (
        <>
          <Field label="Visit note" value={notes} onChangeText={setNotes} multiline placeholder="What happened" />
          <Button title="Complete visit" tone="green" onPress={() => complete("SUCCESS")} disabled={busy} />
          <Button title="Customer not there" tone="ghost" onPress={() => complete("UNAVAILABLE")} disabled={busy} />
          <Text style={styles.hint}>Not there = no photo, follow-up tomorrow. Success needs the place photo.</Text>
        </>
      ) : null}
      {open && manager ? (
        <Card>
          <Text style={styles.cardTitle}>Visit in progress</Text>
          <Text style={typo.muted}>The executive is at the shop. The place photo and GPS upload when they finish.</Text>
        </Card>
      ) : null}
      {!open ? (
        <Card>
          <Text style={styles.cardTitle}>{visit.outcome === "UNAVAILABLE" ? "Customer not there" : "Visit completed"}</Text>
          {visit.notes ? <Text style={typo.muted}>{visit.notes}</Text> : null}
          <Text style={typo.muted}>{visit.checkedOutAt ? `Finished ${when(visit.checkedOutAt)}` : ""}</Text>
          {visit.saleAmount != null ? <Text style={styles.ok}>Sale ₹{visit.saleAmount}</Text> : null}
          {visit.managerConfirmedAt ? <Text style={styles.ok}>Manager confirmed</Text> : null}
        </Card>
      ) : null}
      {manager && !open && visit.outcome === "SUCCESS" && visit.hasPhoto && !visit.managerConfirmedAt ? (
        <Button title="Confirm visit" tone="green" onPress={confirm} loading={busy} />
      ) : null}
      {sales && !open && visit.outcome === "SUCCESS" && !visit.saleId ? (
        <Button
          title="Record sale"
          tone="green"
          onPress={() =>
            router.push({
              pathname: "/sale/new",
              params: { visitId: String(visit.id), name: visit.name },
            })
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: "800", color: colors.text },
  cardTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  ok: { color: colors.green, fontWeight: "800" },
  warn: { color: "#92400E", fontWeight: "800" },
  photo: { width: "100%", height: 220, borderRadius: 14, backgroundColor: colors.line },
  hint: { ...typo.muted, textAlign: "center" },
});
