import { prisma } from "../src/lib/prisma.js";

function ignorable(message: string) {
  return /already exists|duplicate column|Duplicate/i.test(message);
}

async function run(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`OK  ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (ignorable(message)) {
      console.log(`SKIP ${label}`);
      return;
    }
    throw error;
  }
}

async function main() {
  const columns = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string; CHARACTER_MAXIMUM_LENGTH: number | null }>>(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'beat' AND COLUMN_NAME IN ('repeatDays', 'repeatEvery')`,
  );
  const days = columns.find((row) => row.COLUMN_NAME === "repeatDays");
  if (!days) throw new Error("beat.repeatDays is missing");
  if ((days.CHARACTER_MAXIMUM_LENGTH ?? 0) < 160) {
    await run("ALTER TABLE `beat` MODIFY `repeatDays` VARCHAR(160) NULL", "widen beat.repeatDays");
  } else {
    console.log("SKIP widen beat.repeatDays");
  }
  if (!columns.some((row) => row.COLUMN_NAME === "repeatEvery")) {
    await run("ALTER TABLE `beat` ADD COLUMN `repeatEvery` INT NULL", "beat.repeatEvery");
  } else {
    console.log("SKIP beat.repeatEvery");
  }
  console.log("Repeat cycle ready");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
