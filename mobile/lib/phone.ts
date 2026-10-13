export function mobileDigits(value: string) {
  if (/[a-z@]/i.test(value)) return "";
  return value.replace(/\D/g, "").slice(0, 10);
}
