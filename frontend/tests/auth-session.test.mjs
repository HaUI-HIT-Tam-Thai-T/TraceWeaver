import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { createAuthSession } from "../src/features/auth/state/session.ts";

const redirects = {
  callbackUri: "http://localhost:5173/auth/callback",
  logoutUri: "http://localhost:5173",
};

function fixture(overrides = {}) {
  const calls = { init: [], login: [], logout: [], update: [], clear: 0, created: 0 };
  const client = {
    authenticated: false,
    token: undefined,
    async init(options) {
      calls.init.push(options);
      return this.authenticated;
    },
    async login(options) {
      calls.login.push(options);
    },
    async logout(options) {
      calls.logout.push(options);
    },
    async updateToken(seconds) {
      calls.update.push(seconds);
      return false;
    },
    clearToken() {
      calls.clear += 1;
      this.token = undefined;
      this.authenticated = false;
      this.onAuthLogout?.();
    },
    ...overrides,
  };
  const session = createAuthSession(() => {
    calls.created += 1;
    return client;
  }, redirects);
  return { client, calls, session };
}

test("startup redirects straight to Keycloak once with Code + PKCE and no intermediate guest screen", async () => {
  const { session, calls } = fixture();
  const states = [];
  session.subscribe(() => states.push(session.getSnapshot().status));
  assert.equal(session.getSnapshot().status, "initializing");
  const first = session.initializeAuth();
  assert.equal(first, session.initializeAuth());
  await first;
  await session.initializeAuth();
  assert.equal(calls.created, 1);
  assert.equal(calls.init.length, 1);
  assert.deepEqual(calls.init[0], {
    flow: "standard",
    pkceMethod: "S256",
    responseMode: "query",
    checkLoginIframe: false,
    redirectUri: redirects.callbackUri,
    enableLogging: false,
    messageReceiveTimeout: 10000,
  });
  assert.deepEqual(calls.login, [{ redirectUri: redirects.callbackUri }]);
  assert.equal(session.getSnapshot().status, "initializing");
  assert.equal(states.includes("unauthenticated"), false);
});

test("authenticated initialization publishes a token-free snapshot", async () => {
  const { session, calls } = fixture({ authenticated: true, token: "private-token" });
  await session.initializeAuth();
  assert.deepEqual(session.getSnapshot(), { status: "authenticated" });
  assert.equal(JSON.stringify(session.getSnapshot()).includes("private-token"), false);
  assert.equal(calls.login.length, 0);
});

test("callback/init errors are sanitized, clear memory, and require reload instead of re-init", async () => {
  let attempts = 0;
  const { session, client } = fixture({
    token: "private-token",
    async init() {
      attempts += 1;
      throw new Error("private-token/code");
    },
  });
  await session.initializeAuth();
  await session.initializeAuth();
  await session.signIn();
  assert.equal(attempts, 1);
  assert.equal(session.getSnapshot().status, "error");
  assert.equal(session.getSnapshot().reason, "initialization");
  assert.equal(JSON.stringify(session.getSnapshot()).includes("private-token"), false);
  assert.equal(client.token, undefined);
});

test("login uses the registered callback URI", async () => {
  const { session, calls } = fixture();
  await session.initializeAuth();
  await session.signIn();
  assert.deepEqual(calls.login, [
    { redirectUri: redirects.callbackUri },
    { redirectUri: redirects.callbackUri },
  ]);
});

test("login redirect failure becomes a safe UI error", async () => {
  const { session, client } = fixture({ authenticated: true });
  await session.initializeAuth();
  client.onAuthLogout();
  client.login = async () => {
    throw new Error("internal detail");
  };
  await session.signIn();
  assert.equal(session.getSnapshot().status, "error");
  assert.equal(session.getSnapshot().reason, "action");
  assert.equal(JSON.stringify(session.getSnapshot()).includes("internal detail"), false);
});

test("failed startup redirect is sanitized and cannot create an automatic login loop", async () => {
  let attempts = 0;
  const { session } = fixture({
    async login() {
      attempts++;
      throw new Error("private callback detail");
    },
  });
  await session.initializeAuth();
  await session.initializeAuth();
  await session.signIn();
  assert.equal(attempts, 1);
  assert.equal(session.getSnapshot().status, "error");
  assert.equal(session.getSnapshot().reason, "initialization");
  assert.equal(JSON.stringify(session.getSnapshot()).includes("private callback detail"), false);
});

test("concurrent token requests share refresh and receive the refreshed access token", async () => {
  const { session, calls } = fixture({
    authenticated: true,
    token: "old-token",
    async updateToken(seconds) {
      calls.update.push(seconds);
      await setImmediate();
      this.token = "new-token";
      return true;
    },
  });
  await session.initializeAuth();
  const first = session.getAccessToken();
  assert.equal(first, session.getAccessToken());
  assert.equal(await first, "new-token");
  assert.deepEqual(calls.update, [30]);
});

test("refresh failure clears memory, notifies subscribers, and requires re-login", async () => {
  const { session, client } = fixture({
    authenticated: true,
    token: "old-token",
    async updateToken() {
      throw new Error("sensitive failure");
    },
  });
  await session.initializeAuth();
  const statuses = [];
  const unsubscribe = session.subscribe(() => statuses.push(session.getSnapshot().status));
  await assert.rejects(session.getAccessToken(), /Authentication required/);
  assert.equal(client.token, undefined);
  assert.equal(session.getSnapshot().status, "unauthenticated");
  assert.ok(session.getSnapshot().message);
  assert.ok(statuses.includes("unauthenticated"));
  unsubscribe();
});

test("expired token attempts refresh and handles failure without an unhandled rejection", async () => {
  const { session, client } = fixture({
    authenticated: true,
    token: "old-token",
    async updateToken() {
      throw new Error("expired SSO");
    },
  });
  await session.initializeAuth();
  client.onTokenExpired();
  await setImmediate();
  assert.equal(session.getSnapshot().status, "unauthenticated");
  assert.equal(client.token, undefined);
});

test("logout redirects to the app origin and clears local tokens immediately", async () => {
  const { session, client, calls } = fixture({ authenticated: true, token: "access-token" });
  await session.initializeAuth();
  await session.signOut();
  assert.deepEqual(calls.logout, [{ redirectUri: redirects.logoutUri }]);
  assert.equal(client.token, undefined);
  assert.equal(session.getSnapshot().status, "unauthenticated");
  await assert.rejects(session.getAccessToken(), /Authentication required/);
});

test("failed SSO logout still clears local tokens and shows a safe error", async () => {
  const { session, client } = fixture({
    authenticated: true,
    token: "access-token",
    async logout() {
      throw new Error("network details");
    },
  });
  await session.initializeAuth();
  await session.signOut();
  assert.equal(client.token, undefined);
  assert.equal(session.getSnapshot().status, "error");
  assert.equal(JSON.stringify(session.getSnapshot()).includes("network details"), false);
});

test("a refresh completing after logout cannot return or restore a token", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { session, client } = fixture({
    authenticated: true,
    token: "old-token",
    async updateToken() {
      await gate;
      this.token = "late-token";
      this.authenticated = true;
      return true;
    },
  });
  await session.initializeAuth();
  const pending = session.getAccessToken();
  const rejection = assert.rejects(pending, /Authentication required/);
  await setImmediate();
  await session.signOut();
  release();
  await rejection;
  assert.equal(client.token, undefined);
  assert.equal(session.getSnapshot().status, "unauthenticated");
});

test("unsubscribe stops notifications, as required for StrictMode remounts", async () => {
  const { session } = fixture();
  let notifications = 0;
  const unsubscribe = session.subscribe(() => {
    notifications += 1;
  });
  unsubscribe();
  await session.initializeAuth();
  assert.equal(notifications, 0);
});

test("SDK logout notification invalidates a refresh already in flight", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { session, client } = fixture({
    authenticated: true,
    token: "old-token",
    async updateToken() {
      await gate;
      this.token = "late-token";
      return true;
    },
  });
  await session.initializeAuth();
  const pending = session.getAccessToken();
  const rejection = assert.rejects(pending, /Authentication required/);
  await setImmediate();
  client.onAuthLogout();
  release();
  await rejection;
  assert.equal(client.token, undefined);
  assert.equal(session.getSnapshot().status, "unauthenticated");
});
