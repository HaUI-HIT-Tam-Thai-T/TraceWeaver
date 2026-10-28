import Keycloak from "keycloak-js";
import { parseEnv } from "../../config/env";
import { createAuthSession } from "./session";

// Construction is deferred until bootstrap, after environment validation.
export const authSession = createAuthSession(
  () => {
    const env = parseEnv(import.meta.env, import.meta.env.PROD);
    return new Keycloak({
      url: env.VITE_KEYCLOAK_URL,
      realm: env.VITE_KEYCLOAK_REALM,
      clientId: env.VITE_KEYCLOAK_CLIENT_ID,
    });
  },
  {
    callbackUri: `${window.location.origin}/auth/callback`,
    logoutUri: window.location.origin,
  },
);

export const { initializeAuth, signIn, signOut, getAccessToken } = authSession;
