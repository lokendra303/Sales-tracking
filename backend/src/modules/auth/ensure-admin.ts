import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

function adminEnv() {
  if (!env.adminName || !env.adminPhone || !env.adminPassword) {
    throw new Error("Set ADMIN_NAME, ADMIN_PHONE, and ADMIN_PASSWORD in backend/.env");
  }
  return {
    name: env.adminName,
    phone: env.adminPhone,
    password: env.adminPassword,
    email: env.adminEmail || null,
  };
}

/**
 * Seeds the first platform admin from ADMIN_* in .env only when none exists.
 * If the admin exists but still has no email, fills ADMIN_EMAIL once.
 * After that, phone / password / email are updated only from the portal — never from .env again.
 */
export async function ensureSystemAdmin() {
  const existing = await prisma.user.findFirst({
    where: { platformAdmin: true },
    select: { id: true, email: true },
  });

  if (existing) {
    if (!existing.email && env.adminEmail) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { email: env.adminEmail },
      });
    }
    return;
  }

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
      email: admin.email,
      passwordHash,
      platformAdmin: true,
    },
    update: { platformAdmin: true, ...(admin.email ? { email: admin.email } : {}) },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
}
