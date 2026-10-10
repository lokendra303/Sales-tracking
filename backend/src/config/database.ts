import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function required(name: string) {
  const value = process.env[name];
  if (value == null || value === "") {
    throw new Error(`Missing ${name} in backend/.env`);
  }
  return value;
}

export function databaseUrl() {
  if (process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER) {
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || "3306";
    const name = required("DB_NAME");
    const user = encodeURIComponent(required("DB_USER"));
    const password = encodeURIComponent(process.env.DB_PASSWORD ?? "");
    const limit = process.env.DB_CONNECTION_LIMIT || "20";
    return `mysql://${user}:${password}@${host}:${port}/${name}?connection_limit=${limit}`;
  }
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  throw new Error("Set DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD in backend/.env");
}

export function applyDatabaseEnv() {
  process.env.DATABASE_URL = databaseUrl();
  return process.env.DATABASE_URL;
}

applyDatabaseEnv();
