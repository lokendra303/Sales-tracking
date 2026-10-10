import { spawnSync } from "node:child_process";
import path from "node:path";
import { applyDatabaseEnv } from "../src/config/database.js";

applyDatabaseEnv();

const result = spawnSync("npx", ["--no-install", "prisma", ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, ".."),
  env: process.env,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
