import { prisma } from "../src/lib/prisma.js";

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'loginPassword'`,
  );
  if (Number(rows[0]?.n ?? 0) === 0) {
    await prisma.$executeRawUnsafe("ALTER TABLE `user` ADD COLUMN `loginPassword` VARCHAR(200) NULL");
  }
  console.log("user loginPassword ready");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not add login password column");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
