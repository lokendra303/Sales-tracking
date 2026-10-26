import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { passwordRecord } from "../../lib/hash.js";
import { mobileSchema } from "../auth/auth.schema.js";
import { RoleCode } from "@prisma/client";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("ADMIN", "MANAGER"));

/** Roles the actor may list / edit. */
function managedRoles(roles: RoleCode[]): RoleCode[] {
  if (roles.includes("ADMIN")) return ["MANAGER"];
  // Managers see field executives and other desk logins they added.
  return ["MANAGER", "SALES_EXECUTIVE"];
}

function defaultCreateRole(roles: RoleCode[]): RoleCode {
  if (roles.includes("ADMIN")) return "MANAGER";
  return "SALES_EXECUTIVE";
}

/** Main account = first manager created for the company (email registration). */
async function tenantOwnerId(tenantId: number) {
  const owner = await prisma.user.findFirst({
    where: {
      tenantId,
      roles: { some: { role: { code: "MANAGER" } } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return owner?.id ?? null;
}

function publicPerson(
  user: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    employeeId: string | null;
    designation: string | null;
    city: string | null;
    address: string | null;
    joiningDate: Date | null;
    loginPassword?: string | null;
    status: string;
    roles: { role: { code: RoleCode } }[];
    teamMembers?: { team: { id: number; name: string } }[];
  },
  ownerId: number | null,
) {
  const roles = user.roles.map((item) => item.role.code);
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
    loginPassword: user.loginPassword ?? null,
    status: user.status,
    roles,
    isOwner: ownerId != null && user.id === ownerId,
    teams: (user.teamMembers ?? []).map((item) => ({ id: item.team.id, name: item.team.name })),
  };
}

const personInclude = {
  roles: { include: { role: true } },
  teamMembers: { include: { team: true } },
} as const;

async function loadManaged(tenantId: number, actorRoles: RoleCode[], userId: number) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId,
      roles: { some: { role: { code: { in: managedRoles(actorRoles) } } } },
    },
    include: personInclude,
  });
  if (!user) throw notFound("Person not found.");
  return user;
}

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const ownerId = await tenantOwnerId(tenantId);
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        roles: { some: { role: { code: { in: managedRoles(req.auth!.roles) } } } },
      },
      include: personInclude,
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: users.map((row) => publicPerson(row, ownerId)) });
  }),
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const ownerId = await tenantOwnerId(tenantId);
    const user = await loadManaged(tenantId, req.auth!.roles, Number(req.params.id));
    res.json({ success: true, data: publicPerson(user, ownerId) });
  }),
);

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name."),
  phone: mobileSchema,
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  employeeId: z.string().trim().min(1, "Enter the employee ID.").max(40),
  designation: z.string().trim().min(2, "Enter the designation.").max(80),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  address: z.string().trim().max(500).optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter joining date as YYYY-MM-DD.").optional(),
  /** Field = phone app only. Desk = web portal + mobile (own login, not the manager password). */
  role: z.enum(["MANAGER", "SALES_EXECUTIVE"]).optional(),
  teamId: z.number().int().positive().optional(),
});

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (req.auth!.roles.includes("ADMIN")) {
      throw forbidden("Managers register themselves. Approve them under Registrations.");
    }
    if (!req.auth!.roles.includes("MANAGER")) {
      throw forbidden("Only managers can add team logins.");
    }

    const body = createUserSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;
    const roleCode = body.role ?? defaultCreateRole(req.auth!.roles);
    const allowed = managedRoles(req.auth!.roles);

    if (!allowed.includes(roleCode)) {
      throw forbidden("You can only add field executives or desk logins.");
    }

    const phoneTaken = await prisma.user.findFirst({ where: { tenantId, phone: body.phone } });
    if (phoneTaken) throw badRequest("A user with this mobile number already exists.");

    const email = body.email.trim().toLowerCase();
    const emailTaken = await prisma.user.findFirst({ where: { email } });
    if (emailTaken) throw badRequest("This email is already registered.");

    const employeeId = body.employeeId.trim();
    const empTaken = await prisma.user.findFirst({ where: { tenantId, employeeId } });
    if (empTaken) throw badRequest("This employee ID is already in use.");

    const role = await prisma.role.findFirst({ where: { tenantId, code: roleCode } });
    if (!role) throw badRequest("Role not found.");

    const user = await prisma.user.create({
      data: {
        tenantId,
        name: body.name.trim(),
        phone: body.phone,
        email,
        employeeId,
        designation: body.designation.trim(),
        city: body.city.trim(),
        address: body.address?.trim() || null,
        joiningDate: body.joiningDate ? new Date(`${body.joiningDate}T00:00:00`) : null,
        ...(await passwordRecord(body.password)),
        roles: { create: { roleId: role.id } },
        teamMembers: body.teamId ? { create: { teamId: body.teamId } } : undefined,
      },
      include: personInclude,
    });

    const ownerId = await tenantOwnerId(tenantId);
    res.status(201).json({ success: true, data: publicPerson(user, ownerId) });
  }),
);

const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: mobileSchema.optional(),
  email: z.string().trim().email().optional(),
  employeeId: z.string().trim().min(1).max(40).optional(),
  designation: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  address: z.string().trim().max(500).nullable().optional(),
  joiningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  password: z.string().min(6, "Password must be at least 6 characters.").optional(),
});

usersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const current = await loadManaged(req.auth!.tenantId, req.auth!.roles, Number(req.params.id));
    const tenantId = req.auth!.tenantId;
    const ownerId = await tenantOwnerId(tenantId);
    const actorId = req.auth!.userId;
    const targetIsManager = current.roles.some((row) => row.role.code === "MANAGER");
    const actorIsOwner = ownerId != null && actorId === ownerId;
    const targetIsOwner = ownerId != null && current.id === ownerId;

    if (current.id === actorId && body.status === "DISABLED") {
      throw badRequest("You cannot turn off your own login.");
    }

    // Main registered manager can deactivate desk helpers / field staff.
    // Desk helpers cannot turn off the main manager or other desk logins.
    if (body.status === "DISABLED") {
      if (targetIsOwner) {
        throw forbidden("The main manager account (registered with email) cannot be turned off.");
      }
      if (targetIsManager && !actorIsOwner) {
        throw forbidden("Only the main manager can turn off another desk login.");
      }
    }

    if (body.phone && body.phone !== current.phone) {
      const phoneTaken = await prisma.user.findFirst({
        where: { tenantId, phone: body.phone, id: { not: current.id } },
      });
      if (phoneTaken) throw badRequest("Another account already uses this mobile number.");
    }

    if (body.email) {
      const email = body.email.trim().toLowerCase();
      if (email !== (current.email ?? "").toLowerCase()) {
        const emailTaken = await prisma.user.findFirst({ where: { email, id: { not: current.id } } });
        if (emailTaken) throw badRequest("This email is already registered.");
      }
    }

    if (body.employeeId && body.employeeId.trim() !== (current.employeeId ?? "")) {
      const empTaken = await prisma.user.findFirst({
        where: { tenantId, employeeId: body.employeeId.trim(), id: { not: current.id } },
      });
      if (empTaken) throw badRequest("This employee ID is already in use.");
    }

    const passwordFields = body.password ? await passwordRecord(body.password) : undefined;

    const updated = await prisma.user.update({
      where: { id: current.id },
      data: {
        name: body.name?.trim(),
        phone: body.phone,
        email: body.email ? body.email.trim().toLowerCase() : undefined,
        employeeId: body.employeeId?.trim(),
        designation: body.designation?.trim(),
        city: body.city?.trim(),
        address: body.address === undefined ? undefined : body.address?.trim() || null,
        joiningDate:
          body.joiningDate === undefined
            ? undefined
            : body.joiningDate
              ? new Date(`${body.joiningDate}T00:00:00`)
              : null,
        status: body.status,
        ...passwordFields,
      },
      include: personInclude,
    });

    res.json({ success: true, data: publicPerson(updated, ownerId) });
  }),
);
