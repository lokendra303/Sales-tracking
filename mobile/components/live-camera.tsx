import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui";
import { colors, typo } from "@/lib/theme";

type CameraModule = typeof import("expo-camera");
type ShotCamera = {
  takePictureAsync: (options: { quality: number }) => Promise<{ uri?: string } | undefined>;
};

export function LiveCamera({
  onCapture,
  onCancel,
}: {
  onCapture: (uri: string) => void;
  onCancel: () => void;
}) {
  const cameraRef = useRef<ShotCamera>(null);
  const { height } = useWindowDimensions();
  const camHeight = Math.min(360, Math.max(180, Math.round(height * 0.34)));
  const [camera, setCamera] = useState<CameraModule | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    import("expo-camera")
      .then(async (mod) => {
        if (cancel) return;
        setCamera(mod);
        const current = await mod.Camera.getCameraPermissionsAsync();
        if (!cancel) setGranted(current.granted);
      })
      .catch(() => {
        if (!cancel) setGranted(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function requestPermission() {
    const mod = camera ?? (await import("expo-camera").catch(() => null));
    if (!mod) {
      setGranted(false);
      return;
    }
    setCamera(mod);
    const next = await mod.Camera.requestCameraPermissionsAsync();
    setGranted(next.granted);
  }

  if (granted == null) {
    return <ActivityIndicator color={colors.blue} style={{ marginVertical: 24 }} />;
  }

  if (!granted || !camera || mountError) {
    return (
      <View style={styles.box}>
        <Ionicons name="camera-outline" size={28} color={colors.blue} />
        <Text style={styles.title}>Live camera only</Text>
        <Text style={typo.muted}>Allow the camera to take the shop photo now. Gallery upload is blocked.</Text>
        <Button title="Allow camera" onPress={() => requestPermission()} />
        <Button title="Cancel" tone="outline" onPress={onCancel} />
      </View>
    );
  }

  if (preview) {
    return (
      <View style={styles.box}>
        <Image source={{ uri: preview }} style={[styles.preview, { height: camHeight }]} />
        <Button title="Use this photo" tone="green" onPress={() => onCapture(preview)} />
        <Button title="Retake" tone="outline" onPress={() => setPreview(null)} />
      </View>
    );
  }

  const CameraView = camera.CameraView;

  return (
    <View style={styles.box}>
      <CameraView
        ref={cameraRef as never}
        style={[styles.cam, { height: camHeight }]}
        facing="back"
        mode="picture"
        mute
        active
        onCameraReady={() => setReady(true)}
        onMountError={() => setMountError(true)}
      />
      <Text style={styles.live}>Live camera · gallery is off</Text>
      <View style={styles.bar}>
        <Button title="Cancel" tone="outline" flex onPress={onCancel} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture photo"
          disabled={busy || !ready}
          onPress={async () => {
            if (busy || !ready) return;
            setBusy(true);
            try {
              const shot = await cameraRef.current?.takePictureAsync({ quality: 0.55 });
              if (shot?.uri) setPreview(shot.uri);
            } catch {
              setMountError(true);
            } finally {
              setBusy(false);
            }
          }}
          style={[styles.shutter, busy && { opacity: 0.5 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <View style={styles.shutterInner} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12 },
  title: { fontWeight: "800", fontSize: 16, color: colors.text },
  cam: { width: "100%", borderRadius: 14, overflow: "hidden", backgroundColor: "#0F172A" },
  preview: { width: "100%", borderRadius: 14, backgroundColor: colors.line },
  live: { ...typo.muted, textAlign: "center", fontWeight: "700" },
  bar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, width: "100%" },
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  shutterInner: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
});
