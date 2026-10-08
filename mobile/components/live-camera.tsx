import { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui";
import { colors, typo } from "@/lib/theme";

export function LiveCamera({
  onCapture,
  onCancel,
}: {
  onCapture: (uri: string) => void;
  onCancel: () => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return <ActivityIndicator color={colors.blue} style={{ marginVertical: 24 }} />;
  }

  if (!permission.granted) {
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
        <Image source={{ uri: preview }} style={styles.preview} />
        <Button title="Use this photo" tone="green" onPress={() => onCapture(preview)} />
        <Button title="Retake" tone="outline" onPress={() => setPreview(null)} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <CameraView ref={cameraRef} style={styles.cam} facing="back" mode="picture" />
      <Text style={styles.live}>Live camera · gallery is off</Text>
      <View style={styles.bar}>
        <Button title="Cancel" tone="outline" flex onPress={onCancel} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture photo"
          disabled={busy}
          onPress={async () => {
            if (busy) return;
            setBusy(true);
            try {
              const shot = await cameraRef.current?.takePictureAsync({ quality: 0.55 });
              if (shot?.uri) setPreview(shot.uri);
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
  cam: { width: "100%", height: 280, borderRadius: 14, overflow: "hidden", backgroundColor: "#0F172A" },
  preview: { width: "100%", height: 280, borderRadius: 14, backgroundColor: colors.line },
  live: { ...typo.muted, textAlign: "center", fontWeight: "700" },
  bar: { flexDirection: "row", alignItems: "center", gap: 12 },
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
