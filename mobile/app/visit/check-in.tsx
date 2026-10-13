import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Alert, StyleSheet, Text } from "react-native";
import { Button, Card, Screen, ScreenHeader } from "@/components/ui";
import { bestFix, loadLocation } from "@/lib/device-location";
import { useAuth } from "@/lib/auth";
import { api, ApiError, isOfflineError, type BeatToday, type CheckPreview, type Visit } from "@/lib/api";
import { haversineMeters } from "@/lib/geo";
import { persistGet } from "@/lib/persist";
import { saveLocalVisit } from "@/lib/local-visits";
import { useOffline } from "@/lib/offline";
import { openNavigate } from "@/lib/format";
import { colors, typo } from "@/lib/theme";

type Point = { lat: number; lng: number; accuracy?: number };

export default function CheckInScreen() {
  const { accessToken } = useAuth();
  const offline = useOffline();
  const params = useLocalSearchParams<{ leadId?: string; customerId?: string; beatStopId?: string }>();
  const [preview, setPreview] = useState<CheckPreview | null>(null);
  const [coords, setCoords] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const startingRef = useRef(false);
  const locatingRef = useRef<Promise<Point | null> | null>(null);
  const coordsAt = useRef(0);

  const target = {
    leadId: params.leadId ? Number(params.leadId) : undefined,
    customerId: params.customerId ? Number(params.customerId) : undefined,
    beatStopId: params.beatStopId ? Number(params.beatStopId) : undefined,
  };

  async function offlinePreview(point: Point): Promise<CheckPreview> {
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
    return {
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
      radiusMeters: 300,
      withinRadius: distance != null ? distance <= 300 : false,
      hasPin: stop?.placeLat != null,
      allowUnverified: true,
    };
  }

  /** One GPS read at a time; a second tap waits for the same read instead of starting another. */
  const locate = useCallback((): Promise<Point | null> => {
    if (locatingRef.current) return locatingRef.current;
    const work = (async () => {
      setLocating(true);
      setError("");
      try {
        const Location = await loadLocation();
        const permission = Location ? await Location.requestForegroundPermissionsAsync() : null;
        if (!Location || !permission?.granted) {
          setError("Turn on location so we can save where this visit started.");
          return null;
        }
        const point = await bestFix(Location, 6000);
        coordsAt.current = Date.now();
        setCoords(point);
        if (accessToken) {
          try {
            setPreview(
              await api<CheckPreview>("/visits/preview", {
                method: "POST",
                token: accessToken,
                body: JSON.stringify({ ...target, ...point }),
              }),
            );
          } catch (err) {
            if (isOfflineError(err)) setPreview(await offlinePreview(point));
            else setError(err instanceof Error ? err.message : "Could not check this shop.");
          }
        }
        return point;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read GPS.");
        return null;
      } finally {
        setLocating(false);
        locatingRef.current = null;
      }
    })();
    locatingRef.current = work;
    return work;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, params.leadId, params.customerId, params.beatStopId]);

  useEffect(() => {
    const timer = setTimeout(() => void locate(), 0);
    return () => clearTimeout(timer);
  }, [locate]);

  function showBlocked(err: unknown) {
    const visitId = err instanceof ApiError ? (err.extra as { visitId?: number } | undefined)?.visitId : undefined;
    const message = err instanceof Error ? err.message : "Try again.";
    if (visitId) {
      Alert.alert("Cannot start visit", message, [
        { text: "Close", style: "cancel" },
        { text: "Open that visit", onPress: () => router.replace(`/visit/${visitId}`) },
      ]);
      return;
    }
    Alert.alert("Cannot start visit", message);
  }

  async function startVisit() {
    if (!accessToken || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const fresh = coords && Date.now() - coordsAt.current < 2 * 60 * 1000;
      const point = fresh ? coords : await locate();
      if (!point) {
        Alert.alert("Location needed", "We could not read GPS. Turn on location and try again.");
        return;
      }
      const checkedInAt = new Date().toISOString();
      try {
        const visit = await api<Visit>("/visits/check-in", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ ...target, ...point, checkedInAt }),
        });
        router.replace(`/visit/${visit.id}`);
      } catch (err) {
        if (!isOfflineError(err)) {
          showBlocked(err);
          return;
        }
        const place = preview ?? (await offlinePreview(point));
        const job = await offline.enqueue({
          kind: "check-in",
          label: `Check-in · ${place.name}`,
          path: "/visits/check-in",
          body: { ...target, ...point, checkedInAt },
        });
        const localId = `local-${Date.now()}`;
        await saveLocalVisit({
          localId,
          name: place.name,
          phone: place.phone,
          address: place.address,
          city: place.city,
          placeLat: place.placeLat,
          placeLng: place.placeLng,
          leadId: place.leadId ?? undefined,
          customerId: place.customerId ?? undefined,
          beatStopId: place.beatStopId ?? undefined,
          checkinLat: point.lat,
          checkinLng: point.lng,
          checkinAccuracy: point.accuracy,
          checkedInAt,
          distanceMeters: place.distanceMeters,
          verified: place.withinRadius,
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
      }
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  const doneVisitId = preview?.doneTodayVisitId ?? null;

  return (
    <Screen header={<ScreenHeader title="Check-in" back align="center" fallback="/visits" />}>
      <Card style={styles.pinCard}>
        <Text style={styles.pin}>📍</Text>
        <Text style={styles.name}>{preview?.name ?? "Shop check"}</Text>
        <Text style={[typo.muted, { textAlign: "center" }]}>
          {[preview?.address, preview?.city].filter(Boolean).join(", ") || "Start from anywhere. Finish within 300 m of the shop pin."}
        </Text>
        {doneVisitId ? (
          <Text style={styles.ok}>Already visited today. This shop is done — no need to visit again.</Text>
        ) : locating && !coords ? (
          <Text style={typo.muted}>Getting your GPS location…</Text>
        ) : preview?.distanceMeters != null ? (
          <Text style={styles.ok}>
            {preview.distanceMeters} m from the shop pin
            {coords?.accuracy != null ? ` (GPS ±${Math.round(coords.accuracy)} m)` : ""}. This check-in location is saved
            with the visit.
          </Text>
        ) : preview && !preview.hasPin ? (
          <Text style={styles.warn}>No shop pin yet. You can start. Ask the manager to correct the location before you finish.</Text>
        ) : coords ? (
          <Text style={typo.muted}>GPS ready. Tap Start visit.</Text>
        ) : (
          <Text style={typo.muted}>Tap Check location, or just tap Start visit.</Text>
        )}
        {error ? <Text style={styles.warn}>{error}</Text> : null}
      </Card>
      {doneVisitId ? (
        <Button title="View today's visit" tone="green" onPress={() => router.replace(`/visit/${doneVisitId}`)} />
      ) : (
        <Button title="Start visit" tone="green" onPress={startVisit} loading={starting} />
      )}
      <Button
        title={coords ? "Check location again" : "Check location"}
        tone="outline"
        onPress={() => void locate()}
        loading={locating && !starting}
        disabled={starting}
      />
      {preview ? (
        <Button
          title="Navigate"
          tone="outline"
          onPress={() => openNavigate(preview.placeLat, preview.placeLng, [preview.address, preview.city].filter(Boolean).join(", "))}
        />
      ) : null}
      <Text style={styles.hint}>Start from anywhere. Your check-in GPS is saved for the manager. Finish within 300 m of the shop pin.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pinCard: { alignItems: "center", paddingVertical: 28 },
  pin: { fontSize: 42 },
  name: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
  ok: { color: colors.green, fontWeight: "800", textAlign: "center" },
  warn: { color: colors.red, fontWeight: "800", textAlign: "center" },
  hint: { ...typo.muted, textAlign: "center" },
});
