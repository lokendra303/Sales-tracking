import { FollowUpType, LeadStatus, Prisma, Temperature } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { geocodeAddress, looksLikeMapsLink, parseCoord } from "../../lib/geocode.js";
import { notifyLeadAssigned, notifyLeadDecision } from "../../lib/lead-push.js";
import { parseMobile } from "../../lib/phone.js";
import { customerScope, isAdmin, isManager, leadScope, publicLead } from "./crm.helpers.js";
import type { RoleCode } from "@prisma/client";

const leadInclude = {
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  followUps: { orderBy: { dueAt: "asc" as const } },
  visits: {
    orderBy: { checkedInAt: "desc" as const },
    take: 1,
    select: { id: true, status: true, outcome: true, checkedInAt: true },
  },
  beatMembers: {
    include: {
      beat: { select: { id: true, name: true, territory: true, active: true } },
    },
    orderBy: { sequence: "asc" as const },
  },
};

/** Keep a pasted Maps URL in mapsLink, and the street text in address. */
function splitPlace(address?: string | null, mapsLink?: string | null) {
  let street = address?.trim() ?? "";
  let link = mapsLink?.trim() ?? "";
  if (street && looksLikeMapsLink(street)) {
    if (!link) link = street;
    street = "";
  }
  return {
    address: street || null,
    mapsLink: link || null,
  };
}

function requireApproved(lead: { approvalStatus: string }) {
  if (lead.approvalStatus === "PENDING") {
    throw badRequest("This lead is waiting for manager approval.");
  }
  if (lead.approvalStatus === "REJECTED") {
    throw badRequest("The manager rejected this lead.");
  }
}

export async function listLeads(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  q?: string;
  filter?: string;
  assigneeId?: number | "unassigned";
  /** Also include leads this person created, even when they are not on a beat. */
  includeCreated?: boolean;
}) {
  const personId = isManager(input.roles) && typeof input.assigneeId === "number" ? input.assigneeId : undefined;
  const managerFilter: Prisma.LeadWhereInput =
    isManager(input.roles) && input.assigneeId === "unassigned"
      ? { assigneeId: null }
      : personId && input.includeCreated
        ? { OR: [{ assigneeId: personId }, { createdById: personId }] }
        : personId
          ? { assigneeId: personId }
          : {};
  const where: Prisma.LeadWhereInput = {
    AND: [
      leadScope(input.tenantId, input.userId, input.roles),
      managerFilter,
      input.q
        ? {
            OR: [
              { name: { contains: input.q } },
              { phone: { contains: input.q } },
              { contactPerson: { contains: input.q } },
            ],
          }
        : {},
      input.filter === "pending"
        ? { approvalStatus: "PENDING" }
        : input.filter === "new"
          ? { status: { in: ["NEW", "ASSIGNED"] }, approvalStatus: "APPROVED" }
          : input.filter === "follow-up"
            ? { status: { in: ["CONTACTED", "FOLLOW_UP"] }, approvalStatus: "APPROVED" }
            : input.filter === "interested"
              ? { status: { in: ["INTERESTED", "NEGOTIATION"] }, approvalStatus: "APPROVED" }
              : input.filter === "won"
                ? { status: "WON" }
                : input.q
                  ? {}
                  : { status: { not: "LOST" }, approvalStatus: { not: "REJECTED" } },
    ],
  };

  const leads = await prisma.lead.findMany({
    where,
    include: leadInclude,
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  let customers: Awaited<ReturnType<typeof listCustomers>> = [];
  if ((!input.filter || input.filter === "all" || input.filter === "won") && input.assigneeId !== "unassigned") {
    customers = await listCustomers({
      tenantId: input.tenantId,
      userId: input.userId,
      roles: input.roles,
      q: input.q,
      ownerId: typeof input.assigneeId === "number" ? input.assigneeId : undefined,
    });
  }

  return {
    leads: leads.map(publicLead),
    customers,
  };
}

export async function getLead(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const lead = await prisma.lead.findFirst({
    where: { id, ...leadScope(tenantId, userId, roles) },
    include: {
      ...leadInclude,
      customer: true,
    },
  });
  if (!lead) {
    throw notFound("Lead not found.");
  }
  return {
    ...publicLead(lead),
    followUps: lead.followUps.map((item) => ({
      id: item.id,
      type: item.type,
      dueAt: item.dueAt,
      doneAt: item.doneAt,
      notes: item.notes,
      overdue: !item.doneAt && item.dueAt < new Date(),
    })),
    customer: lead.customer
      ? {
          id: lead.customer.id,
          name: lead.customer.name,
          phone: lead.customer.phone,
        }
      : null,
  };
}

export async function createLead(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  name: string;
  phone: string;
  contactPerson?: string;
  businessType?: string;
  productInterest?: string;
  address?: string;
  mapsLink?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  potential?: number;
  temperature?: Temperature;
  assigneeId?: number;
  /** Manager adds the shop to a beat. The beat already belongs to an HQ, and its salesperson owns the lead. */
  beatId?: number;
  createAnyway?: boolean;
  clientRequestId?: string;
}) {
  const clientRequestId = input.clientRequestId?.trim() || undefined;
  if (clientRequestId) {
    const replay = await prisma.lead.findFirst({
      where: { tenantId: input.tenantId, clientRequestId },
      include: leadInclude,
    });
    if (replay) return publicLead(replay);
  }

  const rawPhone = input.phone.trim();
  const phone = rawPhone ? parseMobile(rawPhone) : "";
  if (rawPhone && !phone) throw badRequest("Enter a 10-digit mobile number, or leave it blank.");

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: input.tenantId } });
  const existingLead = phone
    ? await prisma.lead.findFirst({
        where: { tenantId: input.tenantId, phone },
        include: { assignee: { select: { id: true, name: true } } },
      })
    : null;
  const existingCustomer = phone
    ? await prisma.customer.findFirst({
        where: { tenantId: input.tenantId, phone },
      })
    : null;

  if ((existingLead || existingCustomer) && !input.createAnyway) {
    throw conflict("A record with this phone number already exists.", {
      lead: existingLead
        ? { id: existingLead.id, name: existingLead.name, assigneeName: existingLead.assignee?.name ?? null }
        : null,
      customer: existingCustomer
        ? { id: existingCustomer.id, name: existingCustomer.name }
        : null,
    });
  }

  if ((existingLead || existingCustomer) && input.createAnyway && !settings?.allowDuplicateLeads) {
    throw badRequest("Admin does not allow duplicate leads.");
  }

  const manager = isManager(input.roles);
  let beatForLead: { id: number; assigneeId: number | null } | null = null;
  if (manager) {
    if (!input.beatId) throw badRequest("Pick a beat. Each beat already belongs to an HQ.");
    const beat = await prisma.beat.findFirst({
      where: { id: input.beatId, tenantId: input.tenantId, active: true },
      select: { id: true, assigneeId: true },
    });
    if (!beat) throw notFound("Beat not found.");
    beatForLead = beat;
  }
  const assigneeId = manager ? beatForLead?.assigneeId ?? null : input.userId;
  const status: LeadStatus = assigneeId ? "ASSIGNED" : "NEW";
  const approvalStatus = "APPROVED";
  const place = splitPlace(input.address, input.mapsLink);
  let latitude = parseCoord(input.latitude, -90, 90);
  let longitude = parseCoord(input.longitude, -180, 180);
  if ((latitude == null || longitude == null) && place.mapsLink) {
    const found = await geocodeAddress(place.mapsLink);
    latitude = found?.lat ?? latitude;
    longitude = found?.lng ?? longitude;
  }
  if ((latitude == null || longitude == null) && (place.address || input.city)) {
    const found = await geocodeAddress([place.address, input.city].filter(Boolean).join(", "));
    latitude = found?.lat;
    longitude = found?.lng;
  }

  const lead = await prisma.lead.create({
    data: {
      tenantId: input.tenantId,
      name: input.name.trim(),
      phone,
      contactPerson: input.contactPerson,
      businessType: input.businessType,
      productInterest: input.productInterest?.trim() || null,
      address: place.address,
      mapsLink: place.mapsLink,
      city: input.city,
      latitude,
      longitude,
      notes: input.notes,
      potential: input.potential,
      temperature: input.temperature ?? "WARM",
      source: manager ? "MANAGER" : "MANUAL",
      status,
      approvalStatus,
      assigneeId,
      createdById: input.userId,
      clientRequestId,
    },
    include: leadInclude,
  });

  if (beatForLead) {
    const last = await prisma.beatMember.findFirst({
      where: { beatId: beatForLead.id },
      orderBy: { sequence: "desc" },
    });
    await prisma.beatMember.create({
      data: {
        beatId: beatForLead.id,
        leadId: lead.id,
        sequence: (last?.sequence ?? 0) + 1,
      },
    });
  }

  if (assigneeId && assigneeId !== input.userId) {
    notifyLeadAssigned(assigneeId, { id: lead.id, name: lead.name });
  }

  return publicLead(lead);
}

function headerKey(key: string) {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isShopHeader(key: string) {
  return (
    key === "retailername" ||
    key === "retailer" ||
    key.includes("retailer") ||
    key.includes("salon") ||
    key.includes("outlet") ||
    key.includes("parlour") ||
    key.includes("parlor") ||
    key === "shopname" ||
    key === "partyname" ||
    key === "customername" ||
    key === "firmname" ||
    key === "dealername"
  );
}

function isPhoneHeader(key: string) {
  if (key.includes("stockist")) return false;
  return (
    key === "phone" ||
    key === "phoneno" ||
    key === "mobileno" ||
    key === "contactno" ||
    key === "mobile" ||
    /^mobile\d+$/.test(key) ||
    key.includes("mobile") ||
    key.includes("phone") ||
    key.includes("contactnumber") ||
    key.includes("whatsapp")
  );
}

function scoreHeaderRow(row: unknown) {
  if (!Array.isArray(row)) return 0;
  const keys = row.map((item) => headerKey(String(item ?? ""))).filter(Boolean);
  let score = 0;
  if (keys.some(isShopHeader)) score += 10;
  if (keys.some(isPhoneHeader)) score += 6;
  if (keys.some((key) => key === "beatname" || key === "beat")) score += 2;
  if (keys.some((key) => key.includes("address"))) score += 2;
  return score;
}

/** Pick the tab that lists shops. Beat-plan files keep the route list on the first tab and the shops on another. */
export function readLeadSheet(buffer: Buffer) {
  const book = XLSX.read(buffer, { type: "buffer" });
  if (!book.SheetNames.length) throw badRequest("The Excel file has no sheet.");

  let best: { name: string; headerIndex: number; score: number; dataRows: number } | null = null;
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
    let headerIndex = 0;
    let score = 0;
    for (let i = 0; i < Math.min(matrix.length, 8); i++) {
      const rowScore = scoreHeaderRow(matrix[i]);
      if (rowScore > score) {
        score = rowScore;
        headerIndex = i;
      }
    }
    const dataRows = Math.max(0, matrix.length - headerIndex - 1);
    if (!best || score > best.score || (score === best.score && dataRows > best.dataRows)) {
      best = { name, headerIndex, score, dataRows };
    }
  }

  if (!best || best.score < 10) {
    throw badRequest(
      best && best.score >= 2
        ? "This tab lists beats, not shops. Shop names and mobiles are on the other tab of the same file. Upload it again and that tab will be used."
        : "No shop list found. The sheet needs a retailer or salon name and a mobile number.",
    );
  }

  const sheet = book.Sheets[best.name];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const rows: Record<string, unknown>[] = [];
  let headers: string[] | null = null;
  let truncated = false;
  for (let index = 0; index < matrix.length; index++) {
    const line = matrix[index];
    if (!Array.isArray(line)) continue;
    const labels = line.map((cell) => headerKey(String(cell ?? "")));
    const headerRow =
      labels.includes("retailername") ||
      (labels.includes("beatname") && labels.some((key) => key.includes("address") || key.includes("mobile") || key === "speciality"));
    if (headerRow) {
      const used = new Map<string, number>();
      headers = line.map((cell, cellIndex) => {
        const label = String(cell ?? "").trim() || `Column ${cellIndex + 1}`;
        const count = used.get(label) ?? 0;
        used.set(label, count + 1);
        return count === 0 ? label : `${label}_${count}`;
      });
      continue;
    }
    if (!headers) continue;
    if (rows.length >= 2000) {
      truncated = true;
      break;
    }
    const record: Record<string, unknown> = { __excelRow: index + 1 };
    headers.forEach((header, cellIndex) => {
      record[header] = line[cellIndex] ?? "";
    });
    rows.push(record);
  }
  const skippedBeatTab = book.SheetNames.length > 1 && book.SheetNames[0] !== best.name;
  const notes = [
    skippedBeatTab ? `Shops are read from “${best.name.trim()}”. The first tab only lists beats, so it was skipped.` : "",
    truncated ? "Only the first 2000 shops were read." : "",
  ].filter(Boolean);
  return {
    rows,
    sheetName: best.name.trim() || "Sheet",
    note: notes.join(" "),
  };
}

function textValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  if (value == null) return "";
  return String(value).trim();
}

function cell(row: Record<string, unknown>, keys: string[], loose: string[] = []) {
  const entries = Object.entries(row).filter(([key]) => key !== "__excelRow");
  for (const key of keys) {
    const match = entries.find(([item]) => headerKey(item) === key);
    if (!match) continue;
    const text = textValue(match[1]);
    if (text) return text;
  }
  for (const hint of loose) {
    const match = entries.find(([item]) => headerKey(item).includes(hint));
    if (!match) continue;
    const text = textValue(match[1]);
    if (text) return text;
  }
  return "";
}

/** Accept a 10-digit mobile, or 91 / leading 0 in front of one. */
function flexibleMobile(raw: string) {
  if (!raw || /[a-z@]/i.test(raw)) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return digits;
}

function mobileFromRow(row: Record<string, unknown>) {
  const raws: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    const norm = headerKey(key);
    if (!isPhoneHeader(norm)) continue;
    const raw = textValue(value);
    if (raw) raws.push(raw);
  }
  for (const raw of raws) {
    const phone = flexibleMobile(raw);
    if (phone) return { phone, raw };
  }
  return { phone: "", raw: raws[0] ?? "" };
}

function sheetNotes(row: Record<string, unknown>) {
  const parts: string[] = [];
  const add = (label: string, keys: string[]) => {
    const value = cell(row, keys);
    if (value) parts.push(`${label}: ${value}`);
  };
  add("State", ["state"]);
  add("HQ", ["hqname", "hq"]);
  add("MSL", ["mslno", "msl"]);
  add("Email", ["emailid", "email"]);
  add("DOB", ["dob", "dateofbirth"]);
  add("Anniversary", ["anniversarydate", "anniversary"]);
  add("Store opening", ["storeopeningdate", "openingdate"]);
  const written = cell(row, ["notes", "note", "remark"]);
  if (written) parts.push(written);
  return parts.join("\n");
}

type ParsedImportRow = {
  row: number;
  name: string;
  phone: string;
  rawPhone: string;
  contactPerson: string;
  businessType: string;
  address: string;
  city: string;
  notes: string;
  potential?: number;
  mapsLink: string;
  latitude: number | null;
  longitude: number | null;
  beatName: string;
  hqName: string;
  ready: boolean;
  reason: string;
  blank: boolean;
};

function parseImportRow(raw: Record<string, unknown>, index: number): ParsedImportRow {
  const excelRow = raw.__excelRow;
  const rowNumber = typeof excelRow === "number" ? excelRow : index + 2;
  const name = cell(
    raw,
    ["retailername", "retailer", "shopname", "businessname", "outletname", "partyname", "customername", "firmname", "dealername", "name", "shop", "business"],
    ["retailer", "salon", "outlet", "parlour", "parlor"],
  );
  const { phone, raw: rawPhone } = mobileFromRow(raw);
  const beatName = cell(raw, ["beatname", "beat"]);
  const hqName = cell(raw, ["hqname", "hq"]);
  const contactPerson =
    cell(raw, ["contactpersonname", "contactperson", "person", "ownername"]) ||
    cell(raw, ["storemgrname", "storemanager", "managername"]);
  const businessType = cell(raw, ["speciality", "specialty", "businesstype", "type"]) || cell(raw, ["category"]);
  const street = cell(raw, ["completeaddress", "address", "fulladdress"]);
  const pin = cell(raw, ["pincode", "pin", "postalcode", "zip", "zipcode"]);
  const address = [street, pin].filter(Boolean).join(", ");
  const city = cell(raw, ["cityname", "city", "town", "citytown"], ["city"]);
  const mapsLink = cell(raw, ["mapslink", "googlemapslink", "maplink", "mapsurl", "googlemaps"]);
  const latitude = parseCoord(cell(raw, ["latitude", "lat"]), -90, 90) ?? null;
  const longitude = parseCoord(cell(raw, ["longitude", "lng", "lon"]), -180, 180) ?? null;
  const potentialRaw = cell(raw, ["avgsales", "potential", "value", "amount"]);
  const potentialNum = potentialRaw ? Number(potentialRaw.replace(/[^\d.]/g, "")) : undefined;
  const repeatedHeader = headerKey(name) === "retailername" || headerKey(beatName) === "beatname";
  const blank = repeatedHeader || (!name && !phone && !rawPhone && !beatName && !street && !city);
  const phoneNote = !blank && rawPhone && !phone ? `Mobile on sheet: ${rawPhone}` : "";
  const notes = [sheetNotes(raw), phoneNote].filter(Boolean).join("\n");
  let reason = "";
  if (!blank && !name) reason = "Retailer name is missing.";
  return {
    row: rowNumber,
    name,
    phone,
    rawPhone,
    contactPerson,
    businessType,
    address,
    city,
    notes,
    potential: potentialNum && Number.isFinite(potentialNum) ? potentialNum : undefined,
    mapsLink,
    latitude,
    longitude,
    beatName,
    hqName,
    ready: !blank && !reason,
    reason,
    blank,
  };
}

async function markImportDuplicates(tenantId: number, rows: ParsedImportRow[]) {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.ready || !row.phone) return row;
    if (seen.has(row.phone)) {
      return {
        ...row,
        phone: "",
        notes: [`Mobile on sheet: ${row.phone}`, row.notes].filter(Boolean).join("\n"),
      };
    }
    seen.add(row.phone);
    return row;
  });
}

function publicImportRow(row: ParsedImportRow) {
  return {
    row: row.row,
    name: row.name,
    phone: row.phone,
    rawPhone: row.rawPhone,
    contactPerson: row.contactPerson,
    businessType: row.businessType,
    address: row.address,
    city: row.city,
    beatName: row.beatName,
    hqName: row.hqName,
    ready: row.ready,
    reason: row.reason,
  };
}

export async function previewLeadImport(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  rows: Record<string, unknown>[];
}) {
  if (!isManager(input.roles)) throw forbidden("Only managers import leads.");
  const parsed = await markImportDuplicates(
    input.tenantId,
    input.rows.map(parseImportRow).filter((row) => !row.blank),
  );
  return {
    rows: parsed.map(publicImportRow),
    ready: parsed.filter((row) => row.ready).length,
    skipped: parsed.filter((row) => !row.ready).length,
  };
}

export async function importLeads(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  rows: Record<string, unknown>[];
  beatByName?: Record<string, number>;
  hqId?: number;
  keepRows?: number[];
}) {
  if (!isManager(input.roles)) {
    throw forbidden("Only managers import leads.");
  }
  const parsed = await markImportDuplicates(
    input.tenantId,
    input.rows.map(parseImportRow).filter((row) => !row.blank),
  );
  const created: ReturnType<typeof publicLead>[] = [];
  const skipped: { row: number; name: string; phone: string; reason: string }[] = [];
  const sequence = new Map<number, number>();
  const keep = input.keepRows ? new Set(input.keepRows) : null;
  const beatByName = input.beatByName ?? {};
  const beatById = new Map<number, { id: number; assigneeId: number | null }>();
  const beatIdBySheetName = new Map<string, number>();
  let beatsCreated = 0;

  const wantedNames = [
    ...new Set(
      parsed
        .filter((row) => row.ready && row.beatName.trim() && (!keep || keep.has(row.row)))
        .map((row) => row.beatName.trim()),
    ),
  ];

  if (input.hqId) {
    const hq = await prisma.hq.findFirst({ where: { id: input.hqId, tenantId: input.tenantId } });
    if (!hq) throw notFound("HQ not found.");
    if (!wantedNames.length) throw badRequest("The sheet has no beat names, so no beats were created.");
    const existing = await prisma.beat.findMany({
      where: { tenantId: input.tenantId, hqId: hq.id, active: true },
      select: { id: true, name: true, assigneeId: true },
    });
    const byName = new Map(existing.map((beat) => [beat.name.trim().toLowerCase(), beat]));
    for (const beatName of wantedNames) {
      const name = beatName.slice(0, 120);
      const key = name.toLowerCase();
      let beat = byName.get(key);
      if (!beat) {
        beat = await prisma.beat.create({
          data: { tenantId: input.tenantId, name, hqId: hq.id, territory: hq.name },
          select: { id: true, name: true, assigneeId: true },
        });
        byName.set(key, beat);
        beatsCreated += 1;
      }
      beatById.set(beat.id, beat);
      beatIdBySheetName.set(beatName, beat.id);
      beatIdBySheetName.set(name, beat.id);
    }
  } else {
    const beatIds = [...new Set(Object.values(beatByName))];
    if (!beatIds.length) throw badRequest("Choose the headquarters these beats should join.");
    const beats = await prisma.beat.findMany({
      where: { tenantId: input.tenantId, id: { in: beatIds }, active: true },
      select: { id: true, assigneeId: true },
    });
    if (beats.length !== beatIds.length) throw badRequest("One of the selected beats was not found.");
    for (const beat of beats) beatById.set(beat.id, beat);
    for (const [name, id] of Object.entries(beatByName)) beatIdBySheetName.set(name, id);
  }

  const memberRows = beatById.size
    ? await prisma.beatMember.findMany({
        where: { beatId: { in: [...beatById.keys()] }, leadId: { not: null } },
        select: { beatId: true, lead: { select: { name: true, phone: true } } },
      })
    : [];
  const placed = new Map<number, { phones: Set<string>; names: Set<string> }>();
  for (const member of memberRows) {
    const bucket = placed.get(member.beatId) ?? { phones: new Set<string>(), names: new Set<string>() };
    const phone = (member.lead?.phone ?? "").trim();
    const name = (member.lead?.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (phone) bucket.phones.add(phone);
    if (name) bucket.names.add(name);
    placed.set(member.beatId, bucket);
  }
  let already = 0;

  for (const row of parsed) {
    if (keep && !keep.has(row.row)) {
      skipped.push({
        row: row.row,
        name: row.name,
        phone: row.rawPhone || row.phone,
        reason: "You removed this shop before adding.",
      });
      continue;
    }
    if (!row.ready) {
      skipped.push({ row: row.row, name: row.name, phone: row.rawPhone || row.phone, reason: row.reason });
      continue;
    }
    const beatId = beatIdBySheetName.get(row.beatName) ?? beatIdBySheetName.get(row.beatName.trim());
    const beat = beatId ? beatById.get(beatId) : undefined;
    if (!beat) {
      skipped.push({
        row: row.row,
        name: row.name,
        phone: row.phone,
        reason: row.beatName ? `No beat for ${row.beatName}, so this shop was not added.` : "No beat for this shop, so it was not added.",
      });
      continue;
    }

    const bucket = placed.get(beat.id) ?? { phones: new Set<string>(), names: new Set<string>() };
    placed.set(beat.id, bucket);
    const nameKey = row.name.trim().toLowerCase().replace(/\s+/g, " ");
    if ((row.phone && bucket.phones.has(row.phone)) || (nameKey && bucket.names.has(nameKey))) {
      already += 1;
      continue;
    }

    const place = splitPlace(row.address, row.mapsLink);
    let latitude = row.latitude;
    let longitude = row.longitude;
    if ((latitude == null || longitude == null) && place.mapsLink) {
      const found = await geocodeAddress(place.mapsLink);
      latitude = found?.lat ?? latitude;
      longitude = found?.lng ?? longitude;
    }
    const assigneeId = beat.assigneeId;
    if (row.phone) {
      const existing = await prisma.lead.findFirst({
        where: { tenantId: input.tenantId, phone: row.phone },
        select: { id: true, name: true },
      });
      if (existing) {
        if (!sequence.has(beat.id)) {
          const last = await prisma.beatMember.findFirst({
            where: { beatId: beat.id },
            orderBy: { sequence: "desc" },
          });
          sequence.set(beat.id, last?.sequence ?? 0);
        }
        const next = (sequence.get(beat.id) ?? 0) + 1;
        sequence.set(beat.id, next);
        await prisma.beatMember.create({
          data: { beatId: beat.id, leadId: existing.id, sequence: next },
        });
        bucket.phones.add(row.phone);
        const existingName = existing.name.trim().toLowerCase().replace(/\s+/g, " ");
        if (existingName) bucket.names.add(existingName);
        if (nameKey) bucket.names.add(nameKey);
        created.push(publicLead(await prisma.lead.findFirstOrThrow({ where: { id: existing.id }, include: leadInclude })));
        continue;
      }
    }
    const lead = await prisma.lead.create({
      data: {
        tenantId: input.tenantId,
        name: row.name,
        phone: row.phone,
        contactPerson: row.contactPerson || undefined,
        businessType: row.businessType || undefined,
        address: place.address,
        mapsLink: place.mapsLink,
        city: row.city || undefined,
        latitude,
        longitude,
        notes: row.notes || undefined,
        potential: row.potential,
        temperature: "WARM",
        source: "IMPORT",
        status: assigneeId ? "ASSIGNED" : "NEW",
        approvalStatus: "APPROVED",
        assigneeId,
        createdById: input.userId,
      },
      include: leadInclude,
    });
    if (!sequence.has(beat.id)) {
      const last = await prisma.beatMember.findFirst({
        where: { beatId: beat.id },
        orderBy: { sequence: "desc" },
      });
      sequence.set(beat.id, last?.sequence ?? 0);
    }
    const next = (sequence.get(beat.id) ?? 0) + 1;
    sequence.set(beat.id, next);
    await prisma.beatMember.create({
      data: { beatId: beat.id, leadId: lead.id, sequence: next },
    });
    created.push(publicLead(lead));
    if (row.phone) bucket.phones.add(row.phone);
    if (nameKey) bucket.names.add(nameKey);
    if (assigneeId && assigneeId !== input.userId) {
      notifyLeadAssigned(assigneeId, { id: lead.id, name: lead.name });
    }
  }

  return {
    created: created.length,
    skipped: skipped.length,
    beatsCreated,
    already,
    same: created.length === 0 && beatsCreated === 0 && already > 0,
    leads: created,
    errors: skipped,
  };
}

export async function importedBeatPlaces(tenantId: number, roles: RoleCode[]) {
  if (!isManager(roles)) throw forbidden("Only a manager can see imported shops.");
  const members = await prisma.beatMember.findMany({
    where: { lead: { tenantId, source: "IMPORT" } },
    select: { beat: { select: { id: true, name: true, hq: { select: { name: true } } } } },
  });
  const counts = new Map<number, { beatName: string; hq: string | null; count: number }>();
  for (const member of members) {
    const current = counts.get(member.beat.id) ?? {
      beatName: member.beat.name,
      hq: member.beat.hq?.name ?? null,
      count: 0,
    };
    current.count += 1;
    counts.set(member.beat.id, current);
  }
  return [...counts.entries()]
    .map(([beatId, row]) => ({ beatId, ...row }))
    .sort((a, b) => a.beatName.localeCompare(b.beatName));
}

/** Move every Excel-imported shop from one beat to another. Hand-added shops stay put. */
export async function moveImportedLeads(input: {
  tenantId: number;
  roles: RoleCode[];
  fromBeatId: number;
  toBeatId: number;
}) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can move imported shops.");
  if (input.fromBeatId === input.toBeatId) throw badRequest("Pick a different beat.");
  const beats = await prisma.beat.findMany({
    where: { tenantId: input.tenantId, id: { in: [input.fromBeatId, input.toBeatId] }, active: true },
    select: { id: true, assigneeId: true, name: true },
  });
  const from = beats.find((beat) => beat.id === input.fromBeatId);
  const to = beats.find((beat) => beat.id === input.toBeatId);
  if (!from || !to) throw notFound("Beat not found.");

  const members = await prisma.beatMember.findMany({
    where: { beatId: from.id, lead: { tenantId: input.tenantId, source: "IMPORT" }, leadId: { not: null } },
    select: { id: true, leadId: true },
  });
  if (!members.length) throw badRequest("That beat has no imported shops.");
  const leadIds = members.map((member) => member.leadId).filter((id): id is number => id != null);
  const already = await prisma.beatMember.findMany({
    where: { beatId: to.id, leadId: { in: leadIds } },
    select: { leadId: true },
  });
  const alreadyIds = new Set(already.map((row) => row.leadId));
  const last = await prisma.beatMember.findFirst({
    where: { beatId: to.id },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  let sequence = last?.sequence ?? 0;
  for (const member of members) {
    if (member.leadId != null && alreadyIds.has(member.leadId)) {
      await prisma.beatMember.delete({ where: { id: member.id } });
      continue;
    }
    sequence += 1;
    await prisma.beatMember.update({ where: { id: member.id }, data: { beatId: to.id, sequence } });
  }
  await prisma.lead.updateMany({
    where: { id: { in: leadIds }, tenantId: input.tenantId },
    data: { assigneeId: to.assigneeId },
  });
  return { moved: leadIds.length, from: from.name, to: to.name };
}

export async function deleteLeads(input: { tenantId: number; roles: RoleCode[]; ids: number[] }) {
  if (!isManager(input.roles)) throw forbidden("Only a manager can delete leads.");
  const ids = [...new Set(input.ids.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 500);
  if (!ids.length) throw badRequest("Select at least one lead.");
  const found = await prisma.lead.findMany({
    where: { tenantId: input.tenantId, id: { in: ids } },
    select: { id: true },
  });
  const leadIds = found.map((lead) => lead.id);
  if (!leadIds.length) throw notFound("Those leads were not found.");
  await prisma.$transaction([
    prisma.followUp.deleteMany({ where: { leadId: { in: leadIds } } }),
    prisma.beatMember.deleteMany({ where: { leadId: { in: leadIds } } }),
    prisma.sale.updateMany({ where: { leadId: { in: leadIds } }, data: { leadId: null } }),
    prisma.visit.updateMany({ where: { leadId: { in: leadIds } }, data: { leadId: null } }),
    prisma.beatStop.updateMany({ where: { leadId: { in: leadIds } }, data: { leadId: null } }),
    prisma.lead.deleteMany({ where: { tenantId: input.tenantId, id: { in: leadIds } } }),
  ]);
  return { deleted: leadIds.length };
}

export async function updateLead(
  tenantId: number,
  userId: number,
  roles: RoleCode[],
  id: number,
  data: {
    name?: string;
    phone?: string;
    contactPerson?: string;
    businessType?: string;
    productInterest?: string | null;
    address?: string;
    mapsLink?: string | null;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    notes?: string;
    potential?: number | null;
    temperature?: Temperature;
    status?: LeadStatus;
  },
) {
  const current = await getLead(tenantId, userId, roles, id);
  if (data.status && current.approvalStatus !== "APPROVED") {
    requireApproved(current);
  }
  if (data.phone !== undefined && data.phone !== current.phone) {
    if (!isManager(roles)) throw forbidden("Only a manager can change the phone number.");
    const rawPhone = data.phone.trim();
    const phone = rawPhone ? parseMobile(rawPhone) : "";
    if (rawPhone && !phone) throw badRequest("Enter a 10-digit mobile number, or leave it blank.");
    data.phone = phone;
    if (phone) {
      const taken = await prisma.lead.findFirst({ where: { tenantId, phone, id: { not: id } } });
      if (taken) throw conflict(`Another lead already uses this phone: ${taken.name}.`);
    }
  }
  if ((data.latitude == null) !== (data.longitude == null)) {
    throw badRequest("Set both latitude and longitude for the shop pin.");
  }
  const patch: typeof data = { ...data };
  if (data.address !== undefined || data.mapsLink !== undefined) {
    const street = data.address !== undefined ? data.address : undefined;
    const link = data.mapsLink !== undefined ? data.mapsLink : undefined;
    if (street && looksLikeMapsLink(street) && !String(link ?? "").trim()) {
      patch.mapsLink = street.trim();
      patch.address = "";
    } else {
      if (data.address !== undefined) patch.address = data.address.trim();
      if (data.mapsLink !== undefined) patch.mapsLink = data.mapsLink?.trim() || null;
    }
  }
  if (patch.mapsLink && patch.latitude === undefined && patch.longitude === undefined) {
    const found = await geocodeAddress(patch.mapsLink);
    if (found) {
      patch.latitude = found.lat;
      patch.longitude = found.lng;
    }
  }
  const lead = await prisma.lead.update({
    where: { id },
    data: patch,
    include: leadInclude,
  });
  return publicLead(lead);
}

export async function markContacted(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const lead = await prisma.lead.findFirst({ where: { id, ...leadScope(tenantId, userId, roles) } });
  if (!lead) {
    throw notFound("Lead not found.");
  }
  requireApproved(lead);
  if (lead.status === "NEW" || lead.status === "ASSIGNED") {
    const updated = await prisma.lead.update({
      where: { id },
      data: { status: "CONTACTED" },
      include: leadInclude,
    });
    return publicLead(updated);
  }
  return getLead(tenantId, userId, roles, id);
}

/** Drop beat seats that no longer match the lead’s assignee (avoids route vs owner conflict). */
async function syncLeadOutOfConflictingBeats(tenantId: number, leadId: number, assigneeId: number | null) {
  const members = await prisma.beatMember.findMany({
    where: { leadId, beat: { tenantId } },
    include: { beat: { select: { id: true, assigneeId: true, name: true } } },
  });
  const toRemove = members.filter((row) => assigneeId == null || row.beat.assigneeId !== assigneeId);
  if (!toRemove.length) return [] as string[];

  const beatIds = [...new Set(toRemove.map((row) => row.beat.id))];
  await prisma.beatMember.deleteMany({ where: { id: { in: toRemove.map((row) => row.id) } } });
  for (const beatId of beatIds) {
    const rest = await prisma.beatMember.findMany({ where: { beatId }, orderBy: { sequence: "asc" } });
    await Promise.all(
      rest.map((item, index) => prisma.beatMember.update({ where: { id: item.id }, data: { sequence: index + 1 } })),
    );
  }
  return [...new Set(toRemove.map((row) => row.beat.name))];
}

export async function assignLead(
  tenantId: number,
  roles: RoleCode[],
  id: number,
  assigneeId: number | null,
) {
  if (!isManager(roles)) {
    throw forbidden();
  }
  if (assigneeId != null) {
    const user = await prisma.user.findFirst({
      where: { id: assigneeId, tenantId, status: "ACTIVE", roles: { some: { role: { code: "SALES_EXECUTIVE" } } } },
    });
    if (!user) {
      throw badRequest("Salesperson not found.");
    }
  }
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) {
    throw notFound("Lead not found.");
  }

  const removedFrom = await syncLeadOutOfConflictingBeats(tenantId, id, assigneeId);

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      assigneeId,
      status: assigneeId == null ? lead.status : lead.status === "NEW" ? "ASSIGNED" : lead.status,
    },
    include: leadInclude,
  });
  if (assigneeId != null && lead.assigneeId !== assigneeId) {
    notifyLeadAssigned(assigneeId, { id: updated.id, name: updated.name });
  }

  const leadOut = publicLead(updated);
  if (!removedFrom.length) return leadOut;
  return {
    ...leadOut,
    beatNotice:
      assigneeId == null
        ? `Removed from beat${removedFrom.length > 1 ? "s" : ""}: ${removedFrom.join(", ")}.`
        : `Removed from other beat${removedFrom.length > 1 ? "s" : ""} so this lead matches the new executive: ${removedFrom.join(", ")}.`,
  };
}

export async function decideLead(
  tenantId: number,
  userId: number,
  roles: RoleCode[],
  id: number,
  decision: "APPROVED" | "REJECTED",
  note?: string,
) {
  if (!isManager(roles)) {
    throw forbidden("Only a manager can approve leads.");
  }
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) {
    throw notFound("Lead not found.");
  }
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      approvalStatus: decision,
      approvedById: userId,
      approvedAt: new Date(),
      rejectionNote: decision === "REJECTED" ? note?.trim() || null : null,
    },
    include: leadInclude,
  });
  if (lead.approvalStatus !== decision) {
    const told = new Set([lead.createdById, lead.assigneeId].filter((item): item is number => item != null && item !== userId));
    for (const person of told) notifyLeadDecision(person, { id: updated.id, name: updated.name }, decision === "APPROVED");
  }
  return publicLead(updated);
}

export async function convertLead(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const lead = await prisma.lead.findFirst({
    where: { id, ...leadScope(tenantId, userId, roles) },
  });
  if (!lead) {
    throw notFound("Lead not found.");
  }
  requireApproved(lead);
  if (lead.customerId) {
    throw badRequest("This lead is already a customer.");
  }

  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone: lead.phone },
  });
  if (existing) {
    const updated = await prisma.lead.update({
      where: { id },
      data: { status: "WON", customerId: existing.id },
      include: leadInclude,
    });
    return { lead: publicLead(updated), customer: existing };
  }

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      name: lead.name,
      phone: lead.phone,
      contactPerson: lead.contactPerson,
      businessType: lead.businessType,
      address: lead.address,
      city: lead.city,
      latitude: lead.latitude,
      longitude: lead.longitude,
      notes: lead.notes,
      ownerId: lead.assigneeId ?? userId,
    },
  });

  const updated = await prisma.lead.update({
    where: { id },
    data: { status: "WON", customerId: customer.id },
    include: leadInclude,
  });

  return { lead: publicLead(updated), customer };
}

export async function listCustomers(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  q?: string;
  ownerId?: number;
}) {
  const where: Prisma.CustomerWhereInput = {
    ...customerScope(input.tenantId, input.userId, input.roles),
    ...(isManager(input.roles) && input.ownerId ? { ownerId: input.ownerId } : {}),
  };
  if (input.q) {
    where.AND = [
      {
        OR: [
          { name: { contains: input.q } },
          { phone: { contains: input.q } },
          { contactPerson: { contains: input.q } },
        ],
      },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: { owner: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return customers.map((item) => ({
    id: item.id,
    kind: "customer" as const,
    name: item.name,
    phone: item.phone,
    contactPerson: item.contactPerson,
    address: item.address,
    city: item.city,
    ownerName: item.owner?.name ?? null,
  }));
}

export async function createFollowUp(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  leadId?: number;
  customerId?: number;
  type: FollowUpType;
  dueAt: string;
  notes?: string;
  clientRequestId?: string;
}) {
  const clientRequestId = input.clientRequestId?.trim() || undefined;
  if (clientRequestId) {
    const replay = await prisma.followUp.findFirst({
      where: { tenantId: input.tenantId, clientRequestId },
      include: { lead: { select: { name: true } }, customer: { select: { name: true } } },
    });
    if (replay) {
      return publicFollowUp({
        ...replay,
        lead: replay.lead ? { id: replay.leadId!, name: replay.lead.name } : null,
        customer: replay.customer ? { id: replay.customerId!, name: replay.customer.name } : null,
      });
    }
  }

  if (!input.leadId && !input.customerId) {
    throw badRequest("Choose a lead or customer.");
  }

  if (input.leadId) {
    const lead = await getLead(input.tenantId, input.userId, input.roles, input.leadId);
    requireApproved(lead);
  }

  const followUp = await prisma.followUp.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      leadId: input.leadId,
      customerId: input.customerId,
      type: input.type,
      dueAt: new Date(input.dueAt),
      notes: input.notes,
      clientRequestId,
    },
    include: { lead: { select: { name: true } }, customer: { select: { name: true } } },
  });

  if (input.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
    if (lead && lead.status !== "WON" && lead.status !== "LOST") {
      await prisma.lead.update({
        where: { id: input.leadId },
        data: { status: "FOLLOW_UP" },
      });
    }
  }

  return publicFollowUp(followUp);
}

export async function listFollowUps(input: {
  tenantId: number;
  userId: number;
  roles: RoleCode[];
  scope?: string;
}) {
  const where: Prisma.FollowUpWhereInput = { tenantId: input.tenantId };
  if (!isManager(input.roles)) {
    where.userId = input.userId;
  }

  const now = new Date();
  if (input.scope === "done") {
    where.doneAt = { not: null };
  } else if (input.scope === "overdue") {
    where.doneAt = null;
    where.dueAt = { lt: now };
  } else if (input.scope === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    where.doneAt = null;
    where.dueAt = { gte: start, lte: end };
  } else if (input.scope === "upcoming") {
    where.doneAt = null;
    where.dueAt = { gte: now };
  } else {
    where.doneAt = null;
  }

  const rows = await prisma.followUp.findMany({
    where,
    include: { lead: { select: { id: true, name: true, phone: true } }, customer: { select: { id: true, name: true, phone: true } } },
    orderBy: { dueAt: "asc" },
    take: 80,
  });
  return rows.map(publicFollowUp);
}

export async function completeFollowUp(tenantId: number, userId: number, roles: RoleCode[], id: number) {
  const where: Prisma.FollowUpWhereInput = { id, tenantId };
  if (!isManager(roles)) {
    where.userId = userId;
  }
  const row = await prisma.followUp.findFirst({ where });
  if (!row) {
    throw notFound("Follow-up not found.");
  }
  const updated = await prisma.followUp.update({
    where: { id },
    data: { doneAt: new Date() },
    include: { lead: { select: { id: true, name: true, phone: true } }, customer: { select: { id: true, name: true, phone: true } } },
  });
  return publicFollowUp(updated);
}

export async function homeSummary(tenantId: number, userId: number, roles: RoleCode[]) {
  if (isAdmin(roles) && !isManager(roles)) {
    return { todayLeads: 0, overdueFollowUps: 0, upcoming: [] };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const leadWhere = leadScope(tenantId, userId, roles);
  const followWhere: Prisma.FollowUpWhereInput = { tenantId, doneAt: null };
  if (!isManager(roles)) {
    followWhere.userId = userId;
  }

  const visitWhere = isManager(roles) ? { tenantId } : { tenantId, userId };

  const saleWhere = isManager(roles) ? { tenantId } : { tenantId, userId };
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  const targetWhere = isManager(roles)
    ? { tenantId, year: start.getFullYear(), month: start.getMonth() + 1 }
    : { tenantId, userId, year: start.getFullYear(), month: start.getMonth() + 1 };

  const [todayLeads, pendingApprovals, overdueFollowUps, upcoming, todayVisits, overdueItems, todaySale, monthSale, monthTarget] = await Promise.all([
    prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: start, lte: end }, approvalStatus: "APPROVED" } }),
    prisma.lead.count({ where: { ...leadWhere, approvalStatus: "PENDING" } }),
    prisma.followUp.count({ where: { ...followWhere, dueAt: { lt: new Date() } } }),
    prisma.followUp.findMany({
      where: followWhere,
      include: { lead: { select: { id: true, name: true, phone: true } }, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    prisma.visit.count({ where: { ...visitWhere, checkedInAt: { gte: start, lte: end } } }),
    prisma.followUp.findMany({
      where: { ...followWhere, dueAt: { lt: new Date() } },
      include: { lead: { select: { id: true, name: true, phone: true } }, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { dueAt: "asc" },
      take: 12,
    }),
    prisma.sale.aggregate({
      where: { ...saleWhere, createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { ...saleWhere, createdAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.monthlyTarget.aggregate({
      where: targetWhere,
      _sum: { amount: true },
    }),
  ]);

  const monthSalesAmount = monthSale._sum.amount ? Number(monthSale._sum.amount) : 0;
  const monthTargetAmount = monthTarget._sum.amount ? Number(monthTarget._sum.amount) : 0;

  return {
    todayLeads,
    pendingApprovals,
    overdueFollowUps,
    todayVisits,
    todaySalesCount: todaySale._count,
    todaySalesAmount: todaySale._sum.amount ? Number(todaySale._sum.amount) : 0,
    monthSalesAmount,
    monthTarget: monthTargetAmount,
    targetPercent: monthTargetAmount ? Math.round((monthSalesAmount / monthTargetAmount) * 100) : 0,
    upcoming: upcoming.map(publicFollowUp),
    overdueItems: overdueItems.map(publicFollowUp),
  };
}

function publicFollowUp(row: {
  id: number;
  type: FollowUpType;
  dueAt: Date;
  doneAt: Date | null;
  notes: string | null;
  lead?: { id: number; name: string; phone?: string } | null;
  customer?: { id: number; name: string; phone?: string } | null;
}) {
  const name = row.lead?.name ?? row.customer?.name ?? "Follow-up";
  const phone = row.lead?.phone ?? row.customer?.phone ?? null;
  return {
    id: row.id,
    type: row.type,
    dueAt: row.dueAt,
    doneAt: row.doneAt,
    notes: row.notes,
    name,
    phone,
    leadId: row.lead?.id ?? null,
    customerId: row.customer?.id ?? null,
    overdue: !row.doneAt && row.dueAt < new Date(),
  };
}
