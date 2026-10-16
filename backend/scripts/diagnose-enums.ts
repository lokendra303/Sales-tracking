import { applyDatabaseEnv } from "../src/config/database.js";
import { PrismaClient } from "@prisma/client";

applyDatabaseEnv();
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_TYPE: string }[]>(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead' AND COLUMN_NAME = 'status'",
  );
  console.log("lead.status enum:", rows[0]?.COLUMN_TYPE);

  // Simulate common failing paths
  try {
    await prisma.beat.findMany({
      where: { tenantId: 1, active: true },
      include: { members: { include: { lead: true, customer: true }, orderBy: { sequence: "asc" } } },
      orderBy: { name: "asc" },
    });
    console.log("list beats with members OK");
  } catch (err) {
    console.log("list beats FAIL:", err instanceof Error ? err.message : err);
  }

  try {
    await prisma.beatPlan.findFirst({ where: { tenantId: 1, userId: 1 } });
    console.log("beatPlan findFirst OK");
  } catch (err) {
    console.log("beatPlan FAIL:", err instanceof Error ? err.message : err);
  }

  try {
    await prisma.lead.create({
      data: {
        tenantId: 1,
        name: "__diag_temp__",
        phone: "0000000000",
        status: "INTERESTED",
        temperature: "WARM",
        potential: "MEDIUM",
        approvalStatus: "APPROVED",
        createdById: 1,
      },
    });
    console.log("create INTERESTED lead OK");
    await prisma.lead.deleteMany({ where: { name: "__diag_temp__" } });
  } catch (err) {
    console.log("create INTERESTED FAIL:", err instanceof Error ? err.message : err);
  }

  try {
    await prisma.lead.create({
      data: {
        tenantId: 1,
        name: "__diag_temp2__",
        phone: "0000000001",
        status: "NEGOTIATION",
        temperature: "WARM",
        potential: "MEDIUM",
        approvalStatus: "APPROVED",
        createdById: 1,
      },
    });
    console.log("create NEGOTIATION lead OK");
    await prisma.lead.deleteMany({ where: { name: "__diag_temp2__" } });
  } catch (err) {
    console.log("create NEGOTIATION FAIL:", err instanceof Error ? err.message : err);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
