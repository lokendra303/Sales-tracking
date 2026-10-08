import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { badRequest } from "../../lib/errors.js";
import * as visits from "./visits.service.js";

export const visitsRouter = Router();
visitsRouter.use(requireAuth, requireRole("MANAGER", "SALES_EXECUTIVE"));

const uploadDir = path.resolve(process.cwd(), "uploads", "visits");
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
      cb(badRequest("Place photo must be a camera image."));
      return;
    }
    cb(null, true);
  },
});

const gpsSchema = z.object({
  leadId: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional(),
  beatStopId: z.number().int().positive().optional(),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  accuracy: z.number().nonnegative().optional(),
});

visitsRouter.get(
  "/beat/today",
  asyncHandler(async (req, res) => {
    const data = await visits.todayBeat(req.auth!.tenantId, req.auth!.userId, req.auth!.roles);
    res.json({ success: true, data });
  }),
);

visitsRouter.get(
  "/visits",
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days ?? 14);
    const forUserId = req.query.userId ? Number(req.query.userId) : undefined;
    const data = await visits.listVisits(req.auth!.tenantId, req.auth!.userId, req.auth!.roles, days, forUserId);
    res.json({ success: true, data });
  }),
);

visitsRouter.post(
  "/visits/preview",
  asyncHandler(async (req, res) => {
    const body = gpsSchema.parse(req.body);
    const data = await visits.previewCheckin({ tenantId: req.auth!.tenantId, ...body });
    res.json({ success: true, data });
  }),
);

visitsRouter.post(
  "/visits/check-in",
  asyncHandler(async (req, res) => {
    const body = gpsSchema.extend({ checkedInAt: z.string().optional() }).parse(req.body);
    const data = await visits.checkIn({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      ...body,
    });
    res.status(201).json({ success: true, data });
  }),
);

visitsRouter.get(
  "/visits/:id",
  asyncHandler(async (req, res) => {
    const data = await visits.getVisit(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.roles,
      Number(req.params.id),
    );
    res.json({ success: true, data });
  }),
);

visitsRouter.get(
  "/visits/:id/photo",
  asyncHandler(async (req, res) => {
    const file = await visits.getPhotoPath(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.roles,
      Number(req.params.id),
    );
    res.sendFile(file);
  }),
);

visitsRouter.post(
  "/visits/:id/photo",
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest("Take a place photo with the camera.");
    }
    const extra = z
      .object({
        lat: z.coerce.number().gte(-90).lte(90).optional(),
        lng: z.coerce.number().gte(-180).lte(180).optional(),
        accuracy: z.coerce.number().nonnegative().optional(),
        capturedAt: z.string().optional(),
      })
      .parse(req.body);
    const data = await visits.savePhoto({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      visitId: Number(req.params.id),
      photoPath: req.file.path,
      ...extra,
    });
    res.json({ success: true, data });
  }),
);

visitsRouter.post(
  "/visits/:id/complete",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        outcome: z.enum(["SUCCESS", "UNAVAILABLE"]),
        notes: z.string().optional(),
        collectionAmount: z.number().nonnegative().optional(),
        checkedOutAt: z.string().optional(),
      })
      .parse(req.body);
    const data = await visits.completeVisit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      visitId: Number(req.params.id),
      ...body,
    });
    res.json({ success: true, data });
  }),
);

visitsRouter.post(
  "/visits/:id/confirm",
  asyncHandler(async (req, res) => {
    const data = await visits.confirmVisit(req.auth!.tenantId, req.auth!.roles, Number(req.params.id));
    res.json({ success: true, data });
  }),
);
