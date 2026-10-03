import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as beat from "./beat.service.js";

export const beatRouter = Router();
beatRouter.use(requireAuth, requireRole("MANAGER", "SALES_EXECUTIVE"));

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

beatRouter.get(
  "/beat",
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const forUserId = req.query.userId ? Number(req.query.userId) : undefined;
    if (date) daySchema.parse(date);
    const data = await beat.listBeat({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      date,
      forUserId: Number.isFinite(forUserId) ? forUserId : undefined,
    });
    res.json({ success: true, data });
  }),
);

beatRouter.post(
  "/beat/stops",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        userId: z.number().int().positive(),
        date: daySchema,
        leadId: z.number().int().positive().optional(),
        customerId: z.number().int().positive().optional(),
      })
      .parse(req.body);
    const data = await beat.addStop({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      ...body,
    });
    res.status(201).json({ success: true, data });
  }),
);

beatRouter.delete(
  "/beat/stops/:id",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const data = await beat.removeStop(req.auth!.tenantId, req.auth!.roles, Number(req.params.id));
    res.json({ success: true, data });
  }),
);

beatRouter.post(
  "/beat/reorder",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        userId: z.number().int().positive(),
        date: daySchema,
        stopIds: z.array(z.number().int().positive()).min(1),
      })
      .parse(req.body);
    const data = await beat.reorderStops({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      ...body,
    });
    res.json({ success: true, data });
  }),
);

beatRouter.post(
  "/beat/copy",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fromUserId: z.number().int().positive(),
        fromDate: daySchema,
        toUserId: z.number().int().positive().optional(),
        toDate: daySchema,
      })
      .parse(req.body);
    const data = await beat.copyBeat({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      ...body,
    });
    res.json({ success: true, data });
  }),
);
