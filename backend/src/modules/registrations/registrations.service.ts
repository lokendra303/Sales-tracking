import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../lib/errors.js";

export async function listRegistrations() {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { not: "demo-company" } },
    include: {
      users: {
        where: { roles: { some: { role: { code: "MANAGER" } } } },
        orderBy: { id: "asc" },
        take: 1,
        select: { id: true, name: true, phone: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return tenants.map((tenant) => ({
    tenantId: tenant.id,
    companyName: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    createdAt: tenant.createdAt,
    manager: tenant.users[0] ?? null,
  }));
}

export async function decideRegistration(tenantId: number, action: "approve" | "reject") {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, slug: { not: "demo-company" } },
    include: {
      users: { where: { roles: { some: { role: { code: "MANAGER" } } } }, take: 1 },
    },
  });
  if (!tenant) throw notFound("Registration not found.");
  if (tenant.status === "active" && action === "approve") {
    throw badRequest("This company is already approved.");
  }

  const status = action === "approve" ? "active" : "rejected";
  await prisma.tenant.update({ where: { id: tenant.id }, data: { status } });
  if (tenant.users[0]) {
    await prisma.user.update({
      where: { id: tenant.users[0].id },
      data: { status: action === "approve" ? "ACTIVE" : "DISABLED" },
    });
    if (action === "reject") {
      await prisma.refreshToken.updateMany({
        where: { userId: tenant.users[0].id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  return { tenantId: tenant.id, status };
}

export async function setCompanyActive(tenantId: number, active: boolean) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, slug: { not: "demo-company" } },
    include: { users: { select: { id: true } } },
  });
  if (!tenant) throw notFound("Company not found.");
  if (tenant.status === "pending") {
    throw badRequest("Approve this registration first.");
  }

  const status = active ? "active" : "inactive";
  await prisma.tenant.update({ where: { id: tenant.id }, data: { status } });
  await prisma.user.updateMany({
    where: { tenantId: tenant.id },
    data: { status: active ? "ACTIVE" : "DISABLED" },
  });
  if (!active) {
    await prisma.refreshToken.updateMany({
      where: { userId: { in: tenant.users.map((item) => item.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  return { tenantId: tenant.id, status };
}
