import type { AuthState, AuthSession } from "../../../types/auth.ts";
import type Keycloak from "keycloak-js";

type AuthClient = Pick<
  Keycloak,
  | "init"
  | "login"
  | "logout"
  | "updateToken"
  | "clearToken"
  | "token"
  | "authenticated"
  | "onAuthLogout"
  | "onAuthRefreshError"
  | "onTokenExpired"
>;

export function createAuthSession(
  createClient: () => AuthClient,
  redirects: { callbackUri: string; logoutUri: string },
): AuthSession {
  let client: AuthClient | undefined;
  let state: AuthState = { status: "initializing" };
  let initialization: Promise<void> | undefined;
  let refresh: Promise<string> | undefined;
  let generation = 0;
  const listeners = new Set<() => void>();

  function publish(next: AuthState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function clearSession(message?: string) {
    generation += 1;
    client?.clearToken();
    publish({ status: "unauthenticated", message });
  }

  function getSnapshot() {
    return state;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function initializeAuth(): Promise<void> {
    initialization ??= Promise.resolve().then(async () => {
      try {
        client = createClient();
        client.onAuthLogout = () => {
          generation += 1;
          publish({ status: "unauthenticated" });
        };
        client.onAuthRefreshError = () => clearSession("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
        client.onTokenExpired = () => {
          void getAccessToken().catch(() => undefined);
        };
        const authenticated = await client.init({
          flow: "standard",
          pkceMethod: "S256",
          responseMode: "query",
          checkLoginIframe: false,
          redirectUri: redirects.callbackUri,
          enableLogging: false,
          messageReceiveTimeout: 10000,
        });
        if (authenticated) publish({ status: "authenticated" });
        else {
          await client.login({ redirectUri: redirects.callbackUri });
        }
      } catch {
        client?.clearToken();
        publish({
          status: "error",
          reason: "initialization",
          message: "Không thể xác thực phiên đăng nhập. Vui lòng tải lại trang để thử lại.",
        });
      }
    });
    return initialization;
  }

  async function signIn(): Promise<void> {
    await initializeAuth();
    if (!client || (state.status === "error" && state.reason === "initialization")) return;
    try {
      await client.login({ redirectUri: redirects.callbackUri });
    } catch {
      publish({
        status: "error",
        reason: "action",
        message: "Không thể mở trang đăng nhập. Vui lòng thử lại.",
      });
    }
  }

  async function signOut(): Promise<void> {
    if (!client || state.status !== "authenticated") return;
    try {
      const logout = client.logout({ redirectUri: redirects.logoutUri });
      clearSession();
      await logout;
    } catch {
      clearSession();
      publish({
        status: "error",
        reason: "action",
        message:
          "Đã xóa phiên trên ứng dụng nhưng chưa xác nhận được đăng xuất SSO. Vui lòng thử tải lại trang.",
      });
    }
  }

  function getAccessToken(): Promise<string> {
    if (refresh) return refresh;
    const currentClient = client;
    if (!currentClient || state.status !== "authenticated") {
      return Promise.reject(new Error("Authentication required"));
    }
    const currentGeneration = generation;
    refresh = Promise.resolve().then(async () => {
      try {
        await currentClient.updateToken(30);
        if (
          generation !== currentGeneration ||
          !currentClient.authenticated ||
          !currentClient.token
        ) {
          throw new Error("Authentication required");
        }
        return currentClient.token;
      } catch {
        clearSession("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
        throw new Error("Authentication required");
      } finally {
        refresh = undefined;
      }
    });
    return refresh;
  }

  return {
    getSnapshot,
    subscribe,
    initializeAuth,
    signIn,
    signOut,
    getAccessToken,
  };
}
