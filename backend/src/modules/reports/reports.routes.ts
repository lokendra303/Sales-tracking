import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as reports from "./reports.service.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRole("MANAGER", "SALES_EXECUTIVE"));

reportsRouter.get(
  "/targets",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const year = Number(req.query.year ?? now.getFullYear());
    const month = Number(req.query.month ?? now.getMonth() + 1);
    const data = await reports.listTargets(req.auth!.tenantId, req.auth!.userId, req.auth!.roles, year, month);
    res.json({ success: true, data });
  }),
);

reportsRouter.put(
  "/targets",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const body = z
      .object({
        userId: z.number().int().positive(),
        amount: z.number().nonnegative(),
        year: z.number().int().min(2020).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
      })
      .parse(req.body);
    const data = await reports.setTarget({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      userId: body.userId,
      year: body.year ?? now.getFullYear(),
      month: body.month ?? now.getMonth() + 1,
      amount: body.amount,
    });
    res.json({ success: true, data });
  }),
);

reportsRouter.get(
  "/reports/summary",
  asyncHandler(async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const data = await reports.personSummary(req.auth!.tenantId, req.auth!.userId, req.auth!.roles, userId);
    res.json({ success: true, data });
  }),
);

reportsRouter.get(
  "/reports/day-summary",
  asyncHandler(async (req, res) => {
    const data = await reports.daySummary(req.auth!.tenantId, req.auth!.userId, req.auth!.roles);
    res.json({ success: true, data });
  }),
);

reportsRouter.get(
  "/reports/funnel",
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days ?? 30);
    const data = await reports.funnel(req.auth!.tenantId, req.auth!.userId, req.auth!.roles, days);
    res.json({ success: true, data });
  }),
);

reportsRouter.get(
  "/reports/team",
  asyncHandler(async (req, res) => {
    const data = await reports.teamReport(req.auth!.tenantId, req.auth!.roles);
    res.json({ success: true, data });
  }),
);

reportsRouter.get(
  "/reports/export",
  asyncHandler(async (req, res) => {
    const file = await reports.exportWorkbook(req.auth!.tenantId, req.auth!.userId, req.auth!.roles);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="salestrack-report.xlsx"');
    res.send(file);
  }),
);
