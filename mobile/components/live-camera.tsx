import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui";
import { colors, typo } from "@/lib/theme";

type CameraModule = typeof import("expo-camera");
type ShotCamera = {
  takePictureAsync: (options: { quality: number }) => Promise<{ uri?: string } | undefined>;
};
type Facing = "back" | "front";

export function LiveCamera({
  onCapture,
  onCancel,
}: {
  onCapture: (uri: string) => void;
  onCancel: () => void;
}) {
  const cameraRef = useRef<ShotCamera>(null);
  const { height } = useWindowDimensions();
  const camHeight = Math.min(420, Math.max(240, Math.round(height * 0.46)));
  const [camera, setCamera] = useState<CameraModule | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<Facing>("back");

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

  useEffect(() => {
    if (Platform.OS !== "web" || preview) return;
    const paint = () => {
      const videos = document.querySelectorAll("video");
      videos.forEach((video) => {
        video.muted = true;
        video.setAttribute("playsinline", "true");
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.position = "absolute";
        video.style.left = "0";
        video.style.top = "0";
        video.style.background = "#0F172A";
        video.style.transform = facing === "front" ? "scaleX(-1)" : "";
        const parent = video.parentElement;
        if (parent) {
          parent.style.position = "relative";
          parent.style.width = "100%";
          parent.style.height = `${camHeight}px`;
          parent.style.minHeight = `${camHeight}px`;
          parent.style.overflow = "hidden";
          parent.style.borderRadius = "14px";
          parent.style.background = "#0F172A";
        }
        if (video.srcObject && video.paused) void video.play().catch(() => undefined);
      });
    };
    paint();
    const timer = setInterval(paint, 400);
    return () => clearInterval(timer);
  }, [camHeight, facing, preview]);

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

  function flip() {
    setReady(false);
    setFacing((current) => (current === "back" ? "front" : "back"));
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
      <View style={[styles.stage, { height: camHeight }, Platform.OS === "web" ? styles.stageWeb : null]}>
        <CameraView
          key={facing}
          ref={cameraRef as never}
          style={styles.cam}
          facing={facing}
          mode="picture"
          mute
          active
          onCameraReady={() => setReady(true)}
          onMountError={() => setMountError(true)}
        />
      </View>
      <Text style={styles.live}>
        {facing === "front" ? "Front camera · selfie" : "Rear camera"} · gallery is off
      </Text>
      <View style={styles.bar}>
        <Button title="Cancel" tone="outline" flex onPress={onCancel} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={facing === "back" ? "Switch to front camera" : "Switch to rear camera"}
          onPress={flip}
          style={styles.flip}
        >
          <Ionicons name="camera-reverse" size={26} color={colors.blue} />
        </Pressable>
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
          style={[styles.shutter, (busy || !ready) && { opacity: 0.5 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <View style={styles.shutterInner} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12, width: "100%" },
  title: { fontWeight: "800", fontSize: 16, color: colors.text },
  stage: { width: "100%", borderRadius: 14, backgroundColor: "#0F172A" },
  stageWeb: { overflow: "hidden" },
  cam: { width: "100%", height: "100%", minHeight: 240 },
  preview: { width: "100%", borderRadius: 14, backgroundColor: colors.line },
  live: { ...typo.muted, textAlign: "center", fontWeight: "700" },
  bar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, width: "100%" },
  flip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
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
