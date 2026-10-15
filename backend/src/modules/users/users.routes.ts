import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { hashPassword } from "../../lib/hash.js";
import { mobileSchema } from "../auth/auth.schema.js";
import { RoleCode } from "@prisma/client";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("ADMIN", "MANAGER"));

function managedRole(roles: RoleCode[]): RoleCode {
  if (roles.includes("ADMIN")) return "MANAGER";
  return "SALES_EXECUTIVE";
}

function publicPerson(user: {
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
  roles: { role: { code: RoleCode } }[];
  teamMembers?: { team: { id: number; name: string } }[];
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
    roles: user.roles.map((item) => item.role.code),
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
      roles: { some: { role: { code: managedRole(actorRoles) } } },
    },
    include: personInclude,
  });
  if (!user) throw notFound("Person not found.");
  return user;
}

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: {
        tenantId: req.auth!.tenantId,
        roles: { some: { role: { code: managedRole(req.auth!.roles) } } },
      },
      include: personInclude,
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: users.map(publicPerson) });
  }),
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await loadManaged(req.auth!.tenantId, req.auth!.roles, Number(req.params.id));
    res.json({ success: true, data: publicPerson(user) });
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
  role: z.enum(["MANAGER", "SALES_EXECUTIVE"]).optional(),
  teamId: z.number().int().positive().optional(),
});

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (req.auth!.roles.includes("ADMIN")) {
      throw forbidden("Managers register themselves. Approve them under Registrations.");
    }
    const body = createUserSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;
    const roleCode = managedRole(req.auth!.roles);

    if (body.role && body.role !== roleCode) {
      throw forbidden("Managers can only add sales executives.");
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
        passwordHash: await hashPassword(body.password),
        roles: { create: { roleId: role.id } },
        teamMembers: body.teamId ? { create: { teamId: body.teamId } } : undefined,
      },
      include: personInclude,
    });

    res.status(201).json({ success: true, data: publicPerson(user) });
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
});

usersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const current = await loadManaged(req.auth!.tenantId, req.auth!.roles, Number(req.params.id));
    const tenantId = req.auth!.tenantId;

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
      },
      include: personInclude,
    });

    res.json({ success: true, data: publicPerson(updated) });
  }),
);
