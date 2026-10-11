const path = require("node:path");

const root = __dirname;

// Host and port come from backend/.env and frontend/.env. Do not set them here.
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
    {
      name: "salestrack-desk",
      cwd: path.join(root, "frontend"),
      script: path.join(root, "node_modules", "vite", "bin", "vite.js"),
      args: "preview",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
      error_file: path.join(root, "logs", "salestrack-desk-error.log"),
      out_file: path.join(root, "logs", "salestrack-desk-out.log"),
    },
  ],
};
