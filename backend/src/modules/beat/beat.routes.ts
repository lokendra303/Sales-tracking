import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { forbidden } from "../../lib/errors.js";
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

beatRouter.get(
  "/beats",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const assigneeId = req.query.assigneeId ? Number(req.query.assigneeId) : undefined;
    const data = await beat.listBeats(
      req.auth!.tenantId,
      Number.isFinite(assigneeId) ? assigneeId : undefined,
    );
    res.json({ success: true, data });
  }),
);

beatRouter.post(
  "/beats",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(120),
        assigneeId: z.number().int().positive(),
        territory: z.string().max(160).optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(req.body);
    const data = await beat.createBeat({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      ...body,
    });
    res.status(201).json({ success: true, data });
  }),
);

beatRouter.patch(
  "/beats/:id",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(120).optional(),
        assigneeId: z.number().int().positive().optional(),
        active: z.boolean().optional(),
        territory: z.string().max(160).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(req.body);
    const data = await beat.updateBeat({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      id: Number(req.params.id),
      ...body,
    });
    res.json({ success: true, data });
  }),
);

beatRouter.post(
  "/beats/:id/members",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        leadId: z.number().int().positive().optional(),
        customerId: z.number().int().positive().optional(),
      })
      .parse(req.body);
    const data = await beat.addBeatMember({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      beatId: Number(req.params.id),
      ...body,
    });
    res.status(201).json({ success: true, data });
  }),
);

beatRouter.delete(
  "/beats/members/:memberId",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const data = await beat.removeBeatMember(req.auth!.tenantId, req.auth!.roles, Number(req.params.memberId));
    res.json({ success: true, data });
  }),
);

beatRouter.post(
  "/beats/:id/reorder",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z.object({ memberIds: z.array(z.number().int().positive()).min(1) }).parse(req.body);
    const data = await beat.reorderBeatMembers({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      beatId: Number(req.params.id),
      memberIds: body.memberIds,
    });
    res.json({ success: true, data });
  }),
);

beatRouter.get(
  "/beat/schedule",
  requireRole("MANAGER", "SALES_EXECUTIVE"),
  asyncHandler(async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : req.auth!.userId;
    const isMgr = req.auth!.roles.includes("MANAGER") || req.auth!.roles.includes("ADMIN");
    if (!isMgr && userId !== req.auth!.userId) throw forbidden("You can only view your own schedule.");
    const data = await beat.getSchedule(req.auth!.tenantId, userId);
    res.json({ success: true, data });
  }),
);

beatRouter.put(
  "/beat/schedule",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        userId: z.number().int().positive(),
        cycleLength: z.number().int().min(1).max(90).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        days: z.record(z.string(), z.number().int().positive().nullable()).optional(),
        week: z.record(z.string(), z.number().int().positive().nullable()).optional(),
      })
      .parse(req.body);
    const data = await beat.putSchedule({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      userId: body.userId,
      cycleLength: body.cycleLength,
      startDate: body.startDate,
      days: body.days,
      week: body.week,
    });
    res.json({ success: true, data });
  }),
);

beatRouter.get(
  "/beat/coverage/today",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const data = await beat.teamCoverageToday(req.auth!.tenantId);
    res.json({ success: true, data });
  }),
);
