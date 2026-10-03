import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as field from "./field.service.js";

export const fieldRouter = Router();
fieldRouter.use(requireAuth, requireRole("MANAGER", "SALES_EXECUTIVE"));

const pointSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  accuracy: z.number().nonnegative().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  mocked: z.boolean().optional(),
  battery: z.number().int().min(0).max(100).optional(),
  capturedAt: z.string().optional(),
});

fieldRouter.get(
  "/field/session",
  requireRole("SALES_EXECUTIVE"),
  asyncHandler(async (req, res) => {
    const data = await field.getSession(req.auth!.tenantId, req.auth!.userId);
    res.json({ success: true, data });
  }),
);

fieldRouter.post(
  "/field/start",
  requireRole("SALES_EXECUTIVE"),
  asyncHandler(async (req, res) => {
    const data = await field.startSession(req.auth!.tenantId, req.auth!.userId, req.auth!.roles);
    res.status(201).json({ success: true, data });
  }),
);

fieldRouter.post(
  "/field/end",
  requireRole("SALES_EXECUTIVE"),
  asyncHandler(async (req, res) => {
    const data = await field.endSession(req.auth!.tenantId, req.auth!.userId, req.auth!.roles);
    res.json({ success: true, data });
  }),
);

fieldRouter.post(
  "/field/points",
  requireRole("SALES_EXECUTIVE"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        sessionId: z.number().int().positive(),
        points: z.array(pointSchema).min(1).max(50),
      })
      .parse(req.body);
    const data = await field.addPoints({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      ...body,
    });
    res.json({ success: true, data });
  }),
);

fieldRouter.get(
  "/field/team",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const data = await field.teamLocations(req.auth!.tenantId, req.auth!.roles);
    res.json({ success: true, data });
  }),
);
