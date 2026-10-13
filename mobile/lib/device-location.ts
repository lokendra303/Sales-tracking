type LocationModule = typeof import("expo-location");

export type Fix = { lat: number; lng: number; accuracy?: number };

export function loadLocation(): Promise<LocationModule | null> {
  return import("expo-location").catch(() => null);
}

const goodAccuracy = 30;

export async function bestFix(Location: LocationModule, waitMs = 12000): Promise<Fix> {
  let best: Fix | null = null;
  const take = (position: { coords: { latitude: number; longitude: number; accuracy: number | null } }) => {
    const next = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
    };
    if (!best || (next.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) best = next;
  };

  try {
    take(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }));
  } catch {
    // Keep watching below.
  }
  const current = best as Fix | null;
  if (current && (current.accuracy ?? Infinity) <= goodAccuracy) return current;

  let sub: { remove: () => void } | null = null;
  let closed = false;
  try {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, waitMs);
      Location.watchPositionAsync({ accuracy: Location.Accuracy.Highest, timeInterval: 1000, distanceInterval: 0 }, (position) => {
        try {
          take(position);
          if ((best?.accuracy ?? Infinity) <= goodAccuracy) {
            clearTimeout(timer);
            resolve();
          }
        } catch {
          // Ignore one bad reading.
        }
      })
        .then((watch) => {
          if (closed) watch.remove();
          else sub = watch;
        })
        .catch(() => {
          clearTimeout(timer);
          resolve();
        });
    });
  } finally {
    closed = true;
    try {
      (sub as { remove: () => void } | null)?.remove();
    } catch {
      // Watch already stopped.
    }
  }

  if (!best) throw new Error("Could not read GPS. Step outside or near a window and try again.");
  return best;
}
