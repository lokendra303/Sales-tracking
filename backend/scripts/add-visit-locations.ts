import { prisma } from "../src/lib/prisma.js";

const columns: [string, string][] = [
  ["checkinDistanceMeters", "INT NULL"],
  ["checkoutLat", "DECIMAL(10,7) NULL"],
  ["checkoutLng", "DECIMAL(10,7) NULL"],
  ["checkoutAccuracy", "DECIMAL(8,2) NULL"],
];

async function main() {
  for (const [name, type] of columns) {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visit' AND COLUMN_NAME = ?`,
      name,
    );
    if (Number(rows[0]?.n ?? 0) === 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`visit\` ADD COLUMN \`${name}\` ${type}`);
    }
  }
  await prisma.$executeRawUnsafe(
    "UPDATE `visit` SET `checkinDistanceMeters` = `distanceMeters` WHERE `status` = 'IN_PROGRESS' AND `checkinDistanceMeters` IS NULL",
  );
  console.log("visit check-in / finish location columns ready");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not add visit location columns");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
