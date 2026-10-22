import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LiveCamera } from "@/components/live-camera";
import { ServerPhoto } from "@/components/server-photo";
import { loadLocation } from "@/lib/device-location";
import { ActionRow, Button, Card, Field, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import {
  api,
  apiUpload,
  isOfflineError,
  loadBillPhoto,
  loadDemoPhoto,
  loadVisitPhoto,
  serverReachable,
  type Visit,
} from "@/lib/api";
import { assertNearShop, finishReading } from "@/lib/finish-visit";
import { haversineMeters } from "@/lib/geo";
import { useOffline } from "@/lib/offline";
import { ensureGalleryAccess } from "@/lib/gallery";
import { keepPhoto } from "@/lib/photos";
import { openCall, openMapPin, openNavigate, openWhatsApp, when } from "@/lib/format";
import { isManager, isSales } from "@/lib/roles";
import { colors, typo } from "@/lib/theme";

const MAX_DEMO_PHOTOS = 6;

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
  const [demoUris, setDemoUris] = useState<Record<number, string>>({});
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

  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !visit?.demoPhotos?.length) {
        setDemoUris({});
        return;
      }
      let live = true;
      (async () => {
        const next: Record<number, string> = {};
        for (const photo of visit.demoPhotos ?? []) {
          const uri = await loadDemoPhoto(visit.id, photo.id, accessToken).catch(() => null);
          if (uri) next[photo.id] = uri;
        }
        if (live) setDemoUris(next);
      })();
      return () => {
        live = false;
      };
    }, [accessToken, visit?.id, visit?.demoPhotos?.map((p) => p.id).join(",")]),
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

  async function pickDemoPhotos() {
    if (!accessToken || !visit) return;
    const have = visit.demoPhotos?.length ?? 0;
    const left = MAX_DEMO_PHOTOS - have;
    if (left <= 0) {
      Alert.alert("Limit reached", `You can add up to ${MAX_DEMO_PHOTOS} gallery photos.`);
      return;
    }
    try {
      const allowed = await ensureGalleryAccess("attach demo photos from your gallery");
      if (!allowed) return;
      const ImagePicker = await import("expo-image-picker");
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: left,
        quality: 0.55,
        allowsEditing: false,
      });
      if (picked.canceled || !picked.assets.length) return;
      setBusy(true);
      let uploaded = 0;
      for (const asset of picked.assets.slice(0, left)) {
        const kept = await keepPhoto(asset.uri, `demo-${visit.id}-${Date.now()}-${uploaded}`);
        try {
          await apiUpload<Visit>(`/visits/${visit.id}/demo-photos`, {
            token: accessToken,
            fileUri: kept,
          });
          uploaded += 1;
        } catch (err) {
          if (isOfflineError(err) && !(await serverReachable())) {
            await offline.enqueue({
              kind: "visit-demo",
              label: `Demo photo · ${visit.name}`,
              path: `/visits/${visit.id}/demo-photos`,
              fileUri: kept,
            });
            uploaded += 1;
          } else {
            Alert.alert(
              "Could not upload",
              err instanceof Error ? err.message : "One gallery photo did not upload.",
            );
            break;
          }
        }
      }
      await load();
      if (uploaded && !(await serverReachable())) {
        Alert.alert("Saved on this phone", "Gallery photos will upload when you are back on Wi-Fi.");
      }
    } catch {
      Alert.alert("Gallery", "Could not open the photo gallery. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDemoPhoto(photoId: number) {
    if (!accessToken || !visit) return;
    setBusy(true);
    try {
      setVisit(await api<Visit>(`/visits/${visit.id}/demo-photos/${photoId}`, { method: "DELETE", token: accessToken }));
    } catch (err) {
      Alert.alert("Could not remove", err instanceof Error ? err.message : "Try again.");
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

      {/* Manager proof-first: place photo before actions */}
      {manager && !open ? (
        <Card>
          <Text style={styles.cardTitle}>Place proof</Text>
          {visit.hasPhoto && accessToken ? (
            <ServerPhoto
              label="Place photo"
              photoKey={`visit-${visit.id}-${visit.photoReceivedAt ?? ""}`}
              load={(fresh) => loadVisitPhoto(visit.id, accessToken, visit.photoReceivedAt, fresh)}
            />
          ) : (
            <Text style={typo.muted}>No live shop photo on this visit.</Text>
          )}
          {visit.hasPhoto ? (
            <Text style={typo.muted}>
              Received {visit.photoReceivedAt ? when(visit.photoReceivedAt) : "just now"}
              {visit.photoCapturedAt ? ` · taken ${when(visit.photoCapturedAt)}` : ""}
            </Text>
          ) : null}
        </Card>
      ) : null}

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

      {!manager || open ? (
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
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Demo photos (optional)</Text>
        <Text style={typo.muted}>
          Extra product or shelf photos from your gallery. Not a substitute for the live place proof.
        </Text>
        {(visit.demoPhotos?.length ?? 0) > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.demoRow}>
            {(visit.demoPhotos ?? []).map((photo) => (
              <View key={photo.id} style={styles.demoItem}>
                {demoUris[photo.id] ? (
                  <Image source={{ uri: demoUris[photo.id] }} style={styles.demoThumb} accessibilityLabel="Demo photo" />
                ) : (
                  <View style={[styles.demoThumb, styles.demoEmpty]}>
                    <ActivityIndicator color={colors.blue} />
                  </View>
                )}
                {open && sales ? (
                  <Pressable onPress={() => removeDemoPhoto(photo.id)} disabled={busy}>
                    <Text style={styles.demoRemove}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={typo.muted}>No gallery photos yet.</Text>
        )}
        {open && sales ? (
          <Button
            title={
              (visit.demoPhotos?.length ?? 0) >= MAX_DEMO_PHOTOS
                ? `Gallery full (${MAX_DEMO_PHOTOS})`
                : `Add from gallery (${visit.demoPhotos?.length ?? 0}/${MAX_DEMO_PHOTOS})`
            }
            tone="outline"
            onPress={pickDemoPhotos}
            disabled={busy || (visit.demoPhotos?.length ?? 0) >= MAX_DEMO_PHOTOS}
          />
        ) : null}
      </Card>

      {open && sales ? (
        <>
          <Field label="Visit note" value={notes} onChangeText={setNotes} multiline placeholder="What happened" />
          <Button title="Complete visit" tone="green" onPress={() => complete("SUCCESS")} disabled={busy} />
          <Button title="Customer not there" tone="ghost" onPress={() => complete("UNAVAILABLE")} disabled={busy} />
          <Text style={styles.hint}>
            Place proof (live camera) is required for a successful visit. Gallery demo photos and bill photo are optional.
            Finish within 300 m of the shop pin.
          </Text>
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
        <Pressable onPress={() => openMapPin(lat, lng)} accessibilityLabel={`Open ${label} location on map`}>
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
  demoRow: { gap: 10, paddingVertical: 4 },
  demoItem: { width: 112, gap: 4 },
  demoThumb: { width: 112, height: 112, borderRadius: 12, backgroundColor: colors.line },
  demoEmpty: { alignItems: "center", justifyContent: "center" },
  demoRemove: { color: colors.red, fontWeight: "700", fontSize: 12, textAlign: "center" },
});
