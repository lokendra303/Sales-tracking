import { prisma } from "../src/lib/prisma.js";

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ is_nullable: string }>>(
    `SELECT IS_NULLABLE AS is_nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'beat' AND COLUMN_NAME = 'assigneeId'`,
  );
  if (rows[0]?.is_nullable === "YES") {
    console.log("beat assigneeId already optional");
    return;
  }
  await prisma.$executeRawUnsafe("ALTER TABLE `beat` MODIFY `assigneeId` INT NULL");
  console.log("beat assigneeId is now optional");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not allow unassigned beats");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
