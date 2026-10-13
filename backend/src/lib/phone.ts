export function parseMobile(value: string): string | null {
  const raw = value.trim();
  if (!raw || /[a-z@]/i.test(raw)) return null;
  const phone = raw.replace(/\D/g, "");
  if (phone.length !== 10) return null;
  return phone;
}
