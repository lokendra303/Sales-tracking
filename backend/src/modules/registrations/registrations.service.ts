import { randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { hashToken } from "../../lib/hash.js";
import { queueMail, sendMail } from "../../lib/mail.js";
import { env } from "../../config/env.js";

const DELETE_OTP_TTL_MS = 10 * 60 * 1000;
const DELETE_OTP_RESEND_MS = 15 * 1000;

function deletePurpose(tenantId: number) {
  return `delete_tenant_${tenantId}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "your email";
  const tip = local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
  return `${tip}@${domain}`;
}

function codesMatch(storedHash: string, given: string) {
  const left = Buffer.from(storedHash);
  const right = Buffer.from(hashToken(given));
  return left.length === right.length && timingSafeEqual(left, right);
}

async function adminEmailFor(userId: number) {
  const admin = await prisma.user.findFirst({
    where: { id: userId, platformAdmin: true, status: "ACTIVE" },
    select: { id: true, email: true, name: true },
  });
  if (!admin) throw badRequest("Only the system admin can delete a company.");
  let email = admin.email ? normalizeEmail(admin.email) : "";
  if (!email && env.adminEmail) {
    await prisma.user.update({ where: { id: admin.id }, data: { email: env.adminEmail } });
    email = env.adminEmail;
  }
  if (!email) throw badRequest("Add an email on your Account profile before deleting a company.");
  return { ...admin, email };
}

async function loadDeletableTenant(tenantId: number) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, slug: { not: "demo-company" } },
    include: {
      users: {
        where: { roles: { some: { role: { code: "MANAGER" } } } },
        take: 1,
        select: { id: true, name: true, email: true, phone: true },
      },
    },
  });
  if (!tenant) throw notFound("Company not found.");
  const hasPlatformAdmin = await prisma.user.count({
    where: { tenantId: tenant.id, platformAdmin: true },
  });
  if (hasPlatformAdmin > 0) {
    throw badRequest("You cannot delete the system admin company.");
  }
  return tenant;
}

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
      users: {
        where: { roles: { some: { role: { code: "MANAGER" } } } },
        take: 1,
        select: { id: true, name: true, email: true, phone: true },
      },
    },
  });
  if (!tenant) throw notFound("Registration not found.");
  if (tenant.status === "active" && action === "approve") {
    throw badRequest("This company is already approved.");
  }

  const status = action === "approve" ? "active" : "rejected";
  await prisma.tenant.update({ where: { id: tenant.id }, data: { status } });
  const manager = tenant.users[0];
  if (manager) {
    await prisma.user.update({
      where: { id: manager.id },
      data: { status: action === "approve" ? "ACTIVE" : "DISABLED" },
    });
    if (action === "reject") {
      await prisma.refreshToken.updateMany({
        where: { userId: manager.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (manager.email) {
      if (action === "approve") {
        queueMail(
          manager.email,
          `SalesTrack approved — ${tenant.name}`,
          [
            `Hi ${manager.name},`,
            ``,
            `Your company "${tenant.name}" has been approved on SalesTrack.`,
            `You are authorised to use SalesTrack Desk and the mobile app for your team.`,
            ``,
            `Sign in with your registered mobile number: ${manager.phone}`,
            `Then add your sales employees and start planning visits.`,
            ``,
            `If you did not register this company, ignore this email.`,
            ``,
            `— SalesTrack`,
          ].join("\n"),
        );
      } else {
        queueMail(
          manager.email,
          `SalesTrack registration update — ${tenant.name}`,
          [
            `Hi ${manager.name},`,
            ``,
            `Your registration for "${tenant.name}" was not approved.`,
            `You cannot sign in until a system admin reviews this again.`,
            ``,
            `Contact the system admin if you think this is a mistake.`,
            ``,
            `— SalesTrack`,
          ].join("\n"),
        );
      }
    }
  }

  return { tenantId: tenant.id, status, emailed: Boolean(manager?.email) };
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

/** Step 1: email a confirmation OTP to the system admin. */
export async function requestTenantDelete(tenantId: number, adminUserId: number) {
  const tenant = await loadDeletableTenant(tenantId);
  const admin = await adminEmailFor(adminUserId);
  const purpose = deletePurpose(tenant.id);
  const email = admin.email;

  const latest = await prisma.emailOtp.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < DELETE_OTP_RESEND_MS) {
    const waitSec = Math.ceil((DELETE_OTP_RESEND_MS - (Date.now() - latest.createdAt.getTime())) / 1000);
    throw badRequest(`Wait ${waitSec}s before requesting another code.`);
  }

  await prisma.emailOtp.updateMany({
    where: { email, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = String(randomInt(100000, 1000000));
  await prisma.emailOtp.create({
    data: {
      email,
      purpose,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + DELETE_OTP_TTL_MS),
    },
  });

  // Await send so admin knows the code was actually emailed before the confirm UI opens.
  try {
    await sendMail(
      email,
      `Confirm delete — ${tenant.name}`,
      [
        `Hi ${admin.name},`,
        ``,
        `You requested deletion of company "${tenant.name}" on SalesTrack.`,
        `This permanently removes the manager, employees, leads, visits and sales for that company.`,
        ``,
        `Confirmation code: ${code}`,
        `It expires in 10 minutes.`,
        ``,
        `If you did not request this, ignore this email and keep the company.`,
        ``,
        `— SalesTrack`,
      ].join("\n"),
    );
  } catch (error) {
    await prisma.emailOtp.deleteMany({
      where: { email, purpose, consumedAt: null, codeHash: hashToken(code) },
    });
    console.error(error);
    throw badRequest("Could not send the confirmation code. Check SMTP and try again.");
  }

  return {
    tenantId: tenant.id,
    companyName: tenant.name,
    managerName: tenant.users[0]?.name ?? null,
    sent: true,
    message: `Confirmation code sent to ${maskEmail(email)}. Enter it to permanently delete this company.`,
  };
}

/** Step 2: verify OTP, then hard-delete the tenant (cascade). */
export async function confirmTenantDelete(tenantId: number, adminUserId: number, otpRaw: string) {
  const tenant = await loadDeletableTenant(tenantId);
  const admin = await adminEmailFor(adminUserId);
  const purpose = deletePurpose(tenant.id);
  const email = admin.email;
  const otp = otpRaw.trim();

  const candidates = await prisma.emailOtp.findMany({
    where: { email, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!candidates.length) throw badRequest("Request a new confirmation code. This one is missing or expired.");

  const row = candidates.find((item) => item.attempts < 5 && codesMatch(item.codeHash, otp));
  if (!row) {
    await prisma.emailOtp.update({
      where: { id: candidates[0].id },
      data: { attempts: { increment: 1 } },
    });
    throw badRequest("That confirmation code is wrong.");
  }

  await prisma.emailOtp.updateMany({
    where: { email, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const manager = tenant.users[0] ?? null;
  const companyName = tenant.name;

  await prisma.tenant.delete({ where: { id: tenant.id } });

  if (manager?.email) {
    queueMail(
      manager.email,
      `SalesTrack account removed — ${companyName}`,
      [
        `Hi ${manager.name},`,
        ``,
        `Your company "${companyName}" and manager access have been permanently removed from SalesTrack by the system admin.`,
        `You can no longer sign in with mobile ${manager.phone}.`,
        ``,
        `— SalesTrack`,
      ].join("\n"),
    );
  }

  return {
    tenantId,
    deleted: true,
    message: `"${companyName}" was permanently deleted.`,
    managerNotified: Boolean(manager?.email),
  };
}
