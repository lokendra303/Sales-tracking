import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.PORT || 5173);
  return {
    plugins: [react()],
    resolve: {
      alias: { "@": "/src" },
    },
    server: {
      host: true,
      port,
      strictPort: true,
    },
    preview: {
      host: env.HOST || "127.0.0.1",
      port,
      strictPort: true,
    },
  };
});
