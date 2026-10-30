import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { parseEnv } from "./src/config/env.ts";

export default defineConfig(({ mode, command }) => {
  const envDir = fileURLToPath(new URL(".", import.meta.url));
  const env = { ...loadEnv(mode, envDir, ""), ...process.env };
  parseEnv(env, command === "build" || mode === "production");

  return {
    envDir,
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    plugins: [react(), tailwindcss()],
    server: {
      host: "localhost",
      port: 5173,
      strictPort: true,
    },
  };
});
