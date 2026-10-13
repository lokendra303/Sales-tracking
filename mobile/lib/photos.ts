import { Platform } from "react-native";

type FileSystem = typeof import("expo-file-system");

async function loadFs() {
  try {
    return await import("expo-file-system");
  } catch {
    return null;
  }
}

export async function keepPhoto(uri: string, name: string) {
  if (Platform.OS === "web" || uri.startsWith("blob:") || uri.startsWith("data:")) return uri;
  try {
    const fs = await loadFs();
    if (!fs) return uri;
    const dir = new fs.Directory(fs.Paths.document, "salestrack-offline", "photos");
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new fs.File(dir, name.endsWith(".jpg") ? name : `${name}.jpg`);
    await new fs.File(uri).copy(dest, { overwrite: true });
    return dest.uri;
  } catch {
    return uri;
  }
}

export async function dropPhoto(uri?: string) {
  if (!uri || uri.startsWith("blob:") || uri.startsWith("data:")) return;
  if (!uri.includes("salestrack-offline")) return;
  try {
    const fs = await loadFs();
    if (!fs) return;
    const file = new fs.File(uri);
    if (file.exists) file.delete();
  } catch {
    // The upload already succeeded.
  }
}
