import type { NextFunction, Request, Response } from "express";
import type { RoleCode } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { forbidden, unauthorized } from "../lib/errors.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw unauthorized();
    }

    const token = header.slice(7);
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });

    if (!user || user.status !== "ACTIVE") {
      throw unauthorized("This account is disabled.");
    }

    req.auth = {
      userId: user.id,
      tenantId: user.tenantId,
      roles: user.roles.map((item) => item.role.code),
      platformAdmin: user.platformAdmin,
    };
    next();
  } catch (error) {
    next(error instanceof Error && "status" in error ? error : unauthorized());
  }
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.platformAdmin) {
    next(forbidden("Only the system admin can approve companies."));
    return;
  }
  next();
}

export function requireRole(...allowed: RoleCode[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const roles = req.auth?.roles ?? [];
    if (!roles.some((role) => allowed.includes(role))) {
      next(forbidden());
      return;
    }
    next();
  };
}
