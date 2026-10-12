import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { ensureSystemAdmin } from "./modules/auth/ensure-admin.js";

const app = createApp();

const server = app.listen(env.port, env.host, () => {
  console.log(`SalesTrack API listening on http://${env.host}:${env.port}`);
});

ensureSystemAdmin().catch((error) => {
  console.error(error);
  server.close();
  prisma.$disconnect().finally(() => process.exit(1));
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
