type FileSystem = typeof import("expo-file-system");

function root(fs: FileSystem) {
  return new fs.Directory(fs.Paths.document, "salestrack-offline");
}

function fileFor(fs: FileSystem, key: string) {
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new fs.File(root(fs), `${safe}.json`);
}

async function loadFs() {
  try {
    return await import("expo-file-system");
  } catch {
    return null;
  }
}

export async function persistGet(key: string) {
  try {
    const fs = await loadFs();
    if (!fs) return null;
    const file = fileFor(fs, key);
    if (!file.exists) return null;
    return await file.text();
  } catch {
    return null;
  }
}

export async function persistSet(key: string, value: string) {
  try {
    const fs = await loadFs();
    if (!fs) return;
    const dir = root(fs);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = fileFor(fs, key);
    if (!file.exists) file.create();
    file.write(value);
  } catch {
    // Keep the screen open if this phone cannot store the file.
  }
}

export async function persistRemove(key: string) {
  try {
    const fs = await loadFs();
    if (!fs) return;
    const file = fileFor(fs, key);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
