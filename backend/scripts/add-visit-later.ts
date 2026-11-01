import { prisma } from "../src/lib/prisma.js";

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ columnType: string }>>(
    `SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visit' AND COLUMN_NAME = 'outcome'`,
  );
  const columnType = rows[0]?.columnType ?? "";
  if (!columnType.includes("LATER")) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `visit` MODIFY COLUMN `outcome` ENUM('SUCCESS', 'UNAVAILABLE', 'LATER') NULL",
    );
  }
  console.log("visit outcome LATER ready");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not add later outcome");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
