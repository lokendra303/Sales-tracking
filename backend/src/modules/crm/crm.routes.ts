import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { FollowUpType, LeadStatus, Temperature } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { searchPlaces } from "../../lib/geocode.js";
import { badRequest, forbidden } from "../../lib/errors.js";
import * as crm from "./crm.service.js";

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function rowsFromSheet(file: Express.Multer.File | undefined) {
  if (!file) throw badRequest("Upload an Excel file.");
  const sheet = crm.readLeadSheet(file.buffer);
  if (!sheet.rows.length) throw badRequest("That sheet has no shop rows.");
  return sheet;
}

function keepRowsFromBody(body: unknown) {
  const raw =
    typeof body === "object" && body && "keepRows" in body
      ? (body as { keepRows?: unknown }).keepRows
      : undefined;
  if (raw == null || raw === "") return undefined;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw badRequest("The shop list could not be read.");
    }
  }
  return z.array(z.coerce.number().int().positive()).max(500).parse(parsed);
}

function beatByNameFromBody(body: unknown) {
  const raw =
    typeof body === "object" && body && "beatByName" in body
      ? (body as { beatByName?: unknown }).beatByName
      : undefined;
  if (raw == null || raw === "") throw badRequest("Choose which beat these leads should join.");
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw badRequest("Choose which beat these leads should join.");
    }
  }
  return z.record(z.string(), z.coerce.number().int().positive()).parse(parsed);
}

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

const optionalLeadPhone = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((value) => value ?? "");

const createLeadSchema = z.object({
  name: z.string().min(2, "Enter the business name."),
  phone: optionalLeadPhone,
  contactPerson: z.string().optional(),
  businessType: z.string().optional(),
  productInterest: z.string().max(200).optional(),
  address: z.string().optional(),
  mapsLink: z.string().max(2000).optional(),
  city: z.string().optional(),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  notes: z.string().optional(),
  potential: z.number().nonnegative().optional(),
  temperature: z.enum(Temperature).optional(),
  assigneeId: z.number().int().positive().optional(),
  beatId: z.number().int().positive().optional(),
  createAnyway: z.boolean().optional(),
  clientRequestId: z.string().min(4).max(80).optional(),
});

crmRouter.get(
  "/geo",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 3) throw badRequest("Enter an address or paste a Google Maps link.");
    const data = await searchPlaces(q);
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
    const includeCreated = req.query.includeCreated === "1" || req.query.includeCreated === "true";
    const data = await crm.listLeads({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      q,
      filter,
      assigneeId,
      includeCreated,
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
  "/leads/import/preview",
  requireRole("MANAGER"),
  importUpload.single("file"),
  asyncHandler(async (req, res) => {
    const sheet = rowsFromSheet(req.file);
    const data = await crm.previewLeadImport({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      rows: sheet.rows,
    });
    res.json({ success: true, data: { ...data, sheetName: sheet.sheetName, note: sheet.note } });
  }),
);

crmRouter.post(
  "/leads/import",
  requireRole("MANAGER"),
  importUpload.single("file"),
  asyncHandler(async (req, res) => {
    const sheet = rowsFromSheet(req.file);
    const data = await crm.importLeads({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      roles: req.auth!.roles,
      rows: sheet.rows,
      beatByName: beatByNameFromBody(req.body),
      keepRows: keepRowsFromBody(req.body),
    });
    res.status(201).json({ success: true, data });
  }),
);

crmRouter.get(
  "/leads/import/places",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const data = await crm.importedBeatPlaces(req.auth!.tenantId, req.auth!.roles);
    res.json({ success: true, data });
  }),
);

crmRouter.post(
  "/leads/import/move",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fromBeatId: z.number().int().positive(),
        toBeatId: z.number().int().positive(),
      })
      .parse(req.body);
    const data = await crm.moveImportedLeads({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      ...body,
    });
    res.json({ success: true, data });
  }),
);

crmRouter.post(
  "/leads/delete",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }).parse(req.body);
    const data = await crm.deleteLeads({
      tenantId: req.auth!.tenantId,
      roles: req.auth!.roles,
      ids: body.ids,
    });
    res.json({ success: true, data });
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
        name: z.string().trim().min(2, "Enter the business name.").optional(),
        phone: z.string().trim().max(20).optional(),
        contactPerson: z.string().optional(),
        businessType: z.string().optional(),
        productInterest: z.string().max(200).nullable().optional(),
        address: z.string().optional(),
        mapsLink: z.string().max(2000).nullable().optional(),
        city: z.string().optional(),
        latitude: z.number().gte(-90).lte(90).nullable().optional(),
        longitude: z.number().gte(-180).lte(180).nullable().optional(),
        notes: z.string().optional(),
        potential: z.number().nonnegative().nullable().optional(),
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
  "/leads/:id/approval",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        decision: z.enum(["APPROVED", "REJECTED"]),
        note: z.string().max(500).optional(),
      })
      .parse(req.body);
    const data = await crm.decideLead(
      req.auth!.tenantId,
      req.auth!.userId,
      req.auth!.roles,
      Number(req.params.id),
      body.decision,
      body.note,
    );
    res.json({ success: true, data });
  }),
);

crmRouter.post(
  "/leads/:id/assign",
  requireRole("MANAGER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        /** Executive id, or null to unassign (also removes the lead from beats). */
        userId: z.number().int().positive().nullable(),
      })
      .parse(req.body);
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
