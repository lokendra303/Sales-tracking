import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { changePasswordSchema, loginSchema, refreshSchema, registerSchema, setPasswordSchema } from "./auth.schema.js";
import * as authService from "./auth.service.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMIT", message: "Too many login attempts. Try later." } },
});

authRouter.post(
  "/register",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const data = await authService.register(body);
    res.status(201).json({ success: true, data });
  }),
);

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body);
    res.json({ success: true, data: result });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    const result = await authService.refresh(body.refreshToken);
    res.json({ success: true, data: result });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
    await authService.logout(refreshToken);
    res.json({ success: true, data: { ok: true } });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.auth!.userId);
    res.json({ success: true, data: user });
  }),
);

authRouter.post(
  "/change-password",
  requireAuth,
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const body = changePasswordSchema.parse(req.body);
    await authService.changeOwnPassword({
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      oldPassword: body.oldPassword,
      newPassword: body.newPassword,
    });
    res.json({ success: true, data: { ok: true } });
  }),
);

authRouter.post(
  "/set-password",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = setPasswordSchema.parse(req.body);
    await authService.setPassword(req.auth!.roles, req.auth!.tenantId, body.userId, body.password);
    res.json({ success: true, data: { ok: true } });
  }),
);
