import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { authSession } from "../services/auth";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(authSession.getSnapshot);

  useEffect(() => {
    function handleChange() {
      setState(authSession.getSnapshot());
    }
    const unsubscribe = authSession.subscribe(handleChange);
    // Catch a change between rendering and registering the listener.
    handleChange();
    return unsubscribe;
  }, []);
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
