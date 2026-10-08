import type { ApiUser } from "./api";
import { persistGet, persistRemove, persistSet } from "./persist";

export async function readCachedUser() {
  const raw = await persistGet("user");
  return raw ? (JSON.parse(raw) as ApiUser) : null;
}

export async function writeCachedUser(user: ApiUser | null) {
  if (!user) {
    await persistRemove("user");
    return;
  }
  await persistSet("user", JSON.stringify(user));
}
