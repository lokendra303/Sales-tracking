import { prisma } from "../src/lib/prisma.js";

async function main() {
  const columns = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'beat' AND COLUMN_NAME = 'planDates'`,
  );
  if (columns.length) {
    console.log("SKIP beat.planDates");
    return;
  }
  await prisma.$executeRawUnsafe("ALTER TABLE `beat` ADD COLUMN `planDates` TEXT NULL");
  console.log("OK  beat.planDates");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
