import { applyDatabaseEnv } from "../src/config/database.js";
import { PrismaClient } from "@prisma/client";

applyDatabaseEnv();
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ t: string }[]>(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('beat','beatmember','beatschedule','beatplan') ORDER BY t",
  );
  console.log("tables:", tables.map((r) => r.t).join(", ") || "(none)");

  for (const table of ["beat", "beatschedule", "beatstop", "lead"]) {
    try {
      const cols = await prisma.$queryRawUnsafe<{ Field: string; Type: string }[]>(`SHOW COLUMNS FROM \`${table}\``);
      console.log(`${table}:`, cols.map((c) => c.Field).join(", "));
    } catch (err) {
      console.log(`${table}: ERROR`, err instanceof Error ? err.message : err);
    }
  }

  try {
    const beats = await prisma.beat.findMany({ take: 1 });
    console.log("prisma.beat.findMany OK", beats.length);
  } catch (err) {
    console.log("prisma.beat.findMany FAIL", err instanceof Error ? err.message : err);
  }

  try {
    const plans = await prisma.beatPlan.findMany({ take: 1 });
    console.log("prisma.beatPlan.findMany OK", plans.length);
  } catch (err) {
    console.log("prisma.beatPlan.findMany FAIL", err instanceof Error ? err.message : err);
  }

  try {
    const leads = await prisma.lead.findMany({ take: 1, select: { id: true, status: true, productInterest: true } });
    console.log("prisma.lead select OK", leads[0] ?? null);
  } catch (err) {
    console.log("prisma.lead select FAIL", err instanceof Error ? err.message : err);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
