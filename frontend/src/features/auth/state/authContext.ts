import { createContext } from "react";
import type { AuthSession, AuthState } from "./session";

type AuthContextValue = Pick<AuthSession, "signIn" | "signOut" | "getAccessToken"> & {
  state: AuthState;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
