import { getItem, removeItem } from "./storage";
import { persistGet, persistSet } from "./persist";

export type GpsPoint = {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  mocked?: boolean;
  capturedAt: string;
};

let writeChain: Promise<unknown> = Promise.resolve();

async function readFile() {
  const raw = await persistGet("fieldQueue");
  const points: GpsPoint[] = raw ? (JSON.parse(raw) as GpsPoint[]) : [];
  try {
    const legacy = await getItem("fieldQueue");
    if (!legacy) return points;
    const extra = JSON.parse(legacy) as GpsPoint[];
    await removeItem("fieldQueue");
    return [...points, ...extra].slice(-200);
  } catch {
    return points;
  }
}

export function readGpsQueue() {
  let points: GpsPoint[] = [];
  writeChain = writeChain.then(async () => {
    points = await readFile();
  });
  return writeChain.then(() => points);
}

export function appendGpsPoints(points: GpsPoint[]) {
  writeChain = writeChain.then(async () => {
    const current = await readFile();
    await persistSet("fieldQueue", JSON.stringify([...current, ...points].slice(-200)));
  });
  return writeChain;
}

export function trimGpsQueue(sent: number) {
  writeChain = writeChain.then(async () => {
    const current = await readFile();
    await persistSet("fieldQueue", JSON.stringify(current.slice(Math.max(0, sent))));
  });
  return writeChain;
}

export function clearGpsQueue() {
  writeChain = writeChain.then(() => persistSet("fieldQueue", "[]"));
  return writeChain;
}
