import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function appBase(value: string | undefined) {
  const raw = (value || "/").trim();
  if (raw === "" || raw === "/") return "/";
  const withLead = raw.startsWith("/") ? raw : `/${raw}`;
  return withLead.endsWith("/") ? withLead : `${withLead}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.PORT || 5173);
  return {
    base: appBase(env.VITE_BASE_PATH),
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
