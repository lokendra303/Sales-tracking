import { useCallback, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Alert, StyleSheet, Text } from "react-native";
import * as Location from "expo-location";
import { Button, Card, Screen, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, isOfflineError, type BeatToday, type CheckPreview, type Visit } from "@/lib/api";
import { haversineMeters } from "@/lib/geo";
import { persistGet } from "@/lib/persist";
import { saveLocalVisit } from "@/lib/local-visits";
import { useOffline } from "@/lib/offline";
import { openNavigate } from "@/lib/format";
import { colors, typo } from "@/lib/theme";

export default function CheckInScreen() {
  const { accessToken } = useAuth();
  const offline = useOffline();
  const params = useLocalSearchParams<{ leadId?: string; customerId?: string; beatStopId?: string }>();
  const [preview, setPreview] = useState<CheckPreview | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const target = {
    leadId: params.leadId ? Number(params.leadId) : undefined,
    customerId: params.customerId ? Number(params.customerId) : undefined,
    beatStopId: params.beatStopId ? Number(params.beatStopId) : undefined,
  };

  const check = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Turn on location so we can check you are at the shop.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const point = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? undefined,
      };
      setCoords(point);
      try {
        setPreview(
          await api<CheckPreview>("/visits/preview", {
            method: "POST",
            token: accessToken,
            body: JSON.stringify({ ...target, ...point }),
          }),
        );
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        const cached = await persistGet("cache:/beat/today");
        const beat = cached ? (JSON.parse(cached) as BeatToday) : null;
        const stop = beat?.stops.find(
          (item) =>
            (target.leadId && item.leadId === target.leadId) ||
            (target.customerId && item.customerId === target.customerId),
        );
        const distance =
          stop?.placeLat != null && stop.placeLng != null
            ? haversineMeters(point, { lat: stop.placeLat, lng: stop.placeLng })
            : null;
        const radius = beat?.radiusMeters ?? 100;
        setPreview({
          name: stop?.name ?? "Shop check",
          phone: stop?.phone ?? null,
          address: stop?.address ?? null,
          city: stop?.city ?? null,
          placeLat: stop?.placeLat ?? null,
          placeLng: stop?.placeLng ?? null,
          leadId: stop?.leadId ?? target.leadId ?? null,
          customerId: stop?.customerId ?? target.customerId ?? null,
          beatStopId: stop?.id ?? target.beatStopId ?? null,
          distanceMeters: distance,
          radiusMeters: radius,
          withinRadius: distance != null ? distance <= radius : false,
          hasPin: stop?.placeLat != null,
          allowUnverified: distance == null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read GPS.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, params.leadId, params.customerId, params.beatStopId]);

  async function startVisit() {
    if (!accessToken || !coords) return;
    setLoading(true);
    try {
      const visit = await api<Visit>("/visits/check-in", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ ...target, ...coords, checkedInAt: new Date().toISOString() }),
      });
      router.replace(`/visit/${visit.id}`);
    } catch (err) {
      if (isOfflineError(err) && coords && preview) {
        const checkedInAt = new Date().toISOString();
        const job = await offline.enqueue({
          kind: "check-in",
          label: `Check-in · ${preview.name}`,
          path: "/visits/check-in",
          body: {
            ...target,
            ...coords,
            checkedInAt,
          },
        });
        const localId = `local-${Date.now()}`;
        await saveLocalVisit({
          localId,
          name: preview.name,
          phone: preview.phone,
          address: preview.address,
          city: preview.city,
          placeLat: preview.placeLat,
          placeLng: preview.placeLng,
          leadId: preview.leadId ?? undefined,
          customerId: preview.customerId ?? undefined,
          beatStopId: preview.beatStopId ?? undefined,
          checkinLat: coords.lat,
          checkinLng: coords.lng,
          checkinAccuracy: coords.accuracy,
          checkedInAt,
          distanceMeters: preview.distanceMeters,
          verified: preview.withinRadius,
          photoUri: null,
          photoLat: null,
          photoLng: null,
          photoCapturedAt: null,
          notes: "",
          outcome: null,
          checkInJobId: job.id,
          photoJobId: null,
          completeJobId: null,
        });
        Alert.alert(
          "Saved on this phone",
          "GPS is stored. Take the live shop photo now. Photo and location upload together when the network is back.",
        );
        router.replace({ pathname: "/visit/draft", params: { id: localId } } as unknown as Href);
        void offline.flush();
        return;
      }
      Alert.alert("Cannot start visit", err instanceof Error ? err.message : "Try again at the shop.");
    } finally {
      setLoading(false);
    }
  }

  const canStart = Boolean(coords && preview && (preview.withinRadius || preview.allowUnverified));

  return (
    <Screen header={<ScreenHeader title="Check-in" back align="center" fallback="/visits" />}>
      <Card style={styles.pinCard}>
        <Text style={styles.pin}>📍</Text>
        <Text style={styles.name}>{preview?.name ?? "Shop check"}</Text>
        <Text style={[typo.muted, { textAlign: "center" }]}>
          {[preview?.address, preview?.city].filter(Boolean).join(", ") || "We will measure GPS against the shop pin."}
        </Text>
        {preview?.distanceMeters != null ? (
          <Text style={preview.withinRadius ? styles.ok : styles.warn}>
            {preview.distanceMeters} m from shop · need {preview.radiusMeters} m
          </Text>
        ) : preview && !preview.hasPin ? (
          <Text style={styles.warn}>This stop has no map pin yet.</Text>
        ) : (
          <Text style={typo.muted}>Tap Check location to read your phone GPS.</Text>
        )}
        {error ? <Text style={styles.warn}>{error}</Text> : null}
      </Card>
      <Button title="Check location" onPress={check} loading={loading} />
      {preview ? (
        <Button
          title="Navigate"
          tone="outline"
          onPress={() => openNavigate(preview.placeLat, preview.placeLng, [preview.address, preview.city].filter(Boolean).join(", "))}
        />
      ) : null}
      <Button title="Start visit" tone="green" onPress={startVisit} disabled={!canStart || loading} />
      <Text style={styles.hint}>No network is fine. GPS and the live photo stay on this phone and send automatically.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pinCard: { alignItems: "center", paddingVertical: 28 },
  pin: { fontSize: 42 },
  name: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
  ok: { color: colors.green, fontWeight: "800" },
  warn: { color: colors.red, fontWeight: "800", textAlign: "center" },
  hint: { ...typo.muted, textAlign: "center" },
});
