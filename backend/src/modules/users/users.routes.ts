import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { badRequest, forbidden } from "../../lib/errors.js";
import { hashPassword } from "../../lib/hash.js";
import { RoleCode } from "@prisma/client";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("ADMIN", "MANAGER"));

function managedRole(roles: RoleCode[]): RoleCode {
  if (roles.includes("ADMIN")) return "MANAGER";
  return "SALES_EXECUTIVE";
}

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: {
        tenantId: req.auth!.tenantId,
        roles: { some: { role: { code: managedRole(req.auth!.roles) } } },
      },
      include: {
        roles: { include: { role: true } },
        teamMembers: { include: { team: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: users.map((user) => ({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        status: user.status,
        roles: user.roles.map((item) => item.role.code),
        teams: user.teamMembers.map((item) => ({ id: item.team.id, name: item.team.name })),
      })),
    });
  }),
);

const createUserSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  password: z.string().min(6),
  role: z.enum(["MANAGER", "SALES_EXECUTIVE"]).optional(),
  teamId: z.number().int().positive().optional(),
});

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    if (req.auth!.roles.includes("ADMIN")) {
      throw forbidden("Managers register themselves. Approve them under Registrations.");
    }
    const tenantId = req.auth!.tenantId;
    const roleCode = managedRole(req.auth!.roles);

    if (body.role && body.role !== roleCode) {
      throw forbidden(
        req.auth!.roles.includes("ADMIN")
          ? "Admins can only add managers, not the sales team."
          : "Managers can only add sales executives.",
      );
    }

    const exists = await prisma.user.findFirst({ where: { tenantId, phone: body.phone } });
    if (exists) {
      throw badRequest("A user with this mobile number already exists.");
    }

    const role = await prisma.role.findFirst({
      where: { tenantId, code: roleCode },
    });
    if (!role) {
      throw badRequest("Role not found.");
    }

    const user = await prisma.user.create({
      data: {
        tenantId,
        name: body.name,
        phone: body.phone,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        roles: { create: { roleId: role.id } },
        teamMembers: body.teamId ? { create: { teamId: body.teamId } } : undefined,
      },
    });

    res.status(201).json({
      success: true,
      data: { id: user.id, name: user.name, phone: user.phone },
    });
  }),
);
