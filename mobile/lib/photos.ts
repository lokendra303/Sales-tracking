import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

export async function keepPhoto(uri: string, name: string) {
  if (Platform.OS === "web" || uri.startsWith("blob:") || uri.startsWith("data:")) return uri;
  try {
    const dir = new Directory(Paths.document, "salestrack-offline", "photos");
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, name.endsWith(".jpg") ? name : `${name}.jpg`);
    await new File(uri).copy(dest, { overwrite: true });
    return dest.uri;
  } catch {
    return uri;
  }
}

export function dropPhoto(uri?: string) {
  if (!uri || uri.startsWith("blob:") || uri.startsWith("data:")) return;
  if (!uri.includes("salestrack-offline")) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The upload already succeeded.
  }
}
