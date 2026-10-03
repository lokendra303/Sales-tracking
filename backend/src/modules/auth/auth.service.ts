import { prisma } from "../../lib/prisma.js";
import { createRefreshTokenValue, hashPassword, hashToken, verifyPassword } from "../../lib/hash.js";
import { refreshExpiry, signAccessToken } from "../../lib/tokens.js";
import { badRequest, forbidden, unauthorized } from "../../lib/errors.js";
import type { RoleCode } from "@prisma/client";

function publicUser(user: {
  id: number;
  tenantId: number;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  platformAdmin?: boolean;
  roles: { role: { code: RoleCode; name: string } }[];
  tenant: { id: number; name: string; slug: string; status?: string; settings: { liveLocationEnabled: boolean; currency: string; timezone: string } | null };
}) {
  const roles = user.roles.map((item) => item.role.code);
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    status: user.status,
    roles,
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
    },
    liveLocationEnabled: user.tenant.settings?.liveLocationEnabled ?? false,
    currency: user.tenant.settings?.currency ?? "INR",
    timezone: user.tenant.settings?.timezone ?? "Asia/Kolkata",
    platformAdmin: Boolean(user.platformAdmin),
  };
}

const userInclude = {
  roles: { include: { role: true } },
  tenant: { include: { settings: true } },
} as const;

async function issueTokens(userId: number, tenantId: number, roles: RoleCode[], deviceId?: number) {
  const accessToken = signAccessToken({ sub: userId, tenantId, roles });
  const refreshToken = createRefreshTokenValue();
  await prisma.refreshToken.create({
    data: {
      userId,
      deviceId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiry(),
    },
  });
  return { accessToken, refreshToken };
}

export async function login(input: {
  phone: string;
  password: string;
  device?: { deviceUid: string; platform: string; appVersion?: string };
}) {
  const phone = input.phone.replace(/\D/g, "") || input.phone.trim();
  const user = await prisma.user.findFirst({
    where: { phone },
    include: userInclude,
    orderBy: { id: "asc" },
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw unauthorized("Wrong mobile number or password.");
  }
  if (user.tenant.status === "pending") {
    throw forbidden("Admin has not approved this company yet. Try again after approval.");
  }
  if (user.tenant.status === "rejected") {
    throw forbidden("This registration was declined. Contact the system admin.");
  }
  if (user.tenant.status === "inactive") {
    throw forbidden("This company is inactive. Contact the system admin.");
  }
  if (user.status !== "ACTIVE" || user.tenant.status !== "active") {
    throw forbidden("This account is not active.");
  }

  const roles = user.roles.map((item) => item.role.code);
  let deviceId: number | undefined;

  if (input.device) {
    const existing = await prisma.device.findUnique({
      where: { userId_deviceUid: { userId: user.id, deviceUid: input.device.deviceUid } },
    });
    if (existing?.status === "DEACTIVATED") {
      throw forbidden("This phone was deactivated. Contact your admin.");
    }

    const device = await prisma.device.upsert({
      where: {
        userId_deviceUid: { userId: user.id, deviceUid: input.device.deviceUid },
      },
      create: {
        userId: user.id,
        deviceUid: input.device.deviceUid,
        platform: input.device.platform,
        appVersion: input.device.appVersion,
        status: "ACTIVE",
        lastSeenAt: new Date(),
      },
      update: {
        platform: input.device.platform,
        appVersion: input.device.appVersion,
        lastSeenAt: new Date(),
      },
    });
    deviceId = device.id;
  }

  const tokens = await issueTokens(user.id, user.tenantId, roles, deviceId);
  return { user: publicUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: { include: userInclude },
      device: true,
    },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized("Session expired. Please log in again.");
  }

  if (stored.device?.status === "DEACTIVATED") {
    throw forbidden("This phone was deactivated. Contact your admin.");
  }
  if (stored.user.status !== "ACTIVE" || stored.user.tenant.status !== "active") {
    throw unauthorized("Session expired. Please log in again.");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const roles = stored.user.roles.map((item) => item.role.code);
  const tokens = await issueTokens(stored.user.id, stored.user.tenantId, roles, stored.deviceId ?? undefined);
  return { user: publicUser(stored.user), ...tokens };
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) {
    return;
  }
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userInclude,
  });
  if (!user) {
    throw unauthorized();
  }
  return publicUser(user);
}

export async function changeOwnPassword(input: {
  userId: number;
  roles: RoleCode[];
  oldPassword: string;
  newPassword: string;
}) {
  if (!input.roles.includes("ADMIN") && !input.roles.includes("MANAGER")) {
    throw forbidden("Sales executives cannot change password here. Ask your manager.");
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw unauthorized();
  if (!(await verifyPassword(input.oldPassword, user.passwordHash))) {
    throw badRequest("Current password is wrong.");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
}

export async function setPassword(actorRoles: RoleCode[], tenantId: number, userId: number, password: string) {
  if (!actorRoles.includes("ADMIN")) {
    throw forbidden();
  }
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) {
    throw badRequest("User not found.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "company";
}

export async function register(input: {
  companyName: string;
  name: string;
  phone: string;
  password: string;
  email?: string;
}) {
  const phone = input.phone.replace(/\D/g, "");
  if (phone.length < 8) throw badRequest("Enter a valid mobile number.");
  const taken = await prisma.user.findFirst({ where: { phone } });
  if (taken) throw badRequest("This mobile number is already registered.");

  let slug = slugify(input.companyName);
  let n = 2;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${slugify(input.companyName)}-${n}`;
    n += 1;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: input.companyName.trim(),
      slug,
      status: "pending",
      settings: { create: { liveLocationEnabled: false, currency: "INR", timezone: "Asia/Kolkata" } },
    },
  });

  const roleCodes: { code: RoleCode; name: string }[] = [
    { code: "ADMIN", name: "Admin" },
    { code: "MANAGER", name: "Manager" },
    { code: "SALES_EXECUTIVE", name: "Sales Executive" },
  ];
  const roles = await Promise.all(
    roleCodes.map((item) =>
      prisma.role.create({ data: { tenantId: tenant.id, code: item.code, name: item.name } }),
    ),
  );
  const managerRole = roles.find((item) => item.code === "MANAGER")!;

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: input.name.trim(),
      phone,
      email: input.email || null,
      passwordHash: await hashPassword(input.password),
      status: "DISABLED",
      roles: { create: { roleId: managerRole.id } },
    },
  });

  return {
    status: "pending",
    message: "Registration received. The system admin will approve it. You can log in after that.",
    companyName: tenant.name,
    phone,
  };
}
