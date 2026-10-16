import { applyDatabaseEnv } from "../src/config/database.js";
import { PrismaClient } from "@prisma/client";

applyDatabaseEnv();

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS \`beat\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`tenantId\` INT NOT NULL,
  \`name\` VARCHAR(120) NOT NULL,
  \`assigneeId\` INT NOT NULL,
  \`active\` BOOLEAN NOT NULL DEFAULT true,
  \`notes\` TEXT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  INDEX \`beat_tenantId_assigneeId_active_idx\` (\`tenantId\`, \`assigneeId\`, \`active\`),
  CONSTRAINT \`beat_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`beat_assigneeId_fkey\` FOREIGN KEY (\`assigneeId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`beatmember\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`beatId\` INT NOT NULL,
  \`leadId\` INT NULL,
  \`customerId\` INT NULL,
  \`sequence\` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (\`id\`),
  INDEX \`beatmember_beatId_sequence_idx\` (\`beatId\`, \`sequence\`),
  CONSTRAINT \`beatmember_beatId_fkey\` FOREIGN KEY (\`beatId\`) REFERENCES \`beat\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`beatmember_leadId_fkey\` FOREIGN KEY (\`leadId\`) REFERENCES \`lead\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`beatmember_customerId_fkey\` FOREIGN KEY (\`customerId\`) REFERENCES \`customer\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`beatschedule\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`tenantId\` INT NOT NULL,
  \`userId\` INT NOT NULL,
  \`weekday\` INT NOT NULL,
  \`beatId\` INT NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`beatschedule_tenantId_userId_weekday_key\` (\`tenantId\`, \`userId\`, \`weekday\`),
  INDEX \`beatschedule_tenantId_userId_idx\` (\`tenantId\`, \`userId\`),
  CONSTRAINT \`beatschedule_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`beatschedule_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`beatschedule_beatId_fkey\` FOREIGN KEY (\`beatId\`) REFERENCES \`beat\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
];

const optional = [
  `ALTER TABLE \`beatstop\` ADD COLUMN \`beatId\` INT NULL`,
  `ALTER TABLE \`beatstop\` ADD INDEX \`beatstop_beatId_plannedAt_idx\` (\`beatId\`, \`plannedAt\`)`,
  `ALTER TABLE \`beatstop\` ADD CONSTRAINT \`beatstop_beatId_fkey\` FOREIGN KEY (\`beatId\`) REFERENCES \`beat\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
];

function ignorable(message: string) {
  return /already exists|duplicate column|duplicate key name|Duplicate/i.test(message);
}

async function run(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`OK  ${label}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (ignorable(message)) {
      console.log(`SKIP ${label} (already applied)`);
      return;
    }
    throw err;
  }
}

async function main() {
  for (const sql of statements) {
    const label = sql.slice(0, 60).replace(/\s+/g, " ");
    await run(sql, label);
  }
  for (const sql of optional) {
    const label = sql.slice(0, 80).replace(/\s+/g, " ");
    await run(sql, label);
  }
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('beat','beatmember','beatschedule') ORDER BY TABLE_NAME",
  );
  console.log("Tables present:", tables.map((t) => t.name).join(", ") || "(none)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
