export const FIELD_LOCATION_TASK = "salestrack-field-location";

type Loc = { coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null; heading: number | null } };

try {
  // Loaded only when this file is imported. A phone without the native task
  // module should still open the app.
  const TaskManager = require("expo-task-manager") as typeof import("expo-task-manager");
  const { appendGpsPoints } = require("./gps-queue") as typeof import("./gps-queue");
  TaskManager.defineTask(FIELD_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Loc[] }).locations ?? [];
    if (!locations.length) return;
    const capturedAt = new Date().toISOString();
    await appendGpsPoints(
      locations.map((item) => ({
        lat: item.coords.latitude,
        lng: item.coords.longitude,
        accuracy: item.coords.accuracy ?? undefined,
        speed: item.coords.speed ?? undefined,
        heading: item.coords.heading ?? undefined,
        capturedAt,
      })),
    );
  });
} catch {
  // Task manager is unavailable. Field work still runs as a clock.
}
