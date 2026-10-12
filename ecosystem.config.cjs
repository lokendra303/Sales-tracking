const path = require("node:path");

const root = __dirname;

// Backend only. Nginx serves the built desk. Host and port come from backend/.env.
module.exports = {
  apps: [
    {
      name: "salestrack-api",
      cwd: path.join(root, "backend"),
      script: path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      args: "src/server.ts",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
      error_file: path.join(root, "logs", "salestrack-api-error.log"),
      out_file: path.join(root, "logs", "salestrack-api-out.log"),
    },
  ],
};
