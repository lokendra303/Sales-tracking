import { Platform } from "react-native";

async function secureStore() {
  try {
    return await import("expo-secure-store");
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string) {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    const store = await secureStore();
    await store?.setItemAsync(key, value);
  } catch {
    // Keep the screen open if this phone cannot store the value.
  }
}

export async function getItem(key: string) {
  try {
    if (Platform.OS === "web") return localStorage.getItem(key);
    const store = await secureStore();
    if (!store) return null;
    return await store.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function removeItem(key: string) {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    const store = await secureStore();
    await store?.deleteItemAsync(key);
  } catch {
    // Already gone.
  }
}
