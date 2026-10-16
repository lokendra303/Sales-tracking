import { applyDatabaseEnv } from "../src/config/database.js";
import { PrismaClient } from "@prisma/client";

applyDatabaseEnv();
const prisma = new PrismaClient();

function ignorable(message: string) {
  return /already exists|duplicate column|duplicate key|Unknown column|check that column|Can't DROP|doesn't exist/i.test(
    message,
  );
}

async function run(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`OK  ${label}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (ignorable(message)) {
      console.log(`SKIP ${label}`);
      return;
    }
    throw err;
  }
}

async function main() {
  await run(
    `CREATE TABLE IF NOT EXISTS \`beatplan\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`tenantId\` INT NOT NULL,
  \`userId\` INT NOT NULL,
  \`cycleLength\` INT NOT NULL DEFAULT 7,
  \`startDate\` DATE NOT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`beatplan_tenantId_userId_key\` (\`tenantId\`, \`userId\`),
  CONSTRAINT \`beatplan_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`beatplan_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    "create beatplan",
  );

  // Rename weekday → dayIndex if old column still exists
  const cols = await prisma.$queryRawUnsafe<{ Field: string }[]>("SHOW COLUMNS FROM `beatschedule`");
  const names = new Set(cols.map((c) => c.Field));
  if (names.has("weekday") && !names.has("dayIndex")) {
    await run(
      "ALTER TABLE `beatschedule` CHANGE COLUMN `weekday` `dayIndex` INT NOT NULL",
      "rename weekday → dayIndex",
    );
    await run("ALTER TABLE `beatschedule` DROP INDEX `beatschedule_tenantId_userId_weekday_key`", "drop old unique");
    await run(
      "ALTER TABLE `beatschedule` ADD UNIQUE INDEX `beatschedule_tenantId_userId_dayIndex_key` (`tenantId`, `userId`, `dayIndex`)",
      "add dayIndex unique",
    );
  } else if (!names.has("dayIndex")) {
    await run("ALTER TABLE `beatschedule` ADD COLUMN `dayIndex` INT NOT NULL DEFAULT 0", "add dayIndex");
    await run(
      "ALTER TABLE `beatschedule` ADD UNIQUE INDEX `beatschedule_tenantId_userId_dayIndex_key` (`tenantId`, `userId`, `dayIndex`)",
      "add dayIndex unique",
    );
  } else {
    console.log("SKIP dayIndex already present");
  }

  console.log("Dynamic beat cycle schema ready.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
