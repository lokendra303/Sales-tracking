import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

function adminEnv() {
  if (!env.adminName || !env.adminPhone || !env.adminPassword) {
    throw new Error("Set ADMIN_NAME, ADMIN_PHONE, and ADMIN_PASSWORD in backend/.env");
  }
  return { name: env.adminName, phone: env.adminPhone, password: env.adminPassword };
}

/** Creates the system admin from env only when the database has none. Later password and profile edits stay in the database. */
export async function ensureSystemAdmin() {
  const existing = await prisma.user.findFirst({ where: { platformAdmin: true }, select: { id: true } });
  if (existing) return;

  const admin = adminEnv();
  let tenant = await prisma.tenant.findFirst({ orderBy: { id: "asc" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "SalesTrack",
        slug: "salestrack",
        status: "active",
        settings: { create: {} },
      },
    });
  }

  const role = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "ADMIN" } },
    update: {},
    create: { tenantId: tenant.id, code: "ADMIN", name: "Admin" },
  });

  const passwordHash = await bcrypt.hash(admin.password, 10);
  const user = await prisma.user.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone: admin.phone } },
    create: {
      tenantId: tenant.id,
      name: admin.name,
      phone: admin.phone,
      passwordHash,
      platformAdmin: true,
    },
    update: { platformAdmin: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
}
