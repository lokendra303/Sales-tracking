import "./../src/config/timezone.js";
import { applyDatabaseEnv } from "../src/config/database.js";
applyDatabaseEnv();

import { PrismaClient } from "@prisma/client";
import { isoDay, cycleDayIndex } from "../src/modules/beat/beat.helpers.js";
import { ensureScheduledDayStops, getSchedule } from "../src/modules/beat/beat.service.js";

const prisma = new PrismaClient();

async function main() {
  const userId = 3;
  const tenantId = 1;
  const plan = await prisma.beatPlan.findFirst({ where: { userId } });
  const slots = await prisma.beatSchedule.findMany({
    where: { userId },
    include: { beat: true },
  });
  console.log("now", new Date().toString(), "iso", isoDay());
  console.log("TZ", process.env.TZ);
  console.log("plan", plan);
  if (plan) {
    const startIso = isoDay(plan.startDate);
    console.log("startIso", startIso, "raw", plan.startDate.toISOString());
    console.log("dayIndex", cycleDayIndex(startIso, plan.cycleLength, isoDay()));
  }
  console.log(
    "slots",
    slots.map((s) => ({ dayIndex: s.dayIndex, beatId: s.beatId, active: s.beat.active, name: s.beat.name })),
  );
  const sched = await getSchedule(tenantId, userId);
  console.log("getSchedule", { todayIndex: sched.todayIndex, startDate: sched.startDate, days: sched.days });
  const ensured = await ensureScheduledDayStops(tenantId, userId);
  console.log("ensured", ensured.beat, "stops", ensured.stops.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
