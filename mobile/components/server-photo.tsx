import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text } from "react-native";
import { colors, typo } from "@/lib/theme";

type Props = {
  /** Changes when the server has a new photo, so the old download is not reused. */
  photoKey: string;
  load: (fresh: boolean) => Promise<string | null>;
  label: string;
};

export function ServerPhoto({ photoKey, load, label }: Props) {
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState<{ key: string; uri: string | null } | null>(null);
  const key = `${photoKey}#${tries}`;
  const uri = result?.key === key ? result.uri : null;
  const loading = result?.key !== key;

  useEffect(() => {
    let live = true;
    load(tries > 0)
      .catch(() => null)
      .then((next) => {
        if (live) setResult({ key, uri: next });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.photo}
        resizeMode="cover"
        accessibilityLabel={label}
        onError={() => setResult({ key, uri: null })}
      />
    );
  }
  return (
    <Pressable style={[styles.photo, styles.empty]} onPress={() => setTries((n) => n + 1)} disabled={loading}>
      {loading ? (
        <ActivityIndicator color={colors.blue} />
      ) : (
        <Text style={typo.muted}>Could not load the {label.toLowerCase()}. Tap to try again.</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: { width: "100%", height: 220, borderRadius: 14, backgroundColor: colors.line },
  empty: { alignItems: "center", justifyContent: "center", padding: 16 },
});
