import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { loadVisitPhoto } from "@/lib/api";
import { colors, typo } from "@/lib/theme";

/** Small place-photo preview for manager visit lists. */
export function ProofThumb({
  visitId,
  hasPhoto,
  token,
  version,
}: {
  visitId: number;
  hasPhoto: boolean;
  token: string;
  version?: string | null;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasPhoto);

  useEffect(() => {
    if (!hasPhoto) {
      setUri(null);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    loadVisitPhoto(visitId, token, version, false)
      .then((next) => {
        if (live) setUri(next);
      })
      .catch(() => {
        if (live) setUri(null);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [visitId, hasPhoto, token, version]);

  if (!hasPhoto) {
    return (
      <View style={[styles.box, styles.empty]}>
        <Text style={styles.emptyText}>No photo</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={[styles.box, styles.empty]}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }
  if (!uri) {
    return (
      <View style={[styles.box, styles.empty]}>
        <Text style={styles.emptyText}>Open</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.box} accessibilityLabel="Place proof" />;
}

const styles = StyleSheet.create({
  box: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.line,
  },
  empty: { alignItems: "center", justifyContent: "center", padding: 4 },
  emptyText: { ...typo.muted, fontSize: 10, fontWeight: "700", textAlign: "center" },
});
