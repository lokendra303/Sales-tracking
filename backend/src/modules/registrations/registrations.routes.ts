import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requirePlatformAdmin } from "../../middleware/auth.js";
import * as registrations from "./registrations.service.js";

export const registrationsRouter = Router();
registrationsRouter.use(requireAuth, requirePlatformAdmin);

registrationsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await registrations.listRegistrations();
    res.json({ success: true, data });
  }),
);

registrationsRouter.post(
  "/:tenantId/decide",
  asyncHandler(async (req, res) => {
    const action = z.enum(["approve", "reject"]).parse(req.body?.action);
    const data = await registrations.decideRegistration(Number(req.params.tenantId), action);
    res.json({ success: true, data });
  }),
);

registrationsRouter.post(
  "/:tenantId/active",
  asyncHandler(async (req, res) => {
    const body = z.object({ active: z.boolean() }).parse(req.body);
    const data = await registrations.setCompanyActive(Number(req.params.tenantId), body.active);
    res.json({ success: true, data });
  }),
);
