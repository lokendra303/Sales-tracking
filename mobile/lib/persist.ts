import { File, Directory, Paths } from "expo-file-system";

function root() {
  return new Directory(Paths.document, "salestrack-offline");
}

function fileFor(key: string) {
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new File(root(), `${safe}.json`);
}

export async function persistGet(key: string) {
  try {
    const file = fileFor(key);
    if (!file.exists) return null;
    return await file.text();
  } catch {
    return null;
  }
}

export async function persistSet(key: string, value: string) {
  const dir = root();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = fileFor(key);
  if (!file.exists) file.create();
  file.write(value);
}

export async function persistRemove(key: string) {
  try {
    const file = fileFor(key);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
