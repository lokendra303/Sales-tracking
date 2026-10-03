import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { badRequest } from "../../lib/errors.js";

export const teamsRouter = Router();

teamsRouter.use(requireAuth, requireRole("ADMIN", "MANAGER"));

teamsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const teams = await prisma.team.findMany({
      where: { tenantId: req.auth!.tenantId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, phone: true, status: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: teams.map((team) => ({
        id: team.id,
        name: team.name,
        members: team.members.map((member) => member.user),
      })),
    });
  }),
);

teamsRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = z.object({ name: z.string().min(2) }).parse(req.body);
    const team = await prisma.team.create({
      data: { tenantId: req.auth!.tenantId, name: body.name },
    });
    res.status(201).json({ success: true, data: team });
  }),
);

teamsRouter.post(
  "/:id/members",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const teamId = Number(req.params.id);
    const body = z.object({ userId: z.number().int().positive() }).parse(req.body);
    const tenantId = req.auth!.tenantId;

    const team = await prisma.team.findFirst({ where: { id: teamId, tenantId } });
    const user = await prisma.user.findFirst({ where: { id: body.userId, tenantId } });
    if (!team || !user) {
      throw badRequest("Team or user not found.");
    }

    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: body.userId } },
      create: { teamId, userId: body.userId },
      update: {},
    });

    res.json({ success: true, data: { ok: true } });
  }),
);
