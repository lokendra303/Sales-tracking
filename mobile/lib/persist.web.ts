export async function persistGet(key: string) {
  return localStorage.getItem(`st:${key}`);
}

export async function persistSet(key: string, value: string) {
  localStorage.setItem(`st:${key}`, value);
}

export async function persistRemove(key: string) {
  localStorage.removeItem(`st:${key}`);
}
