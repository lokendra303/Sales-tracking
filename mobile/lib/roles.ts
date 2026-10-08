export function isAdmin(roles: string[] = []) {
  return roles.includes("ADMIN");
}

export function isManager(roles: string[] = []) {
  return roles.includes("MANAGER");
}

export function isOffice(roles: string[] = []) {
  return isAdmin(roles) || isManager(roles);
}

export function isSales(roles: string[] = []) {
  return roles.includes("SALES_EXECUTIVE") && !isOffice(roles);
}

export function roleLabel(roles: string[] = []) {
  if (roles.includes("ADMIN")) return "Admin";
  if (roles.includes("MANAGER")) return "Manager";
  if (roles.includes("SALES_EXECUTIVE")) return "Sales Executive";
  return roles[0] ?? "";
}

export function accessLabel(roles: string[] = []) {
  if (isOffice(roles)) return "Web portal + mobile app";
  return "Mobile app only";
}
