import { prisma } from "../src/lib/prisma.js";

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead' AND COLUMN_NAME = 'mapsLink'`,
  );
  if (Number(rows[0]?.n ?? 0) === 0) {
    await prisma.$executeRawUnsafe("ALTER TABLE `lead` ADD COLUMN `mapsLink` TEXT NULL");
  }

  await prisma.$executeRawUnsafe(`
    UPDATE \`lead\`
    SET mapsLink = address, address = NULL
    WHERE mapsLink IS NULL
      AND address IS NOT NULL
      AND (
        address LIKE '%maps.app.goo.gl%'
        OR address LIKE '%goo.gl/maps%'
        OR address LIKE '%google.com/maps%'
        OR address LIKE '%maps.google.%'
        OR address LIKE 'geo:%'
        OR address LIKE '%maps.apple.com%'
      )
  `);
  console.log("lead mapsLink ready");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not add lead maps link");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
