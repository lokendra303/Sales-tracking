import { applyDatabaseEnv } from "../src/config/database.js";
applyDatabaseEnv();

import { PrismaClient } from "@prisma/client";
import * as beat from "../src/modules/beat/beat.service.js";
import { todayBeat } from "../src/modules/visits/visits.service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("DB:", process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":****@") ?? "(none)");

  // Schema checks
  const scheduleCols = await prisma.$queryRawUnsafe<{ Field: string }[]>("SHOW COLUMNS FROM `beatschedule`");
  console.log(
    "beatschedule cols:",
    scheduleCols.map((c) => c.Field).join(", "),
  );
  const beatCols = await prisma.$queryRawUnsafe<{ Field: string }[]>("SHOW COLUMNS FROM `beat`");
  console.log(
    "beat cols:",
    beatCols.map((c) => c.Field).join(", "),
  );
  const planExists = await prisma.$queryRawUnsafe<{ c: number }[]>(
    "SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'beatplan'",
  );
  console.log("beatplan table:", planExists[0]?.c ? "yes" : "NO");

  const tenants = await prisma.tenant.findMany({ take: 5, select: { id: true, name: true, slug: true } });
  console.log(
    "tenants:",
    tenants.map((t) => `${t.id}:${t.slug}`).join(", ") || "(none)",
  );
// testing this
  const sales = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roles: { some: { role: { code: "SALES_EXECUTIVE" } } },
      NOT: { roles: { some: { role: { code: { in: ["ADMIN", "MANAGER"] } } } } },
    },
    select: { id: true, name: true, tenantId: true },
    take: 10,
  });
  console.log(
    "sales users:",
    sales.map((u) => `${u.tenantId}/${u.id}:${u.name}`).join(", ") || "(none)",
  );

  const managers = await prisma.user.findMany({
    where: { status: "ACTIVE", roles: { some: { role: { code: "MANAGER" } } } },
    select: { id: true, name: true, tenantId: true },
    take: 5,
  });

  for (const u of sales.slice(0, 3)) {
    console.log(`\n--- sales ${u.id} ${u.name} ---`);
    try {
      const sched = await beat.getSchedule(u.tenantId, u.id);
      console.log("getSchedule OK", { cycle: sched.cycleLength, todayIndex: sched.todayIndex });
    } catch (err) {
      console.log("getSchedule FAIL:", err instanceof Error ? err.message : err);
      console.log(err);
    }
    try {
      const ensured = await beat.ensureScheduledDayStops(u.tenantId, u.id);
      console.log("ensureStops OK", { beat: ensured.beat?.name ?? null, stops: ensured.stops.length });
    } catch (err) {
      console.log("ensureStops FAIL:", err instanceof Error ? err.message : err);
      console.log(err);
    }
    try {
      const today = await todayBeat(u.tenantId, u.id, ["SALES_EXECUTIVE"]);
      console.log("todayBeat OK", { beatName: today.beatName, stops: today.stops.length });
    } catch (err) {
      console.log("todayBeat FAIL:", err instanceof Error ? err.message : err);
      console.log(err);
    }
  }

  for (const m of managers.slice(0, 2)) {
    console.log(`\n--- manager ${m.id} ${m.name} ---`);
    try {
      const list = await beat.listBeats(m.tenantId);
      console.log("listBeats OK", list.length);
    } catch (err) {
      console.log("listBeats FAIL:", err instanceof Error ? err.message : err);
      console.log(err);
    }
    try {
      const cov = await beat.teamCoverageToday(m.tenantId);
      console.log("coverage OK", cov.people.length);
    } catch (err) {
      console.log("coverage FAIL:", err instanceof Error ? err.message : err);
      console.log(err);
    }
  }
}

main()
  .catch((err) => {
    console.error("FATAL", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
