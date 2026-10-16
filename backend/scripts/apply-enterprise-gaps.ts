import { applyDatabaseEnv } from "../src/config/database.js";
import { PrismaClient } from "@prisma/client";

applyDatabaseEnv();
const prisma = new PrismaClient();

function ignorable(message: string) {
  return /already exists|duplicate column|Duplicate/i.test(message);
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
  await run("ALTER TABLE `beat` ADD COLUMN `territory` VARCHAR(160) NULL", "beat.territory");
  await run("ALTER TABLE `lead` ADD COLUMN `productInterest` VARCHAR(200) NULL", "lead.productInterest");
  await run(
    "ALTER TABLE `lead` MODIFY COLUMN `status` ENUM('NEW','ASSIGNED','CONTACTED','FOLLOW_UP','INTERESTED','NEGOTIATION','WON','LOST') NOT NULL",
    "lead.status enum + INTERESTED/NEGOTIATION",
  );
  console.log("Enterprise gap columns ready.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
