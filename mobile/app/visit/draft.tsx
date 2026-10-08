import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, Image, StyleSheet, Text } from "react-native";
import * as Location from "expo-location";
import { LiveCamera } from "@/components/live-camera";
import { Button, Card, Field, Screen, ScreenHeader } from "@/components/ui";
import { getLocalVisit, saveLocalVisit, type LocalVisit } from "@/lib/local-visits";
import { useOffline } from "@/lib/offline";
import { keepPhoto } from "@/lib/photos";
import { openNavigate, when } from "@/lib/format";
import { colors, typo } from "@/lib/theme";

export default function DraftVisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const offline = useOffline();
  const [visit, setVisit] = useState<LocalVisit | null>(null);
  const [notes, setNotes] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const row = await getLocalVisit(id);
    setVisit(row);
    if (row) setNotes(row.notes);
    if (row && !offline.jobs.some((job) => job.id === row.checkInJobId || job.id === row.photoJobId || job.id === row.completeJobId)) {
      if (row.outcome) router.replace("/visits");
    }
  }, [id, offline.jobs]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function saveLivePhoto(fileUri: string) {
    if (!visit) return;
    setBusy(true);
    try {
      const kept = await keepPhoto(fileUri, `${visit.localId}-${Date.now()}`);
      const permission = await Location.requestForegroundPermissionsAsync();
      const position = permission.granted
        ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        : null;
      const capturedAt = new Date().toISOString();
      const fields = {
        lat: position?.coords.latitude ?? visit.checkinLat,
        lng: position?.coords.longitude ?? visit.checkinLng,
        accuracy: position?.coords.accuracy ?? visit.checkinAccuracy,
        capturedAt,
      };
      const job = await offline.enqueue({
        kind: "visit-photo",
        label: `Place photo · ${visit.name}`,
        path: "/visits/{visitId}/photo",
        fileUri: kept,
        body: fields,
        afterId: visit.checkInJobId,
        bindFrom: visit.checkInJobId,
        bind: "visit",
      });
      const next: LocalVisit = {
        ...visit,
        photoUri: kept,
        photoLat: fields.lat,
        photoLng: fields.lng,
        photoAccuracy: fields.accuracy,
        photoCapturedAt: capturedAt,
        photoJobId: job.id,
      };
      await saveLocalVisit(next);
      setVisit(next);
      setCapturing(false);
      void offline.flush();
      Alert.alert("Photo saved on this phone", "It will upload with the GPS when the network is back.");
    } finally {
      setBusy(false);
    }
  }

  async function complete(outcome: "SUCCESS" | "UNAVAILABLE") {
    if (!visit) return;
    if (outcome === "SUCCESS" && !visit.photoUri) {
      Alert.alert("Place photo required", "Shoot the shop now. The photo stays on this phone until it can upload.");
      return;
    }
    setBusy(true);
    try {
      const checkedOutAt = new Date().toISOString();
      const afterId = outcome === "SUCCESS" && visit.photoJobId ? visit.photoJobId : visit.checkInJobId;
      const job = await offline.enqueue({
        kind: "visit-complete",
        label: `Complete visit · ${visit.name}`,
        path: "/visits/{visitId}/complete",
        body: { outcome, notes: notes || undefined, checkedOutAt },
        afterId,
        bindFrom: visit.checkInJobId,
        bind: "visit",
      });
      const next: LocalVisit = { ...visit, notes, outcome, completeJobId: job.id };
      await saveLocalVisit(next);
      void offline.flush();
      if (outcome === "SUCCESS") {
        router.replace({
          pathname: "/sale/new",
          params: {
            name: visit.name,
            localId: visit.localId,
            checkInJobId: visit.checkInJobId,
            completeJobId: job.id,
          },
        });
        return;
      }
      Alert.alert("Saved on this phone", "This visit will sync when the network is back.");
      router.replace("/visits");
    } finally {
      setBusy(false);
    }
  }

  if (!visit) {
    return (
      <Screen header={<ScreenHeader title="Visit" back align="center" fallback="/visits" />}>
        <Text style={typo.muted}>This saved visit is already on its way to the server.</Text>
      </Screen>
    );
  }

  return (
    <Screen keyboard header={<ScreenHeader title="Visit" back align="center" fallback="/visits" />}>
      <Card>
        <Text style={styles.name}>{visit.name}</Text>
        <Text style={typo.muted}>{[visit.address, visit.city].filter(Boolean).join(", ")}</Text>
        <Text style={typo.muted}>Checked in {when(visit.checkedInAt)} · saved on this phone</Text>
        <Text style={visit.verified ? styles.ok : styles.warn}>
          {visit.distanceMeters != null ? `${visit.distanceMeters} m from shop pin` : "GPS saved"}
          {visit.verified ? " · Inside check-in area" : ""}
        </Text>
        <Text style={styles.ok}>Photo and GPS upload automatically when the network is back.</Text>
      </Card>

      <Button
        title="Open shop on map"
        tone="outline"
        onPress={() => openNavigate(visit.placeLat, visit.placeLng, [visit.address, visit.city].filter(Boolean).join(", "))}
      />
      <Button title="Open check-in GPS" tone="outline" onPress={() => openNavigate(visit.checkinLat, visit.checkinLng)} />

      <Card>
        <Text style={styles.cardTitle}>Place photo</Text>
        {capturing ? (
          <LiveCamera onCapture={saveLivePhoto} onCancel={() => setCapturing(false)} />
        ) : (
          <>
            {visit.photoUri ? (
              <Image source={{ uri: visit.photoUri }} style={styles.photo} />
            ) : (
              <Text style={typo.muted}>Open the live camera at the shop. The picture stays on this phone until it uploads.</Text>
            )}
            {visit.photoCapturedAt ? <Text style={typo.muted}>Taken {when(visit.photoCapturedAt)}</Text> : null}
            {!visit.outcome ? (
              <Button
                title={visit.photoUri ? "Retake with live camera" : "Take live photo"}
                tone="green"
                onPress={() => setCapturing(true)}
                disabled={busy}
              />
            ) : null}
          </>
        )}
      </Card>

      {!visit.outcome ? (
        <>
          <Field label="Visit note" value={notes} onChangeText={setNotes} multiline placeholder="What happened" />
          <Button title="Complete visit" tone="green" onPress={() => complete("SUCCESS")} disabled={busy} />
          <Button title="Customer not there" tone="ghost" onPress={() => complete("UNAVAILABLE")} disabled={busy} />
          <Text style={styles.hint}>Not there = no photo. Success needs the live place photo. Nothing is lost if the network is down.</Text>
        </>
      ) : (
        <Text style={styles.ok}>Waiting to sync.</Text>
      )}
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
