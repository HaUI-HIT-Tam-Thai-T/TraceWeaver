import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { authSession } from "../services/auth";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(
    authSession.subscribe,
    authSession.getSnapshot,
  );
  return (
    <AuthContext.Provider
      value={{
        state,
        signIn: authSession.signIn,
        signOut: authSession.signOut,
        getAccessToken: authSession.getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
