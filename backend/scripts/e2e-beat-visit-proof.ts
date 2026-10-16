/**
 * End-to-end: manager beat desk + sales visit proof.
 * Usage: npx tsx scripts/e2e-beat-visit-proof.ts [baseUrl]
 * Default baseUrl: http://127.0.0.1:3000
 */
import fs from "node:fs";
import path from "node:path";
import { applyDatabaseEnv } from "../src/config/database.js";

applyDatabaseEnv();

const BASE = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const SEED_PASSWORD = process.env.SEED_PASSWORD || "";
if (!SEED_PASSWORD) {
  console.error("SEED_PASSWORD missing from backend/.env");
  process.exit(1);
}

type Envelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

async function req<T>(
  method: string,
  p: string,
  opts: { token?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${p}`, { method, headers, body });
  const text = await res.text();
  let json: Envelope<T>;
  try {
    json = JSON.parse(text) as Envelope<T>;
  } catch {
    throw new Error(`${method} ${p} → HTTP ${res.status} non-JSON: ${text.slice(0, 200)}`);
  }
  if (!json.success) {
    throw new Error(`${method} ${p} → ${json.error.code}: ${json.error.message}`);
  }
  return json.data;
}

async function blobOk(token: string, p: string) {
  const res = await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${p} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 20) throw new Error(`GET ${p} → empty/tiny body (${buf.length}b)`);
  return buf.length;
}

function step(label: string) {
  console.log(`\n== ${label}`);
}

async function main() {
  console.log("BASE", BASE);

  step("health");
  const health = await req<{ ok: boolean }>("GET", "/health");
  console.log("OK", health);

  step("manager login");
  const mgr = await req<{ accessToken: string; user: { id: number; tenant: { id: number }; roles: string[] } }>(
    "POST",
    "/auth/login",
    { body: { phone: "7777777777", password: SEED_PASSWORD } },
  );
  console.log("manager", mgr.user.id, mgr.user.roles);

  step("sales login");
  const sales = await req<{ accessToken: string; user: { id: number; tenant: { id: number }; roles: string[] } }>(
    "POST",
    "/auth/login",
    { body: { phone: "8888888888", password: SEED_PASSWORD } },
  );
  console.log("sales", sales.user.id, sales.user.roles);

  if (mgr.user.tenant.id !== sales.user.tenant.id) {
    throw new Error("Manager and sales tenants differ — seed users not in same company.");
  }

  step("GET /beat (manager overview)");
  const overview = await req<{ date: string; people: { userId: number; name: string }[] }>("GET", "/beat", {
    token: mgr.accessToken,
  });
  console.log("people", overview.people.length, overview.people.map((p) => p.name).join(", "));

  step("GET /beats");
  let beats = await req<{ id: number; name: string; size: number; territory?: string | null }[]>("GET", "/beats", {
    token: mgr.accessToken,
  });
  console.log("beats before", beats.length);

  step("POST /beats create");
  const beatName = `E2E North ${Date.now().toString().slice(-6)}`;
  const beat = await req<{ id: number; name: string; territory: string | null; size: number }>("POST", "/beats", {
    token: mgr.accessToken,
    body: { name: beatName, assigneeId: sales.user.id, territory: "Sector 12 test area" },
  });
  console.log("created", beat.id, beat.name, beat.territory);

  step("GET /leads for member");
  const leadPack = await req<{
    leads: { id: number; name: string; approvalStatus: string; status: string; latitude?: number | null; longitude?: number | null }[];
  }>("GET", "/leads?filter=all", { token: mgr.accessToken });
  const candidates = leadPack.leads.filter(
    (l) => l.approvalStatus === "APPROVED" && l.status !== "LOST" && l.status !== "WON",
  );
  if (!candidates.length) throw new Error("No approved open leads to put on beat.");
  // Prefer a lead with coordinates for visit distance checks
  const withPin = candidates.find((l) => l.latitude != null && l.longitude != null) ?? candidates[0];
  console.log("member lead", withPin.id, withPin.name, "pin", withPin.latitude, withPin.longitude);

  step("POST /beats/:id/members");
  const member = await req<{ id: number; size: number }>("POST", `/beats/${beat.id}/members`, {
    token: mgr.accessToken,
    body: { leadId: withPin.id },
  });
  console.log("member added, size", (member as { size?: number }).size ?? member);

  // reload beat
  beats = await req<{ id: number; name: string; size: number; members: { id: number; leadId: number | null }[] }[]>(
    "GET",
    "/beats",
    { token: mgr.accessToken },
  );
  const fresh = beats.find((b) => b.id === beat.id);
  if (!fresh || fresh.size < 1) throw new Error("Beat has no members after add.");
  console.log("beat size", fresh.size);

  step("GET /beat/schedule");
  const sched = await req<{
    cycleLength: number;
    startDate: string;
    todayIndex: number | null;
    days: Record<string, { beatId: number; beatName: string } | null>;
  }>("GET", `/beat/schedule?userId=${sales.user.id}`, { token: mgr.accessToken });
  console.log("cycle", sched.cycleLength, "todayIndex", sched.todayIndex, "start", sched.startDate);

  // Anchor cycle on today so dayIndex 0 is always "today" for this test (avoids stale TZ-shifted plans).
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  step(`PUT /beat/schedule start=${todayIso} assign beat to day 0`);
  const daysPayload: Record<string, number | null> = {};
  for (let i = 0; i < sched.cycleLength; i++) daysPayload[String(i)] = null;
  daysPayload["0"] = beat.id;
  const saved = await req<{
    todayIndex: number | null;
    startDate: string;
    days: typeof sched.days;
  }>("PUT", "/beat/schedule", {
    token: mgr.accessToken,
    body: {
      userId: sales.user.id,
      cycleLength: sched.cycleLength,
      startDate: todayIso,
      days: daysPayload,
    },
  });
  console.log("saved", { startDate: saved.startDate, todayIndex: saved.todayIndex, day0: saved.days?.["0"] });
  if (saved.todayIndex !== 0) throw new Error(`Expected todayIndex 0 after anchoring start to today, got ${saved.todayIndex}`);
  if (!saved.days?.["0"]?.beatId) throw new Error("Day 0 beat missing after save.");

  step("GET /beat/coverage/today");
  const cov = await req<{ people: { name: string; beatName: string | null; planned: number; missed: number }[] }>(
    "GET",
    "/beat/coverage/today",
    { token: mgr.accessToken },
  );
  const row = cov.people.find((p) => p.name.includes("Rahul") || true);
  console.log(
    "coverage sample",
    cov.people.map((p) => `${p.name}:${p.beatName ?? "-"}/${p.planned}p/${p.missed}m`).join(" | "),
  );
  void row;

  step("GET /beat/today (sales)");
  const today = await req<{
    beatId: number | null;
    beatName: string | null;
    territory: string | null;
    beatSize: number;
    visitedOnBeat: number;
    missedOnBeat: number;
    stops: { id: number | null; leadId: number | null; name: string; placeLat: number | null; placeLng: number | null }[];
  }>("GET", "/beat/today", { token: sales.accessToken });
  console.log("today beat", today.beatName, "territory", today.territory, "stops", today.stops.length, "missed", today.missedOnBeat);
  if (!today.beatId) throw new Error("Sales today beat is empty after schedule assign — materialization failed.");
  if (!today.stops.length) throw new Error("Sales today beat has no stops.");

  const stop = today.stops.find((s) => s.leadId === withPin.id) ?? today.stops[0];
  const lat = stop.placeLat ?? 28.6139;
  const lng = stop.placeLng ?? 77.209;

  step("POST /visits/check-in");
  const visit = await req<{ id: number; status: string; hasPhoto: boolean }>("POST", "/visits/check-in", {
    token: sales.accessToken,
    body: {
      leadId: stop.leadId,
      beatStopId: stop.id,
      lat,
      lng,
      accuracy: 12,
    },
  });
  console.log("visit", visit.id, visit.status);

  step("POST /visits/:id/photo (proof)");
  const jpg = path.join(process.cwd(), "scripts", "_e2e-proof.jpg");
  // Minimal valid JPEG
  const jpegBytes = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQDxAQDw8QDw8PDw8PDw8QFRUWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGmAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z",
    "base64",
  );
  fs.writeFileSync(jpg, jpegBytes);
  const form = new FormData();
  form.append("photo", new Blob([jpegBytes], { type: "image/jpeg" }), "proof.jpg");
  form.append("lat", String(lat));
  form.append("lng", String(lng));
  form.append("accuracy", "12");
  const withPhoto = await req<{ id: number; hasPhoto: boolean }>("POST", `/visits/${visit.id}/photo`, {
    token: sales.accessToken,
    form,
  });
  console.log("hasPhoto", withPhoto.hasPhoto);
  if (!withPhoto.hasPhoto) throw new Error("Photo upload did not set hasPhoto.");

  step("GET /visits/:id/photo bytes");
  const photoBytes = await blobOk(sales.accessToken, `/visits/${visit.id}/photo`);
  console.log("photo bytes", photoBytes);

  step("POST /visits/:id/complete");
  const done = await req<{ id: number; status: string; outcome: string | null }>("POST", `/visits/${visit.id}/complete`, {
    token: sales.accessToken,
    body: { outcome: "SUCCESS", lat, lng, accuracy: 12, notes: "E2E proof" },
  });
  console.log("completed", done.status, done.outcome);

  step("manager GET /visits + proof");
  const list = await req<{ id: number; hasPhoto: boolean; status: string }[]>("GET", `/visits?days=7&userId=${sales.user.id}`, {
    token: mgr.accessToken,
  });
  const found = list.find((v) => v.id === visit.id);
  if (!found) throw new Error("Manager cannot see sales visit in list.");
  console.log("manager sees visit", found.id, "hasPhoto", found.hasPhoto);

  const detail = await req<{ id: number; hasPhoto: boolean }>("GET", `/visits/${visit.id}`, { token: mgr.accessToken });
  console.log("manager detail hasPhoto", detail.hasPhoto);
  const mgrPhoto = await blobOk(mgr.accessToken, `/visits/${visit.id}/photo`);
  console.log("manager photo bytes", mgrPhoto);

  step("sales today after visit");
  const today2 = await req<{ visitedOnBeat: number; missedOnBeat: number; beatSize: number }>("GET", "/beat/today", {
    token: sales.accessToken,
  });
  console.log("visited", today2.visitedOnBeat, "missed", today2.missedOnBeat, "size", today2.beatSize);

  try {
    fs.unlinkSync(jpg);
  } catch {
    /* ignore */
  }

  console.log("\nE2E PASSED");
}

main().catch((err) => {
  console.error("\nE2E FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
