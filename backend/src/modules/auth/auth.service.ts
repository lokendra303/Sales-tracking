import { timingSafeEqual, randomInt } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { createRefreshTokenValue, hashToken, passwordRecord, verifyPassword } from "../../lib/hash.js";
import { queueMail } from "../../lib/mail.js";
import { refreshExpiry, signAccessToken } from "../../lib/tokens.js";
import { badRequest, forbidden, unauthorized } from "../../lib/errors.js";
import { parseMobile } from "../../lib/phone.js";
import type { RoleCode } from "@prisma/client";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
/** Forgot-password resend cooldown (registration keeps the longer window). */
const RESET_RESEND_MS = 15 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function codesMatch(storedHash: string, given: string) {
  const left = Buffer.from(storedHash);
  const right = Buffer.from(hashToken(given));
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Main company account = earliest manager (email registration). */
async function resolveIsOwner(tenantId: number, userId: number) {
  const owner = await prisma.user.findFirst({
    where: {
      tenantId,
      roles: { some: { role: { code: "MANAGER" } } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return owner?.id === userId;
}

async function publicUser(user: {
  id: number;
  tenantId: number;
  name: string;
  phone: string;
  email: string | null;
  employeeId?: string | null;
  designation?: string | null;
  city?: string | null;
  address?: string | null;
  joiningDate?: Date | null;
  status: string;
  platformAdmin?: boolean;
  roles: { role: { code: RoleCode; name: string } }[];
  tenant: { id: number; name: string; slug: string; status?: string; settings: { liveLocationEnabled: boolean; currency: string; timezone: string } | null };
}) {
  const roles = user.roles.map((item) => item.role.code);
  const isOwner = roles.includes("MANAGER") ? await resolveIsOwner(user.tenantId, user.id) : false;
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    employeeId: user.employeeId ?? null,
    designation: user.designation ?? null,
    city: user.city ?? null,
    address: user.address ?? null,
    joiningDate: user.joiningDate ?? null,
    status: user.status,
    roles,
    isOwner,
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
  email?: string;
  device?: { deviceUid: string; platform: string; appVersion?: string };
}) {
  const phone = parseMobile(input.phone);
  if (!phone) throw badRequest("Enter a 10-digit mobile number.");
  const user = await prisma.user.findFirst({
    where: { phone },
    include: userInclude,
    orderBy: { id: "asc" },
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw unauthorized("Wrong mobile number or password.");
  }

  const roles = user.roles.map((item) => item.role.code);
  const isSystemAdmin = Boolean(user.platformAdmin) || roles.includes("ADMIN");
  if (isSystemAdmin) {
    const givenEmail = input.email ? normalizeEmail(input.email) : "";
    const storedEmail = user.email ? normalizeEmail(user.email) : "";
    if (!givenEmail) {
      throw unauthorized("Admin login requires email, mobile number, and password.");
    }
    if (!storedEmail || givenEmail !== storedEmail) {
      throw unauthorized("Wrong email, mobile number, or password.");
    }
  }

  if (user.tenant.status === "pending") {
    throw forbidden("Admin has not approved this company yet. Try again after approval.");
  }
  if (user.tenant.status === "rejected") {
    throw forbidden("This registration was declined. Contact the system admin.");
  }
  if (user.tenant.status === "inactive" || user.tenant.status === "suspended") {
    throw forbidden("This company is suspended. Contact the system admin.");
  }
  if (user.status !== "ACTIVE" || user.tenant.status !== "active") {
    throw forbidden("This account is not active.");
  }
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
  return { user: await publicUser(user), ...tokens };
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
  return { user: await publicUser(stored.user), ...tokens };
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) {
    return;
  }
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hashToken(refreshToken) },
    select: { deviceId: true },
  });
  if (stored?.deviceId) {
    await prisma.device.update({ where: { id: stored.deviceId }, data: { pushToken: null } }).catch(() => undefined);
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
  return await publicUser(user);
}

export async function savePushToken(userId: number, token: string, deviceUid = "salestrack-dev") {
  await prisma.device.updateMany({
    where: { pushToken: token, userId: { not: userId } },
    data: { pushToken: null },
  });
  await prisma.device.upsert({
    where: { userId_deviceUid: { userId, deviceUid } },
    create: {
      userId,
      deviceUid,
      platform: "android",
      pushToken: token,
      lastSeenAt: new Date(),
    },
    update: {
      pushToken: token,
      status: "ACTIVE",
      lastSeenAt: new Date(),
    },
  });
}

export async function changeOwnPassword(input: {
  userId: number;
  oldPassword: string;
  newPassword: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw unauthorized();
  if (!(await verifyPassword(input.oldPassword, user.passwordHash))) {
    throw badRequest("Current password is wrong.");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: await passwordRecord(input.newPassword),
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
    data: await passwordRecord(password),
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

export async function sendRegisterOtp(emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  const taken = await prisma.user.findFirst({ where: { email } });
  if (taken) throw badRequest("This email is already registered.");

  const latest = await prisma.emailOtp.findFirst({
    where: { email, purpose: "register" },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_MS) {
    throw badRequest("Wait a minute before requesting another code.");
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sent = await prisma.emailOtp.count({
    where: { email, purpose: "register", createdAt: { gte: hourAgo } },
  });
  if (sent >= 5) throw badRequest("Too many codes sent. Try again later.");

  const code = String(randomInt(100000, 1000000));
  const codeHash = hashToken(code);
  await prisma.emailOtp.create({
    data: {
      email,
      purpose: "register",
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  // Do not block the HTTP response on Gmail SMTP (often several seconds).
  queueMail(
    email,
    "Your SalesTrack registration code",
    `Your SalesTrack registration code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    async () => {
      await prisma.emailOtp.deleteMany({
        where: { email, purpose: "register", consumedAt: null, codeHash },
      });
    },
  );

  return { sent: true, message: "Code is on its way. Check your inbox in a moment (expires in 10 minutes)." };
}

async function consumeRegisterOtp(email: string, otp: string) {
  const row = await prisma.emailOtp.findFirst({
    where: { email, purpose: "register", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) throw badRequest("Request a new code. This one is missing or expired.");
  if (row.attempts >= 5) throw badRequest("Too many wrong codes. Request a new one.");
  if (!codesMatch(row.codeHash, otp.trim())) {
    await prisma.emailOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw badRequest("That code is wrong.");
  }
  const used = await prisma.emailOtp.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (used.count !== 1) throw badRequest("Request a new code.");
}

export async function register(input: {
  companyName: string;
  name: string;
  phone: string;
  password: string;
  email: string;
  otp: string;
}) {
  const phone = parseMobile(input.phone);
  const email = normalizeEmail(input.email);
  if (!phone) throw badRequest("Enter a 10-digit mobile number.");
  const takenPhone = await prisma.user.findFirst({ where: { phone } });
  if (takenPhone) throw badRequest("This mobile number is already registered.");
  const takenEmail = await prisma.user.findFirst({ where: { email } });
  if (takenEmail) throw badRequest("This email is already registered.");
  await consumeRegisterOtp(email, input.otp);

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
      email,
      ...(await passwordRecord(input.password)),
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

const RESET_PURPOSE = "reset_password";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "your registered email";
  const tip = local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
  return `${tip}@${domain}`;
}

/** Prefer system admin when the same mobile exists on more than one desk account. */
async function findDeskUserByPhone(phone: string) {
  const users = await prisma.user.findMany({
    where: {
      phone,
      status: "ACTIVE",
      roles: { some: { role: { code: { in: ["ADMIN", "MANAGER"] } } } },
    },
    include: { roles: { include: { role: true } } },
    orderBy: [{ platformAdmin: "desc" }, { id: "asc" }],
  });
  return users[0] ?? null;
}

/** Managers and admins only. OTP goes to the email already saved on the account. */
export async function sendForgotPasswordOtp(phoneRaw: string) {
  const phone = parseMobile(phoneRaw);
  if (!phone) throw badRequest("Enter a 10-digit mobile number.");

  let user = await findDeskUserByPhone(phone);

  // Unknown mobile: generic reply so random numbers cannot be probed.
  if (!user) {
    return {
      sent: false,
      message: "If this account has a registered email, a code was sent. It expires in 10 minutes.",
    };
  }

  // First-time admin email from .env if the portal never saved one.
  if (!user.email && user.platformAdmin && env.adminEmail) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { email: env.adminEmail },
      include: { roles: { include: { role: true } } },
    });
  }
  if (!user.email) {
    throw badRequest(
      "This account has no email saved, so a reset code cannot be sent. Sign in and add an email on Account, or ask the system admin to set it.",
    );
  }

  const email = normalizeEmail(user.email);
  const latest = await prisma.emailOtp.findFirst({
    where: { email, purpose: RESET_PURPOSE },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESET_RESEND_MS) {
    const waitSec = Math.ceil((RESET_RESEND_MS - (Date.now() - latest.createdAt.getTime())) / 1000);
    throw badRequest(`Wait ${waitSec}s before requesting another code.`);
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sent = await prisma.emailOtp.count({
    where: { email, purpose: RESET_PURPOSE, createdAt: { gte: hourAgo } },
  });
  if (sent >= 8) throw badRequest("Too many codes sent. Try again later.");

  // Only one active code — older unused codes confused admin resets.
  await prisma.emailOtp.updateMany({
    where: { email, purpose: RESET_PURPOSE, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = String(randomInt(100000, 1000000));
  const codeHash = hashToken(code);
  await prisma.emailOtp.create({
    data: {
      email,
      purpose: RESET_PURPOSE,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  // Return immediately; SMTP to Gmail is slow if awaited on the request.
  queueMail(
    email,
    "Your SalesTrack password reset code",
    `Your SalesTrack password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    async () => {
      await prisma.emailOtp.deleteMany({
        where: { email, purpose: RESET_PURPOSE, consumedAt: null, codeHash },
      });
    },
  );

  return {
    sent: true,
    message: `Code is on its way to ${maskEmail(email)}. Check inbox shortly. Use the newest email only.`,
  };
}

export async function resetPasswordWithOtp(input: { phone: string; otp: string; newPassword: string }) {
  const phone = parseMobile(input.phone);
  if (!phone) throw badRequest("Enter a 10-digit mobile number.");
  if (input.newPassword.length < 6) throw badRequest("Password must be at least 6 characters.");

  const user = await findDeskUserByPhone(phone);
  if (!user?.email) throw badRequest("No reset is available for this mobile number.");

  const email = normalizeEmail(user.email);
  const given = input.otp.trim();
  const candidates = await prisma.emailOtp.findMany({
    where: { email, purpose: RESET_PURPOSE, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!candidates.length) throw badRequest("Request a new code. This one is missing or expired.");

  const row = candidates.find((item) => item.attempts < 5 && codesMatch(item.codeHash, given));
  if (!row) {
    await prisma.emailOtp.update({
      where: { id: candidates[0].id },
      data: { attempts: { increment: 1 } },
    });
    if (candidates[0].attempts + 1 >= 5) throw badRequest("Too many wrong codes. Request a new one.");
    throw badRequest("That code is wrong. Use the newest email code, or request a new one.");
  }

  await prisma.emailOtp.updateMany({
    where: { email, purpose: RESET_PURPOSE, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: await passwordRecord(input.newPassword),
  });
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (user.platformAdmin) {
    return {
      ok: true,
      message:
        "Password updated. On sign-in, tick System admin and use email + mobile + your new password.",
    };
  }
  return { ok: true, message: "Password updated. Log in with your mobile and new password." };
}

/** Admin or manager can update their own mobile / email / profile details. */
export async function updateOwnProfile(
  userId: number,
  roles: RoleCode[],
  input: {
    name?: string;
    phone?: string;
    email?: string;
    designation?: string;
    city?: string;
    address?: string | null;
  },
) {
  if (!roles.includes("ADMIN") && !roles.includes("MANAGER")) {
    throw forbidden("Ask your manager to update your profile.");
  }
  const current = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!current) throw unauthorized();

  if (input.phone && input.phone !== current.phone) {
    const taken = await prisma.user.findFirst({
      where: { tenantId: current.tenantId, phone: input.phone, id: { not: current.id } },
    });
    if (taken) throw badRequest("Another account already uses this mobile number.");
  }
  if (input.email) {
    const email = normalizeEmail(input.email);
    if (email !== (current.email ?? "").toLowerCase()) {
      const taken = await prisma.user.findFirst({ where: { email, id: { not: current.id } } });
      if (taken) throw badRequest("This email is already registered.");
    }
  }

  const updated = await prisma.user.update({
    where: { id: current.id },
    data: {
      name: input.name?.trim(),
      phone: input.phone,
      email: input.email ? normalizeEmail(input.email) : undefined,
      designation: input.designation?.trim(),
      city: input.city?.trim(),
      address: input.address === undefined ? undefined : input.address?.trim() || null,
    },
    include: userInclude,
  });
  return await publicUser(updated);
}
