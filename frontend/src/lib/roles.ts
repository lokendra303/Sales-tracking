export function isAdmin(roles: string[] = []) {
  return roles.includes("ADMIN");
}

export function isPlatformAdmin(user?: { platformAdmin?: boolean } | null) {
  return Boolean(user?.platformAdmin);
}

export function isManager(roles: string[] = []) {
  return roles.includes("MANAGER");
}

export function isSales(roles: string[] = []) {
  return roles.includes("SALES_EXECUTIVE") && !isAdmin(roles) && !isManager(roles);
}

export function roleLabel(roles: string[] = []) {
  if (isAdmin(roles)) return "Admin";
  if (isManager(roles)) return "Manager";
  if (roles.includes("SALES_EXECUTIVE")) return "Sales Executive";
  return roles[0] ?? "";
}

export function accessLabel(roles: string[] = []) {
  if (isAdmin(roles) || isManager(roles)) return "Web portal + mobile app";
  return "Mobile app only";
}
