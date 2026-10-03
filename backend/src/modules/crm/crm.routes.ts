import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import * as XLSX from "xlsx";
import { FollowUpType, LeadStatus, Temperature } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { geocodeAddress } from "../../lib/geocode.js";
import { badRequest, forbidden } from "../../lib/errors.js";
import * as crm from "./crm.service.js";

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

export const crmRouter = Router();
crmRouter.use(requireAuth);
crmRouter.use((req, _res, next) => {
  const path = req.path;
  const crmPath =
    path === "/home" ||
    path.startsWith("/leads") ||
    path.startsWith("/customers") ||
    path.startsWith("/follow-ups") ||
    path.startsWith("/geo");
  if (!crmPath) {
    next();
    return;
  }
  const roles = req.auth?.roles ?? [];
  const isAdminOnly = roles.includes("ADMIN") && !roles.includes("MANAGER");
  if (isAdminOnly && path !== "/home") {
    next(forbidden("Admins manage managers, not the sales team."));
    return;
  }
  next();
});

const createLeadSchema = z.object({
  name: z.string().min(2, "Enter the business name."),
  phone: z.string().min(8, "Enter a mobile number."),
  contactPerson: z.string().optional(),
  businessType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  notes: z.string().optional(),
  potential: z.number().nonnegative().optional(),
  temperature: z.enum(Temperature).optional(),
  assigneeId: z.number().int().positive().optional(),
  createAnyway: z.boolean().optional(),
  clientRequestId: z.string().min(4).max(80).optional(),
});

crmRouter.get(
  "/geo",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 3) throw badRequest("Enter an address to find on the map.");
    const data = await geocodeAddress(q);
    res.json({ success: true, data });
  }),
);

crmRouter.get(
  "/home",
  asyncHandler(async (req, res) => {
    const data = await crm.homeSummary(req.auth!.tenantId, req.auth!.userId, req.auth!.roles);
    res.json({ success: true, data });
  }),
);

crmRouter.get(
  "/leads",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const filter = typeof req.query.filter === "string" ? req.query.filter : "all";
    const rawAssignee = typeof req.query.assigneeId === "string" ? req.query.assigneeId : undefined;
    const assigneeId =
      rawAssignee === "unassigned" ? "unassigned" : rawAssignee && Number(rawAssignee) > 0 ? Number(rawAssignee) : undefined;
    const data = await crm.listLeads({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      q,
      filter,
      assigneeId,
    });
    res.json({ success: true, data });
  }),
);

crmRouter.post(
  "/leads",
  asyncHandler(async (req, res) => {
    const body = createLeadSchema.parse(req.body);
    const data = await crm.createLead({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      ...body,
    });
    res.status(201).json({ success: true, data });
  }),
);

crmRouter.post(
  "/leads/import",
  requireRole("MANAGER"),
  importUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Upload an Excel file.");
    const book = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw badRequest("The Excel file has no sheet.");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (!rows.length) throw badRequest("The first sheet is empty.");
    const data = await crm.importLeads({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      rows: rows.slice(0, 500),
    });
    res.status(201).json({ success: true, data });
  }),
);

crmRouter.get(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    const data = await crm.getLead(req.auth!.tenantId, req.auth!.userId, req.auth!.roles, Number(req.params.id));
    res.json({ success: true, data });
  }),
);

crmRouter.put(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).optional(),
        contactPerson: z.string().optional(),
        businessType: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        latitude: z.number().gte(-90).lte(90).nullable().optional(),
        longitude: z.number().gte(-180).lte(180).nullable().optional(),
        notes: z.string().optional(),
        potential: z.number().nonnegative().optional(),
        temperature: z.enum(Temperature).optional(),
        status: z.enum(LeadStatus).optional(),
      })
      .parse(req.body);
    const data = await crm.updateLead(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.roles,
      Number(req.params.id),
      body,
    );
    res.json({ success: true, data });
  }),
);

crmRouter.post(
  "/leads/:id/contacted",
  asyncHandler(async (req, res) => {
    const data = await crm.markContacted(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.roles,
      Number(req.params.id),
    );
    res.json({ success: true, data });
  }),
);

crmRouter.post(
  "/leads/:id/assign",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z.object({ userId: z.number().int().positive() }).parse(req.body);
    const data = await crm.assignLead(req.auth!.tenantId, req.auth!.roles, Number(req.params.id), body.userId);
    res.json({ success: true, data });
  }),
);

crmRouter.post(
  "/leads/:id/convert",
  asyncHandler(async (req, res) => {
    const data = await crm.convertLead(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.roles,
      Number(req.params.id),
    );
    res.json({ success: true, data });
  }),
);

crmRouter.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const data = await crm.listCustomers({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      q,
    });
    res.json({ success: true, data });
  }),
);

const followUpSchema = z.object({
  leadId: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional(),
  type: z.enum(FollowUpType),
  dueAt: z.string().min(8),
  notes: z.string().optional(),
  clientRequestId: z.string().min(4).max(80).optional(),
});

crmRouter.get(
  "/follow-ups",
  asyncHandler(async (req, res) => {
    const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const data = await crm.listFollowUps({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      scope,
    });
    res.json({ success: true, data });
  }),
);

crmRouter.post(
  "/follow-ups",
  asyncHandler(async (req, res) => {
    const body = followUpSchema.parse(req.body);
    const data = await crm.createFollowUp({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      ...body,
    });
    res.status(201).json({ success: true, data });
  }),
);

crmRouter.post(
  "/follow-ups/:id/done",
  asyncHandler(async (req, res) => {
    const data = await crm.completeFollowUp(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.roles,
      Number(req.params.id),
    );
    res.json({ success: true, data });
  }),
);
