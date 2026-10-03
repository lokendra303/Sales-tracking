import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { notFound } from "../../lib/errors.js";

export const devicesRouter = Router();

devicesRouter.use(requireAuth, requireRole("ADMIN", "MANAGER"));

devicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const devices = await prisma.device.findMany({
      where: { user: { tenantId: req.auth!.tenantId } },
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: { lastSeenAt: "desc" },
    });
    res.json({ success: true, data: devices });
  }),
);

devicesRouter.post(
  "/:id/deactivate",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const device = await prisma.device.findFirst({
      where: { id, user: { tenantId: req.auth!.tenantId } },
    });
    if (!device) {
      throw notFound("Device not found.");
    }

    await prisma.$transaction([
      prisma.device.update({
        where: { id },
        data: { status: "DEACTIVATED" },
      }),
      prisma.refreshToken.updateMany({
        where: { deviceId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    res.json({ success: true, data: { ok: true } });
  }),
);
