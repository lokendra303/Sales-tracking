import { Alert, Linking } from "react-native";

function hasGalleryAccess(result: { granted: boolean; accessPrivileges?: string }) {
  return result.granted || result.accessPrivileges === "limited";
}

/**
 * Ask for Photos & videos access before opening the gallery.
 * Returns true only when the OS grants media library permission.
 */
export async function ensureGalleryAccess(reason = "attach photos from your gallery"): Promise<boolean> {
  const ImagePicker = await import("expo-image-picker");
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (hasGalleryAccess(current)) return true;

  if (current.status === "denied" && current.canAskAgain === false) {
    Alert.alert(
      "Photos & videos access",
      `SalesTrack needs Photos and videos permission to ${reason}. Turn it on in Settings.`,
      [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ],
    );
    return false;
  }

  const next = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (hasGalleryAccess(next)) return true;

  Alert.alert(
    "Permission needed",
    `Allow Photos and videos so SalesTrack can ${reason}.`,
    next.canAskAgain === false
      ? [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ]
      : [{ text: "OK" }],
  );
  return false;
}
