import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { LiveCamera } from "@/components/live-camera";
import { ServerPhoto } from "@/components/server-photo";
import { loadLocation } from "@/lib/device-location";
import { ActionRow, Button, Card, Field, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, apiUpload, isOfflineError, loadBillPhoto, loadVisitPhoto, serverReachable, type Visit } from "@/lib/api";
import { assertNearShop, finishReading } from "@/lib/finish-visit";
import { haversineMeters } from "@/lib/geo";
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

  async function saveLivePhoto(fileUri: string) {
    if (!accessToken || !visit) return;
    setBusy(true);
    const Location = await loadLocation();
    const permission = Location ? await Location.requestForegroundPermissionsAsync() : { granted: false };
    const position = permission.granted && Location
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
      if (isOfflineError(err) && !(await serverReachable())) {
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
      Alert.alert(
        "Could not save photo",
        isOfflineError(err)
          ? "The phone is online, but the photo did not upload. Try again."
          : err instanceof Error
            ? err.message
            : "Try again.",
      );
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
    const photoSaved = offline.jobs.some((job) => job.kind === "visit-photo" && job.path === `/visits/${visit.id}/photo`);
    if (outcome === "SUCCESS" && !visit.hasPhoto && !photoSaved) {
      Alert.alert("Place photo required", "Shoot the shop now. A successful visit needs proof.");
      return;
    }
    setBusy(true);
    try {
      if (photoSaved) await offline.flush();
      let current = visit;
      try {
        current = await api<Visit>(`/visits/${visit.id}`, { token: accessToken });
        setVisit(current);
      } catch (err) {
        if (!isOfflineError(err)) throw err;
      }
      const point = await finishReading();
      assertNearShop(point, { lat: current.placeLat, lng: current.placeLng });
      const body = { outcome, notes: notes || undefined, checkedOutAt: new Date().toISOString(), ...point };
      try {
        await api(`/visits/${visit.id}/complete`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify(body),
        });
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        const photoJob = offline.jobs.find((job) => job.kind === "visit-photo" && job.path === `/visits/${visit.id}/photo`);
        await offline.enqueue({
          kind: "visit-complete",
          label: `Complete visit · ${current.name}`,
          path: `/visits/${visit.id}/complete`,
          body,
          afterId: photoJob?.id,
        });
        Alert.alert("Saved on this phone", "Visit complete will send when you are back on Wi-Fi.");
        router.replace("/visits");
        return;
      }
      if (outcome === "SUCCESS") {
        router.replace({
          pathname: "/sale/new",
          params: { visitId: String(visit.id), name: visit.name },
        });
      } else {
        router.replace("/visits");
      }
    } catch (err) {
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

  if (capturing && sales) {
    return (
      <Screen scroll={false} header={<ScreenHeader title="Shop photo" back align="center" fallback="/visits" />}>
        {busy ? <ActivityIndicator color={colors.blue} /> : null}
        <LiveCamera onCapture={saveLivePhoto} onCancel={() => setCapturing(false)} />
      </Screen>
    );
  }

  return (
    <Screen keyboard={open} header={<ScreenHeader title={open ? "Visit" : "Visit proof"} back align="center" fallback="/visits" />}>
      <Card>
        <Text style={styles.name}>{visit.name}</Text>
        {visit.userName ? <Text style={typo.muted}>{visit.userName}</Text> : null}
        <Text style={typo.muted}>{[visit.address, visit.city].filter(Boolean).join(", ")}</Text>
        <Text style={typo.muted}>Checked in {when(visit.checkedInAt)}</Text>
        {open ? (
          <Text style={styles.ok}>Start is saved. Finish this visit within 300 m of the shop pin.</Text>
        ) : (
          <Text style={visit.verified ? styles.ok : styles.warn}>
            {visit.distanceMeters != null ? `${visit.distanceMeters} m from shop pin` : "No shop pin"}
            {visit.verified ? " · Finished near the shop" : ""}
          </Text>
        )}
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
      <Card>
        <Text style={styles.cardTitle}>Locations</Text>
        <LocationRow
          label="Check-in"
          at={visit.checkedInAt}
          lat={visit.checkinLat}
          lng={visit.checkinLng}
          accuracy={visit.checkinAccuracy}
          distance={visit.checkinDistanceMeters ?? null}
        />
        <LocationRow
          label="Photo"
          at={visit.photoCapturedAt}
          lat={visit.photoLat}
          lng={visit.photoLng}
          accuracy={visit.photoAccuracy ?? null}
          distance={
            visit.photoLat != null && visit.photoLng != null && visit.placeLat != null && visit.placeLng != null
              ? haversineMeters({ lat: visit.photoLat, lng: visit.photoLng }, { lat: visit.placeLat, lng: visit.placeLng })
              : null
          }
        />
        <LocationRow
          label="Finish"
          at={visit.checkedOutAt}
          lat={visit.checkoutLat ?? null}
          lng={visit.checkoutLng ?? null}
          accuracy={visit.checkoutAccuracy ?? null}
          distance={visit.finishDistanceMeters ?? null}
          empty={open ? "Not finished yet" : "Finish GPS was not saved for this older visit"}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Place photo</Text>
        {visit.hasPhoto && accessToken ? (
              <ServerPhoto
                label="Place photo"
                photoKey={`visit-${visit.id}-${visit.photoReceivedAt ?? ""}`}
                load={(fresh) => loadVisitPhoto(visit.id, accessToken, visit.photoReceivedAt, fresh)}
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
        </Card>

      {open && sales ? (
        <>
          <Field label="Visit note" value={notes} onChangeText={setNotes} multiline placeholder="What happened" />
          <Button title="Complete visit" tone="green" onPress={() => complete("SUCCESS")} disabled={busy} />
          <Button title="Customer not there" tone="ghost" onPress={() => complete("UNAVAILABLE")} disabled={busy} />
          <Text style={styles.hint}>Not there = no photo, follow-up tomorrow. Success needs the place photo. Either way, finish within 300 m of the shop pin.</Text>
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
      {!open && visit.saleId && visit.saleHasBill && accessToken ? (
        <Card>
          <Text style={styles.cardTitle}>Bill photo</Text>
          <ServerPhoto
            label="Bill photo"
            photoKey={`bill-${visit.saleId}`}
            load={(fresh) => loadBillPhoto(visit.saleId!, accessToken, fresh)}
          />
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

function LocationRow({
  label,
  at,
  lat,
  lng,
  accuracy,
  distance,
  empty = "No GPS saved",
}: {
  label: string;
  at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  distance: number | null;
  empty?: string;
}) {
  const has = lat != null && lng != null;
  return (
    <View style={styles.locRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.locLabel}>
          {label}
          {at && has ? ` · ${when(at)}` : ""}
        </Text>
        <Text style={typo.muted}>
          {has
            ? [
                distance != null ? `${distance} m from shop pin` : "No shop pin to compare",
                accuracy != null ? `GPS ±${Math.round(accuracy)} m` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : empty}
        </Text>
      </View>
      {has ? (
        <Pressable onPress={() => openNavigate(lat, lng)} accessibilityLabel={`Open ${label} location on map`}>
          <Text style={styles.locLink}>Map</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  locRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  locLabel: { fontWeight: "800", color: colors.text },
  locLink: { color: colors.blue, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 4 },
  name: { fontSize: 22, fontWeight: "800", color: colors.text },
  cardTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  ok: { color: colors.green, fontWeight: "800" },
  warn: { color: "#92400E", fontWeight: "800" },
  hint: { ...typo.muted, textAlign: "center" },
});
