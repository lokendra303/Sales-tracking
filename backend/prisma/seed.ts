import { PrismaClient, RoleCode } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();
const password = process.env.SEED_PASSWORD ?? "Admin@123";

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-company" },
    update: {},
    create: {
      name: "Demo Company",
      slug: "demo-company",
      status: "active",
      settings: { create: { liveLocationEnabled: false, currency: "INR", timezone: "Asia/Kolkata" } },
    },
  });

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, liveLocationEnabled: false },
  });

  const roleCodes: { code: RoleCode; name: string }[] = [
    { code: "ADMIN", name: "Admin" },
    { code: "MANAGER", name: "Manager" },
    { code: "SALES_EXECUTIVE", name: "Sales Executive" },
  ];

  const roles = [];
  for (const item of roleCodes) {
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: item.code } },
      update: { name: item.name },
      create: { tenantId: tenant.id, code: item.code, name: item.name },
    });
    roles.push(role);
  }

  const existingTeam = await prisma.team.findFirst({
    where: { tenantId: tenant.id, name: "Field Team" },
  });
  const team =
    existingTeam ??
    (await prisma.team.create({
      data: { tenantId: tenant.id, name: "Field Team" },
    }));

  const people = [
    { name: "Admin User", phone: "9999999999", role: "ADMIN" as RoleCode },
    { name: "Manager User", phone: "7777777777", role: "MANAGER" as RoleCode },
    { name: "Rahul Kumar", phone: "8888888888", role: "SALES_EXECUTIVE" as RoleCode },
    { name: "Priya Sharma", phone: "6666666666", role: "SALES_EXECUTIVE" as RoleCode },
  ];

  for (const person of people) {
    const role = roles.find((item) => item.code === person.role);
    if (!role) continue;

    const user = await prisma.user.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: person.phone } },
      update: { name: person.name, passwordHash, platformAdmin: person.role === "ADMIN" },
      create: {
        tenantId: tenant.id,
        name: person.name,
        phone: person.phone,
        passwordHash,
        platformAdmin: person.role === "ADMIN",
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      update: {},
      create: { teamId: team.id, userId: user.id },
    });
  }

  const rahul = await prisma.user.findFirst({
    where: { tenantId: tenant.id, phone: "8888888888" },
  });
  const priya = await prisma.user.findFirst({
    where: { tenantId: tenant.id, phone: "6666666666" },
  });
  if (rahul) {
    const samples = [
      {
        name: "ABC Traders",
        phone: "9876543210",
        contactPerson: "Rajesh Kumar",
        address: "Connaught Place",
        city: "Delhi",
        latitude: 28.6328,
        longitude: 77.2197,
        temperature: "HOT" as const,
        potential: 120000,
        status: "FOLLOW_UP" as const,
        sequence: 1,
      },
      {
        name: "XYZ Enterprises",
        phone: "9876501234",
        contactPerson: "Amit Shah",
        address: "Sector 18",
        city: "Noida",
        latitude: 28.5708,
        longitude: 77.3261,
        temperature: "WARM" as const,
        potential: 75000,
        status: "ASSIGNED" as const,
        sequence: 2,
      },
    ];
    for (const sample of samples) {
      let lead = await prisma.lead.findFirst({
        where: { tenantId: tenant.id, phone: sample.phone },
      });
      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            tenantId: tenant.id,
            name: sample.name,
            phone: sample.phone,
            contactPerson: sample.contactPerson,
            address: sample.address,
            city: sample.city,
            latitude: sample.latitude,
            longitude: sample.longitude,
            temperature: sample.temperature,
            potential: sample.potential,
            status: sample.status,
            source: "MANAGER",
            assigneeId: rahul.id,
            createdById: rahul.id,
          },
        });
        if (sample.name === "ABC Traders") {
          const due = new Date();
          due.setHours(15, 0, 0, 0);
          await prisma.followUp.create({
            data: {
              tenantId: tenant.id,
              userId: rahul.id,
              leadId: lead.id,
              type: "CALL",
              dueAt: due,
              notes: "Discuss order quantity",
            },
          });
        }
      } else {
        lead = await prisma.lead.update({
          where: { id: lead.id },
          data: {
            address: sample.address,
            city: sample.city,
            latitude: sample.latitude,
            longitude: sample.longitude,
            assigneeId: rahul.id,
          },
        });
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const existingStop = await prisma.beatStop.findFirst({
        where: { tenantId: tenant.id, userId: rahul.id, leadId: lead.id, plannedAt: { gte: start } },
      });
      if (!existingStop) {
        const planned = new Date();
        planned.setHours(10 + sample.sequence, 0, 0, 0);
        await prisma.beatStop.create({
          data: {
            tenantId: tenant.id,
            userId: rahul.id,
            leadId: lead.id,
            sequence: sample.sequence,
            plannedAt: planned,
          },
        });
      }
    }

    const now = new Date();
    await prisma.monthlyTarget.upsert({
      where: {
        tenantId_userId_year_month: {
          tenantId: tenant.id,
          userId: rahul.id,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      },
      update: { amount: 50000 },
      create: {
        tenantId: tenant.id,
        userId: rahul.id,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        amount: 50000,
      },
    });
  }

  if (priya) {
    const sample = {
      name: "Metro Mart",
      phone: "9876512345",
      contactPerson: "Neha Singh",
      address: "Lajpat Nagar",
      city: "Delhi",
      latitude: 28.5677,
      longitude: 77.2433,
      temperature: "WARM" as const,
      potential: 54000,
      status: "ASSIGNED" as const,
    };
    const existing = await prisma.lead.findFirst({
      where: { tenantId: tenant.id, phone: sample.phone },
    });
    if (!existing) {
      await prisma.lead.create({
        data: {
          tenantId: tenant.id,
          name: sample.name,
          phone: sample.phone,
          contactPerson: sample.contactPerson,
          address: sample.address,
          city: sample.city,
          latitude: sample.latitude,
          longitude: sample.longitude,
          temperature: sample.temperature,
          potential: sample.potential,
          status: sample.status,
          source: "MANAGER",
          assigneeId: priya.id,
          createdById: priya.id,
        },
      });
    } else {
      await prisma.lead.update({
        where: { id: existing.id },
        data: { assigneeId: priya.id },
      });
    }

    const openLead = await prisma.lead.findFirst({
      where: { tenantId: tenant.id, phone: "9876598765" },
    });
    if (!openLead) {
      await prisma.lead.create({
        data: {
          tenantId: tenant.id,
          name: "City Wholesale",
          phone: "9876598765",
          contactPerson: "Vikram Mehta",
          address: "Karol Bagh",
          city: "Delhi",
          temperature: "COLD",
          potential: 30000,
          status: "NEW",
          source: "MANAGER",
          createdById: priya.id,
        },
      });
    }
  }

  console.log("Seeded Demo Company");
  console.log("Admin     9999999999 /", password);
  console.log("Manager   7777777777 /", password);
  console.log("Sales     8888888888 /", password, "(Rahul)");
  console.log("Sales     6666666666 /", password, "(Priya)");
  console.log("Live location: Off");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
