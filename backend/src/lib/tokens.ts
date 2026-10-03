import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AccessPayload = {
  sub: number;
  tenantId: number;
  roles: string[];
};

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.accessTtl });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessPayload;
}

export function refreshExpiry(): Date {
  const date = new Date();
  date.setDate(date.getDate() + env.refreshTtlDays);
  return date;
}
