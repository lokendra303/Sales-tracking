type LocationModule = typeof import("expo-location");

export function loadLocation(): Promise<LocationModule | null> {
  return import("expo-location").catch(() => null);
}
