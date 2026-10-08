import * as TaskManager from "expo-task-manager";
import { getItem, setItem } from "./storage";

export const FIELD_LOCATION_TASK = "salestrack-field-location";

type Loc = { coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null; heading: number | null } };

TaskManager.defineTask(FIELD_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const locations = (data as { locations?: Loc[] }).locations ?? [];
  const raw = await getItem("fieldQueue");
  const queue = raw ? (JSON.parse(raw) as object[]) : [];
  for (const item of locations) {
    queue.push({
      lat: item.coords.latitude,
      lng: item.coords.longitude,
      accuracy: item.coords.accuracy ?? undefined,
      speed: item.coords.speed ?? undefined,
      heading: item.coords.heading ?? undefined,
      capturedAt: new Date().toISOString(),
    });
  }
  await setItem("fieldQueue", JSON.stringify(queue.slice(-200)));
});
