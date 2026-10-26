import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** Hash for login checks, plus the readable password managers see on the desk. */
export async function passwordRecord(password: string) {
  return {
    passwordHash: await hashPassword(password),
    loginPassword: password,
  };
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
