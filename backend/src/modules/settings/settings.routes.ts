import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { notFound } from "../../lib/errors.js";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.auth!.tenantId },
    });
    if (!settings) {
      throw notFound("Settings not found.");
    }
    res.json({ success: true, data: settings });
  }),
);

settingsRouter.patch(
  "/live-location",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z.object({ enabled: z.boolean() }).parse(req.body);
    const settings = await prisma.tenantSettings.update({
      where: { tenantId: req.auth!.tenantId },
      data: { liveLocationEnabled: body.enabled },
    });
    res.json({
      success: true,
      data: { liveLocationEnabled: settings.liveLocationEnabled },
    });
  }),
);
