import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createRefreshTokenValue(): string {
  return randomBytes(48).toString("hex");
}

export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
