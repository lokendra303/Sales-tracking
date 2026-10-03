import type { RoleCode } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        tenantId: number;
        roles: RoleCode[];
        platformAdmin: boolean;
      };
    }
  }
}

export {};
