import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { LocationGeocodedAddress } from "expo-location";
import { PickMap, type PickMapHandle } from "@/components/pick-map";
import { Button } from "@/components/ui";
import { bestFix, loadLocation } from "@/lib/device-location";
import { INDIA, pickerHtml, type MapMessage } from "@/lib/map-html";
import { colors, radius, shadow, typo } from "@/lib/theme";

export type PickedPlace = { lat: number; lng: number; address?: string; city?: string; label?: string };

type LatLng = { lat: number; lng: number };
type View3 = LatLng & { zoom: number };
type Place = { label: string; address?: string; city?: string };

// Below this zoom the pin covers a whole neighbourhood, so it cannot mark one shop.
const MIN_ZOOM = 15;
const plusCode = /^[23456789CFGHJMPQRVWX]{4,}\+/i;

function describe(hit: LocationGeocodedAddress): Place {
  const street = [hit.streetNumber, hit.street].filter(Boolean).join(" ");
  const name = hit.name && !plusCode.test(hit.name) && hit.name !== hit.streetNumber && hit.name !== street ? hit.name : null;
  const parts = [...new Set([name, street || null, hit.district].filter(Boolean) as string[])];
  const address = parts.join(", ");
  const city = hit.city ?? hit.subregion ?? undefined;
  const label = hit.formattedAddress ?? [address, city, hit.region].filter(Boolean).join(", ");
  return { label, address: address || undefined, city: city || undefined };
}

function round(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

type Props = {
  visible: boolean;
  initial: LatLng | null;
  onClose: () => void;
  onPick: (place: PickedPlace) => void;
};

export function LocationPicker(props: Props) {
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose} statusBarTranslucent>
      {props.visible ? <PickerBody {...props} /> : null}
    </Modal>
  );
}

function PickerBody({ initial, onClose, onPick }: Props) {
  const insets = useSafeAreaInsets();
  const map = useRef<PickMapHandle>(null);
  const [start] = useState<View3>(() => (initial ? { ...initial, zoom: 18 } : INDIA));
  const [html] = useState(() => pickerHtml(start));
  const [center, setCenter] = useState<View3>(start);
  const [moving, setMoving] = useState(false);
  const [mapError, setMapError] = useState<"" | "offline" | "tiles">("");
  const [place, setPlace] = useState<Place | null>(null);
  const [looking, setLooking] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const ready = useRef(false);
  const pending = useRef<View3 | null>(null);
  const userMoved = useRef(false);
  const programmatic = useRef(false);
  const centerRef = useRef<View3>(start);
  const geoSeq = useRef(0);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useRef<Awaited<ReturnType<typeof loadLocation>>>(null);

  const moveTo = useCallback((lat: number, lng: number, zoom: number) => {
    if (!ready.current) {
      pending.current = { lat, lng, zoom };
      return;
    }
    programmatic.current = true;
    map.current?.setCenter(lat, lng, zoom);
  }, []);

  const lookUp = useCallback(async (lat: number, lng: number) => {
    const Location = location.current;
    if (!Location) return;
    const seq = ++geoSeq.current;
    setLooking(true);
    try {
      const [hit] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (seq === geoSeq.current) setPlace(hit ? describe(hit) : null);
    } catch {
      if (seq === geoSeq.current) setPlace(null);
    } finally {
      if (seq === geoSeq.current) setLooking(false);
    }
  }, []);

  const scheduleLookUp = useCallback(
    (next: View3) => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
      if (next.zoom < MIN_ZOOM) {
        geoSeq.current++;
        setPlace(null);
        setLooking(false);
        return;
      }
      geoTimer.current = setTimeout(() => lookUp(next.lat, next.lng), 450);
    },
    [lookUp],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const Location = await loadLocation();
      if (!Location || !alive) return;
      const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (!permission?.granted || !alive) return;
      location.current = Location;
      scheduleLookUp(centerRef.current);
      if (start.zoom >= MIN_ZOOM) return;
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (alive && last && !userMoved.current) moveTo(last.coords.latitude, last.coords.longitude, 17);
      const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      if (alive && now && !userMoved.current) moveTo(now.coords.latitude, now.coords.longitude, 17);
    })();
    return () => {
      alive = false;
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
  }, [moveTo, scheduleLookUp, start.zoom]);

  const onMessage = useCallback(
    (message: MapMessage) => {
      if (message.type === "error") {
        setMapError("offline");
        return;
      }
      if (message.type === "tileerror") {
        setMapError((prev) => prev || "tiles");
        return;
      }
      if (message.type === "movestart") {
        setMoving(true);
        if (!programmatic.current) userMoved.current = true;
        return;
      }
      setMoving(false);
      programmatic.current = false;
      const next = { lat: message.lat, lng: message.lng, zoom: message.zoom };
      centerRef.current = next;
      setCenter(next);
      if (message.type === "ready") {
        ready.current = true;
        const queued = pending.current;
        if (queued) {
          pending.current = null;
          moveTo(queued.lat, queued.lng, queued.zoom);
          return;
        }
      }
      scheduleLookUp(next);
    },
    [moveTo, scheduleLookUp],
  );

  async function search() {
    const text = query.trim();
    if (!text) return;
    const Location = location.current ?? (await loadLocation());
    if (!Location) return;
    setSearching(true);
    try {
      const hits = await Location.geocodeAsync(text);
      if (!hits.length) {
        Alert.alert("Not found", "Try the area, a landmark or the city name.");
        return;
      }
      userMoved.current = true;
      moveTo(hits[0].latitude, hits[0].longitude, 17);
    } catch {
      Alert.alert("Search not available", "Drag the map by hand to the shop.");
    } finally {
      setSearching(false);
    }
  }

  async function locate() {
    const Location = location.current ?? (await loadLocation());
    if (!Location) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Location needed", "Allow location to jump the map to where you are.");
        return;
      }
      location.current = Location;
      const fix = await bestFix(Location, 8000);
      userMoved.current = true;
      moveTo(fix.lat, fix.lng, 18);
    } catch (err) {
      Alert.alert("Could not read GPS", err instanceof Error ? err.message : "Try again near a window.");
    } finally {
      setLocating(false);
    }
  }

  const tooFar = center.zoom < MIN_ZOOM;
  const status =
    mapError === "offline"
      ? "Map needs internet. Close this and use “Use my GPS here” at the shop."
      : tooFar
        ? "Zoom in and drag the map so the pin sits on the shop"
        : moving
          ? "Release to place the pin…"
          : looking
            ? "Finding address…"
            : place?.label || "Pin placed here";

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Close map">
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Pick shop location</Text>
        </View>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="Search area, landmark or city"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {searching ? <ActivityIndicator color={colors.blue} /> : null}
        </View>
      </View>

      <View style={styles.mapWrap}>
        <PickMap ref={map} html={html} onMessage={onMessage} style={styles.map} />
        {mapError === "tiles" ? (
          <View style={styles.banner} pointerEvents="none">
            <Text style={styles.bannerText}>Some map pieces did not load. Check the internet.</Text>
          </View>
        ) : null}
        <Pressable
          onPress={locate}
          style={styles.locate}
          accessibilityRole="button"
          accessibilityLabel="Go to my location"
        >
          {locating ? <ActivityIndicator color={colors.blue} /> : <Ionicons name="locate" size={22} color={colors.blue} />}
        </Pressable>
      </View>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <View style={styles.sheetRow}>
          <View style={styles.sheetIcon}>
            <Ionicons name="location" size={20} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {status}
            </Text>
            {!tooFar && !mapError ? (
              <Text style={typo.muted}>
                {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
              </Text>
            ) : null}
          </View>
        </View>
        <Button
          title="Use this location"
          tone="green"
          icon="checkmark"
          disabled={tooFar || moving || mapError === "offline"}
          onPress={() =>
            onPick({
              lat: round(center.lat),
              lng: round(center.lng),
              address: place?.address,
              city: place?.city,
              label: place?.label,
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10 },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  banner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 64,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  bannerText: { color: "#92400E", fontWeight: "700", fontSize: 12 },
  locate: {
    position: "absolute",
    right: 12,
    bottom: 28,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
    elevation: 6,
  },
  sheet: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
    ...shadow,
    elevation: 12,
  },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  sheetTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
});
