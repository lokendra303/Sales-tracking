import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../lib/errors.js";

function publicManager(user: {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  employeeId: string | null;
  designation: string | null;
  city: string | null;
  address: string | null;
  joiningDate: Date | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    employeeId: user.employeeId,
    designation: user.designation,
    city: user.city,
    address: user.address,
    joiningDate: user.joiningDate,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export async function listRegistrations() {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { not: "demo-company" } },
    include: {
      settings: true,
      users: {
        where: { roles: { some: { role: { code: "MANAGER" } } } },
        orderBy: { id: "asc" },
        take: 1,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          employeeId: true,
          designation: true,
          city: true,
          address: true,
          joiningDate: true,
          status: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          users: true,
          leads: true,
          visits: true,
          sales: true,
        },
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
    updatedAt: tenant.updatedAt,
    manager: tenant.users[0] ? publicManager(tenant.users[0]) : null,
    counts: {
      users: tenant._count.users,
      leads: tenant._count.leads,
      visits: tenant._count.visits,
      sales: tenant._count.sales,
    },
    settings: tenant.settings
      ? {
          liveLocationEnabled: tenant.settings.liveLocationEnabled,
          timezone: tenant.settings.timezone,
          currency: tenant.settings.currency,
          workStart: tenant.settings.workStart,
          workEnd: tenant.settings.workEnd,
        }
      : null,
  }));
}

export async function getRegistration(tenantId: number) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, slug: { not: "demo-company" } },
    include: {
      settings: true,
      users: {
        include: {
          roles: { include: { role: true } },
        },
        orderBy: { id: "asc" },
      },
      _count: {
        select: {
          users: true,
          leads: true,
          visits: true,
          sales: true,
          customers: true,
        },
      },
    },
  });
  if (!tenant) throw notFound("Company not found.");

  const manager = tenant.users.find((user) => user.roles.some((item) => item.role.code === "MANAGER"));
  const salesPeople = tenant.users
    .filter((user) => user.roles.some((item) => item.role.code === "SALES_EXECUTIVE"))
    .map((user) => ({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      employeeId: user.employeeId,
      designation: user.designation,
      city: user.city,
      status: user.status,
    }));

  return {
    tenantId: tenant.id,
    companyName: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    manager: manager
      ? publicManager({
          id: manager.id,
          name: manager.name,
          phone: manager.phone,
          email: manager.email,
          employeeId: manager.employeeId,
          designation: manager.designation,
          city: manager.city,
          address: manager.address,
          joiningDate: manager.joiningDate,
          status: manager.status,
          createdAt: manager.createdAt,
        })
      : null,
    salesPeople,
    counts: {
      users: tenant._count.users,
      leads: tenant._count.leads,
      visits: tenant._count.visits,
      sales: tenant._count.sales,
      customers: tenant._count.customers,
    },
    settings: tenant.settings
      ? {
          liveLocationEnabled: tenant.settings.liveLocationEnabled,
          timezone: tenant.settings.timezone,
          currency: tenant.settings.currency,
          workStart: tenant.settings.workStart,
          workEnd: tenant.settings.workEnd,
          visitCheckinRadiusMeters: tenant.settings.visitCheckinRadiusMeters,
        }
      : null,
  };
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

/** Suspend (active=false) or restore (active=true) a company and all its users. */
export async function setCompanyActive(tenantId: number, active: boolean) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, slug: { not: "demo-company" } },
    include: { users: { select: { id: true } } },
  });
  if (!tenant) throw notFound("Company not found.");
  if (tenant.status === "pending") {
    throw badRequest("Approve this registration first.");
  }

  const status = active ? "active" : "suspended";
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
