import { bestFix, loadLocation } from "./device-location";
import { FINISH_RADIUS_METERS, haversineMeters } from "./geo";

export async function finishReading() {
  const Location = await loadLocation();
  if (!Location) {
    throw new Error("Turn on location to finish the visit.");
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Turn on location to finish the visit. You need to be within 300 m of the shop.");
  }
  return bestFix(Location);
}

export function assertNearShop(
  point: { lat: number; lng: number; accuracy?: number },
  place: { lat: number | null; lng: number | null },
) {
  if (place.lat == null || place.lng == null) {
    throw new Error("This shop has no map pin. Ask your manager to correct the location, then finish the visit.");
  }
  const distanceMeters = haversineMeters(point, { lat: place.lat, lng: place.lng });
  const slack = Math.min(point.accuracy ?? 0, 100);
  if (distanceMeters - slack > FINISH_RADIUS_METERS) {
    throw new Error(`You are ${distanceMeters} m from the shop. Finish the visit within 300 m of the pin.`);
  }
  return distanceMeters;
}
