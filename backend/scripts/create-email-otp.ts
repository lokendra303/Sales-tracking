import { prisma } from "../src/lib/prisma.js";

async function main() {
await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS \`emailotp\` (
  \`id\` INTEGER NOT NULL AUTO_INCREMENT,
  \`email\` VARCHAR(191) NOT NULL,
  \`purpose\` VARCHAR(191) NOT NULL DEFAULT 'register',
  \`codeHash\` VARCHAR(191) NOT NULL,
  \`expiresAt\` DATETIME(3) NOT NULL,
  \`attempts\` INTEGER NOT NULL DEFAULT 0,
  \`consumedAt\` DATETIME(3) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX \`emailotp_email_purpose_createdAt_idx\`(\`email\`, \`purpose\`, \`createdAt\`),
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`);

console.log("emailotp ready");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
