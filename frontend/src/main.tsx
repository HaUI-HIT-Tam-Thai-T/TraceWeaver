import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { parseEnv } from "./config/env";
import "./index.css";
import App from "./App.tsx";
import { initializeAuth } from "./features/auth/services/auth";
import { AppProviders } from "./app/providers";

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

try {
  parseEnv(import.meta.env, import.meta.env.PROD);
} catch (error) {
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent =
    error instanceof Error ? error.message : "Invalid frontend configuration.";
  root.replaceChildren(message);
  throw error;
}

const loading = document.createElement("p");
loading.setAttribute("role", "status");
loading.textContent = "Đang kiểm tra phiên đăng nhập…";
root.replaceChildren(loading);
await initializeAuth();
createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
