export type AuthState =
  | { status: "initializing" }
  | { status: "authenticated" }
  | { status: "unauthenticated"; message?: string }
  | { status: "error"; reason: "initialization" | "action"; message: string };
export interface AuthSession {
  getSnapshot(): AuthState;
  subscribe(listener: () => void): () => void;
  initializeAuth(): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string>;
}
