import type { RoleCode } from "@prisma/client";

export function isAdmin(roles: RoleCode[]) {
  return roles.includes("ADMIN");
}

export function isManager(roles: RoleCode[]) {
  return roles.includes("MANAGER");
}

export function leadScope(tenantId: number, userId: number, roles: RoleCode[]) {
  if (isManager(roles)) {
    return { tenantId };
  }
  return { tenantId, assigneeId: userId };
}

export function customerScope(tenantId: number, userId: number, roles: RoleCode[]) {
  if (isManager(roles)) {
    return { tenantId };
  }
  return {
    tenantId,
    OR: [{ ownerId: userId }, { leads: { some: { assigneeId: userId } } }],
  };
}

export function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function publicLead(lead: {
  id: number;
  name: string;
  phone: string;
  contactPerson: string | null;
  businessType: string | null;
  address: string | null;
  city: string | null;
  latitude?: unknown;
  longitude?: unknown;
  notes: string | null;
  source: string;
  status: string;
  temperature: string;
  potential: unknown;
  assigneeId: number | null;
  customerId: number | null;
  createdAt: Date;
  assignee?: { id: number; name: string } | null;
  followUps?: { id: number; type: string; dueAt: Date; doneAt: Date | null; notes: string | null }[];
}) {
  const nextFollowUp = lead.followUps
    ?.filter((item) => !item.doneAt)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];

  return {
    id: lead.id,
    kind: "lead" as const,
    name: lead.name,
    phone: lead.phone,
    contactPerson: lead.contactPerson,
    businessType: lead.businessType,
    address: lead.address,
    city: lead.city,
    latitude: lead.latitude != null ? Number(lead.latitude) : null,
    longitude: lead.longitude != null ? Number(lead.longitude) : null,
    notes: lead.notes,
    source: lead.source,
    status: lead.status,
    temperature: lead.temperature,
    potential: lead.potential ? Number(lead.potential) : null,
    assigneeId: lead.assigneeId,
    assigneeName: lead.assignee?.name ?? null,
    customerId: lead.customerId,
    createdAt: lead.createdAt,
    nextFollowUp: nextFollowUp
      ? { id: nextFollowUp.id, type: nextFollowUp.type, dueAt: nextFollowUp.dueAt, notes: nextFollowUp.notes }
      : null,
  };
}
