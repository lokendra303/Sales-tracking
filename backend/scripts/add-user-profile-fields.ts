import { prisma } from "../src/lib/prisma.js";

const columns: [string, string][] = [
  ["employeeId", "VARCHAR(40) NULL"],
  ["designation", "VARCHAR(80) NULL"],
  ["city", "VARCHAR(80) NULL"],
  ["address", "TEXT NULL"],
  ["joiningDate", "DATETIME NULL"],
];

async function main() {
  for (const [name, type] of columns) {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = ?`,
      name,
    );
    if (Number(rows[0]?.n ?? 0) === 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`user\` ADD COLUMN \`${name}\` ${type}`);
    }
  }

  const idx = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND INDEX_NAME = 'user_tenantId_employeeId_key'`,
  );
  if (Number(idx[0]?.n ?? 0) === 0) {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX \`user_tenantId_employeeId_key\` ON \`user\`(\`tenantId\`, \`employeeId\`)`,
    );
  }
  console.log("user profile fields ready");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not add user profile fields");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
