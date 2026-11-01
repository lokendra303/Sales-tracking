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
  await run(
    `CREATE TABLE IF NOT EXISTS \`hq\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`tenantId\` INTEGER NOT NULL,
      \`name\` VARCHAR(160) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`hq_tenantId_name_key\`(\`tenantId\`, \`name\`),
      INDEX \`hq_tenantId_idx\`(\`tenantId\`),
      CONSTRAINT \`hq_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    "hq table",
  );

  const columns = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'beat' AND COLUMN_NAME IN ('hqId', 'repeatDays')`,
  );
  const have = new Set(columns.map((row) => row.COLUMN_NAME));
  if (!have.has("hqId")) await run("ALTER TABLE `beat` ADD COLUMN `hqId` INT NULL", "beat.hqId");
  else console.log("SKIP beat.hqId");
  if (!have.has("repeatDays")) await run("ALTER TABLE `beat` ADD COLUMN `repeatDays` VARCHAR(20) NULL", "beat.repeatDays");
  else console.log("SKIP beat.repeatDays");

  await run("CREATE INDEX `beat_hqId_idx` ON `beat`(`hqId`)", "beat.hqId index");
  await run(
    "ALTER TABLE `beat` ADD CONSTRAINT `beat_hqId_fkey` FOREIGN KEY (`hqId`) REFERENCES `hq`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
    "beat.hqId foreign key",
  );

  await run(
    `INSERT INTO \`hq\` (\`tenantId\`, \`name\`, \`createdAt\`, \`updatedAt\`)
     SELECT src.tenantId, src.name, NOW(3), NOW(3)
     FROM (
       SELECT tenantId, TRIM(territory) AS name
       FROM beat
       WHERE territory IS NOT NULL AND TRIM(territory) <> ''
       GROUP BY tenantId, TRIM(territory)
     ) src
     WHERE NOT EXISTS (
       SELECT 1 FROM hq h WHERE h.tenantId = src.tenantId AND h.name = src.name
     )`,
    "backfill hq names",
  );
  await run(
    `UPDATE beat b
     INNER JOIN hq h ON h.tenantId = b.tenantId AND h.name = TRIM(b.territory)
     SET b.hqId = h.id
     WHERE b.territory IS NOT NULL AND TRIM(b.territory) <> '' AND b.hqId IS NULL`,
    "link beats to hq",
  );
  console.log("HQ table ready");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not add HQ");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
