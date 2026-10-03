import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { badRequest } from "../../lib/errors.js";
import * as sales from "./sales.service.js";

export const salesRouter = Router();
salesRouter.use(requireAuth, requireRole("MANAGER", "SALES_EXECUTIVE"));

const uploadDir = path.resolve(process.cwd(), "uploads", "sales");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) {
      cb(badRequest("Bill photo must be a camera image."));
      return;
    }
    cb(null, true);
  },
});

salesRouter.get(
  "/sales",
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days ?? 30);
    const forUserId = req.query.userId ? Number(req.query.userId) : undefined;
    const data = await sales.listSales(req.auth!.tenantId, req.auth!.userId, req.auth!.roles, days, forUserId);
    res.json({ success: true, data });
  }),
);

salesRouter.post(
  "/sales",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        amount: z.number().positive(),
        collectionAmount: z.number().nonnegative().optional(),
        note: z.string().optional(),
        visitId: z.number().int().positive().optional(),
        leadId: z.number().int().positive().optional(),
        customerId: z.number().int().positive().optional(),
        clientRequestId: z.string().min(4).max(80).optional(),
      })
      .parse(req.body);
    const data = await sales.createSale({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      ...body,
    });
    res.status(201).json({ success: true, data });
  }),
);

salesRouter.get(
  "/sales/:id",
  asyncHandler(async (req, res) => {
    const data = await sales.getSale(req.auth!.tenantId, req.auth!.userId, req.auth!.roles, Number(req.params.id));
    res.json({ success: true, data });
  }),
);

salesRouter.get(
  "/sales/:id/bill",
  asyncHandler(async (req, res) => {
    const file = await sales.getBillPath(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.roles,
      Number(req.params.id),
    );
    res.sendFile(file);
  }),
);

salesRouter.post(
  "/sales/:id/bill",
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Take a bill photo with the camera.");
    const data = await sales.saveBillPhoto({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      saleId: Number(req.params.id),
      billPhotoPath: req.file.path,
    });
    res.json({ success: true, data });
  }),
);
