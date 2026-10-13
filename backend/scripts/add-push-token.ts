import { prisma } from "../src/lib/prisma.js";

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device' AND COLUMN_NAME = 'pushToken'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  if (count === 0) {
    await prisma.$executeRawUnsafe("ALTER TABLE `device` ADD COLUMN `pushToken` VARCHAR(191) NULL");
  }
  console.log("device.pushToken ready");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not add pushToken");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
