export function parseDay(value?: string, fallback = new Date()) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { start, end, date: value };
  }
  const start = new Date(fallback);
  start.setHours(0, 0, 0, 0);
  const end = new Date(fallback);
  end.setHours(23, 59, 59, 999);
  return { start, end, date: isoDay(start) };
}

export function isoDay(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function plannedAtFor(date: string, sequence: number) {
  const { start } = parseDay(date);
  const planned = new Date(start);
  planned.setHours(10 + Math.max(0, sequence - 1), 0, 0, 0);
  return planned;
}

export function movePlannedTo(date: string, previous: Date | null, sequence: number) {
  if (!previous) return plannedAtFor(date, sequence);
  const { start } = parseDay(date);
  const next = new Date(start);
  next.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
  return next;
}

export function asNumber(value: unknown) {
  return value == null ? null : Number(value);
}

export function publicStop(row: {
  id: number;
  sequence: number;
  plannedAt: Date | null;
  leadId: number | null;
  customerId: number | null;
  lead?: { name: string; phone: string; address: string | null; city: string | null; latitude: unknown; longitude: unknown } | null;
  customer?: { name: string; phone: string; address: string | null; city: string | null; latitude: unknown; longitude: unknown } | null;
}) {
  const place = row.lead ?? row.customer;
  return {
    id: row.id,
    sequence: row.sequence,
    leadId: row.leadId,
    customerId: row.customerId,
    name: place?.name ?? "Stop",
    phone: place?.phone ?? null,
    address: place?.address ?? null,
    city: place?.city ?? null,
    placeLat: asNumber(place?.latitude),
    placeLng: asNumber(place?.longitude),
    plannedAt: row.plannedAt,
  };
}
