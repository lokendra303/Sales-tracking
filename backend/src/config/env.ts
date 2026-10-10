import dotenv from "dotenv";
import path from "node:path";
import { databaseUrl } from "./database.js";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing env ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: databaseUrl(),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
  accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTtlDays: Number(process.env.JWT_REFRESH_DAYS ?? 30),
  seedPassword: process.env.SEED_PASSWORD ?? "Admin@123",
};
