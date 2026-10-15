import { prisma } from "../src/lib/prisma.js";

async function main() {
  const tables = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visitdemophoto'`,
  );
  if (Number(tables[0]?.n ?? 0) === 0) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE \`visitdemophoto\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`tenantId\` INT NOT NULL,
        \`visitId\` INT NOT NULL,
        \`path\` VARCHAR(191) NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX \`visitdemophoto_visitId_idx\` (\`visitId\`),
        INDEX \`visitdemophoto_tenantId_visitId_idx\` (\`tenantId\`, \`visitId\`),
        CONSTRAINT \`visitdemophoto_visitId_fkey\` FOREIGN KEY (\`visitId\`) REFERENCES \`visit\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
  }
  console.log("visit demo photos table ready");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not add visit demo photos");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
