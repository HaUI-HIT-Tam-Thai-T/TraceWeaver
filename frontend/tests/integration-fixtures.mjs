import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { AxiosError, AxiosHeaders } from "axios";
import { createAuthSession } from "../src/features/auth/state/session.ts";
import { createApiClient } from "../src/services/createApiClient.ts";
import { createWorkspaceService } from "../src/features/workspace/services/createWorkspaceService.ts";
import { createWorkspaceController } from "../src/features/workspace/state/controller.ts";
import { activeMembership, workspacePermissions } from "../src/features/workspace/state/state.ts";
import { createEventsService } from "../src/features/events/services/createEventsService.ts";
import { createEventsController } from "../src/features/events/state/controller.ts";
import { readEventQuery } from "../src/features/events/query.ts";
import { createReconstructionService } from "../src/features/reconstruction/services/createReconstructionService.ts";
import { createReconstructionController } from "../src/features/reconstruction/state/controller.ts";
import { createLinkReviewService } from "../src/features/link-review/services/createLinkReviewService.ts";
import { createCasesService } from "../src/features/cases/services/createCasesService.ts";
import { createCasesController } from "../src/features/cases/state/controller.ts";
import { createCaseCreationController } from "../src/features/cases/state/createCaseController.ts";
import { createDashboardService } from "../src/features/dashboard/services/createDashboardService.ts";
import { createDashboardController } from "../src/features/dashboard/state/controller.ts";
import { createKnowledgeService } from "../src/features/knowledge/services/createKnowledgeService.ts";
import { createKnowledgeController } from "../src/features/knowledge/state/controller.ts";
import { createWorkspaceMutationEvents } from "../src/services/workspaceMutations.ts";
import { WID, SID, EID, event } from "./event-fixtures.mjs";
import { RID, run, graph } from "./reconstruction-fixtures.mjs";
import { CID, EVID, caseItem, caseDetail } from "./case-fixtures.mjs";
export const settle = async () => {
  for (let i = 0; i < 5; i++) await setImmediate();
};
export const deferred = () => Promise.withResolvers();
const timestamp = "2026-10-27T07:00:00.123456Z";
export async function integrationFixture({
  role = "operator",
  seed = false,
  authenticated = true,
} = {}) {
  const server = {
    role,
    subject: "integration-user",
    member: true,
    grants: true,
    run: seed ? run() : null,
    graph: graph(),
    detail: seed ? caseDetail() : null,
    requests: [],
    replays: new Map(),
    intercept: null,
    timeoutCase: false,
    timeoutEvidence: false,
    conflictReview: false,
    conflictTransition: false,
  };
  if (server.detail) server.detail.case.owner_id = server.subject;
  const sdk = {
    authenticated,
    token: authenticated ? "fixture-token" : undefined,
    initCount: 0,
    refreshCount: 0,
    failRefresh: false,
    refreshGate: null,
    async init() {
      this.initCount++;
      return this.authenticated;
    },
    async login() {},
    async logout() {},
    async updateToken() {
      this.refreshCount++;
      if (this.refreshGate) await this.refreshGate;
      if (this.failRefresh) throw Error("simulated refresh failure");
      this.token = "fixture-refreshed-token";
      return true;
    },
    clearToken() {
      this.authenticated = false;
      this.token = undefined;
      this.onAuthLogout?.();
    },
  };
  const auth = createAuthSession(() => sdk, {
    callbackUri: "http://localhost:5173/auth/callback",
    logoutUri: "http://localhost:5173/",
  });
  const client = createApiClient({ baseURL: "", getAccessToken: auth.getAccessToken });
  const reply = (config, data, status = 200) => ({
    config,
    data: structuredClone(data),
    status,
    statusText: "Fixture",
    headers: new AxiosHeaders({ "X-Request-ID": "integration-request" }),
  });
  const error = (config, status, code) => {
    throw new AxiosError(
      "Fixture backend error",
      "ERR_BAD_RESPONSE",
      config,
      {},
      reply(config, { error: { code }, request_id: "integration-request" }, status),
    );
  };
  const timeout = (config) => {
    throw new AxiosError("Fixture timeout", "ETIMEDOUT", config, {});
  };
  client.defaults.adapter = async (config) => {
    assert.equal(config.headers.get("Authorization"), "Bearer " + sdk.token);
    const method = config.method.toUpperCase(),
      url = config.url,
      params = Object.fromEntries(config.params ?? []),
      body = config.data ? JSON.parse(config.data) : null,
      key = config.headers.get("Idempotency-Key");
    server.requests.push({ method, url, params, body, key, signal: config.signal });
    if (server.intercept) {
      const response = await server.intercept(config, { method, url, params, body, key }, reply);
      if (response) return response;
    }
    if (url === "/api/v1/me")
      return reply(config, {
        subject: server.subject,
        memberships: server.member
          ? [{ workspace_id: WID, roles: [server.role], group_ids: [] }]
          : [],
      });
    if (!server.member) return error(config, 403, "FORBIDDEN");
    if (url.endsWith("/sources"))
      return reply(config, {
        items: server.grants
          ? [
              {
                id: SID,
                workspace_id: WID,
                name: "intake",
                service: "intake",
                parser_version: "v1",
              },
            ]
          : [],
        next_cursor: null,
      });
    if (!server.grants) return error(config, 403, "FORBIDDEN");
    if (method === "POST" && !["operator", "reviewer"].includes(server.role))
      return error(config, 403, "FORBIDDEN");
    if (url.endsWith("/dashboard"))
      return reply(config, {
        runs: server.run ? 1 : 0,
        degraded_runs: server.run?.degraded ? 1 : 0,
        unresolved_events: server.run ? server.graph.unresolved_event_ids.length : 0,
        waiting_cases:
          server.detail && ["new", "assigned"].includes(server.detail.case.state) ? 1 : 0,
        filters: params,
      });
    if (url.endsWith("/knowledge"))
      return reply(config, {
        items: [
          {
            id: EVID,
            workspace_id: WID,
            title: "Knowledge fixture",
            body: "Sensitive fixture body",
            version: 2,
            author_subject: server.subject,
            source_ref: "urn:traceweaver:knowledge:fixture",
            created_at: timestamp,
          },
        ],
        next_cursor: null,
      });
    if (url.endsWith("/events")) return reply(config, { items: [event()], next_cursor: null });
    if (url.endsWith("/events/" + EID)) return reply(config, event());
    if (url.endsWith("/runs") && method === "POST") {
      server.run = run("completed", { mode: body.mode });
      return reply(config, server.run, 202);
    }
    if (url.endsWith("/runs/" + RID))
      return server.run ? reply(config, server.run) : error(config, 404, "NOT_FOUND");
    if (url.endsWith("/graph")) return reply(config, server.graph);
    if (url.endsWith("/reviews")) {
      const link = server.graph.links[0];
      if (server.conflictReview) {
        server.conflictReview = false;
        link.version++;
        return error(config, 409, "VERSION_CONFLICT");
      }
      if (body.expected_version !== link.version) return error(config, 409, "VERSION_CONFLICT");
      link.review_state = body.decision;
      link.version++;
      server.graph.version++;
      server.graph.unresolved_event_ids = [];
      return reply(config, {
        id: EVID,
        link_id: link.id,
        decision: body.decision,
        reason: body.reason,
        actor_subject: server.subject,
        created_at: timestamp,
        link_version: link.version,
      });
    }
    if (url.endsWith("/cases") && method === "GET")
      return reply(config, {
        items:
          server.detail && (!params.state || params.state === server.detail.case.state)
            ? [server.detail.case]
            : [],
        next_cursor: null,
      });
    if (url.endsWith("/cases") && method === "POST") {
      if (server.replays.has(key)) return reply(config, server.replays.get(key));
      server.detail = {
        case: { ...caseItem(), title: body.title, creator_subject: server.subject },
        history: [],
        evidence: [],
      };
      server.replays.set(key, structuredClone(server.detail.case));
      if (server.timeoutCase) {
        server.timeoutCase = false;
        return timeout(config);
      }
      return reply(config, server.detail.case, 201);
    }
    if (url.endsWith("/cases/" + CID) && method === "GET")
      return server.detail ? reply(config, server.detail) : error(config, 404, "NOT_FOUND");
    if (url.endsWith("/evidence")) {
      const item = {
        id: crypto.randomUUID(),
        case_id: CID,
        ...body,
        creator_subject: server.subject,
        created_at: timestamp,
      };
      server.detail.evidence.push(item);
      if (server.timeoutEvidence) {
        server.timeoutEvidence = false;
        return timeout(config);
      }
      return reply(config, item, 201);
    }
    if (url.endsWith("/transitions")) {
      if (server.replays.has(key)) return reply(config, server.replays.get(key));
      const current = server.detail.case;
      if (server.conflictTransition) {
        server.conflictTransition = false;
        current.version++;
        return error(config, 409, "VERSION_CONFLICT");
      }
      if (current.version !== body.expected_version) return error(config, 409, "VERSION_CONFLICT");
      const transitions = {
        assign: ["new", "assigned"],
        start: ["assigned", "investigating"],
        request_verification: ["investigating", "awaiting_verification"],
        verify_close: ["awaiting_verification", "closed"],
        verification_failed: ["awaiting_verification", "investigating"],
        reopen: ["closed", "investigating"],
      };
      const pair = transitions[body.action];
      if (!pair || pair[0] !== current.state) return error(config, 422, "GUARD_FAILED");
      if (
        ["verify_close", "verification_failed", "reopen"].includes(body.action) &&
        server.role !== "reviewer"
      )
        return error(config, 403, "FORBIDDEN");
      if (
        ["start", "request_verification"].includes(body.action) &&
        server.role !== "reviewer" &&
        current.owner_id !== server.subject
      )
        return error(config, 422, "GUARD_FAILED");
      if (
        ["request_verification", "verify_close"].includes(body.action) &&
        !server.detail.evidence.some((e) => /\S/.test(e.note))
      )
        return error(config, 422, "GUARD_FAILED");
      if (
        body.action === "verify_close" &&
        server.graph.links.some((l) => l.review_state === "pending")
      )
        return error(config, 422, "GUARD_FAILED");
      if (body.action === "assign") current.owner_id = body.owner_id;
      current.state = pair[1];
      current.version++;
      server.detail.history.push({
        action: body.action,
        from_state: pair[0],
        to_state: pair[1],
        actor_subject: server.subject,
        reason: body.reason,
        version: current.version,
        occurred_at: timestamp,
        evidence_refs: server.detail.evidence.map((e) => e.id),
      });
      server.replays.set(key, structuredClone(current));
      return reply(config, current);
    }
    throw Error("Unexpected integration route: " + method + " " + url);
  };
  const notifications = createWorkspaceMutationEvents();
  const rawCases = createCasesService(client),
    rawRuns = createReconstructionService(client),
    rawLinks = createLinkReviewService(client);
  const casesService = {
    ...rawCases,
    createCase: (...args) =>
      notifications.afterMutation(args[0], () => rawCases.createCase(...args)),
    addEvidence: (...args) =>
      notifications.afterMutation(args[0], () => rawCases.addEvidence(...args)),
    transitionCase: (...args) =>
      notifications.afterMutation(args[0], () => rawCases.transitionCase(...args)),
  };
  const runsService = {
    ...rawRuns,
    createRun: (...args) => notifications.afterMutation(args[0], () => rawRuns.createRun(...args)),
  };
  const linksService = {
    ...rawLinks,
    reviewLink: (...args) =>
      notifications.afterMutation(args[0], () => rawLinks.reviewLink(...args)),
  };
  const workspace = createWorkspaceController(createWorkspaceService(client)),
    revalidate = () => workspace.refreshAccess();
  const events = createEventsController(createEventsService(client), revalidate);
  const reconstruction = createReconstructionController({
    service: runsService,
    linkService: linksService,
    getEvent: createEventsService(client).getEvent,
    revalidate,
  });
  const creation = createCaseCreationController({
    service: casesService,
    getRun: runsService.getRun,
    revalidate,
  });
  const cases = createCasesController(
    casesService,
    revalidate,
    { addEvidence: casesService.addEvidence, getGraph: runsService.getGraph },
    { transitionCase: casesService.transitionCase },
  );
  const dashboard = createDashboardController(createDashboardService(client), revalidate);
  const knowledge = createKnowledgeController(createKnowledgeService(client), revalidate);
  let caseView = { kind: "none" },
    caseMode = false,
    currentScope = null;
  function syncDerived() {
    const w = workspace.getSnapshot(),
      p = workspacePermissions(activeMembership(w));
    currentScope =
      auth.getSnapshot().status === "authenticated" &&
      w.status === "ready" &&
      p.canRead &&
      w.me &&
      w.selectedWorkspaceId
        ? {
            subject: w.me.subject,
            workspaceId: w.selectedWorkspaceId,
            accessKey: w.me,
            canWrite: p.canWrite,
            canVerify: p.canVerify,
          }
        : null;
    events.sync(currentScope, !caseMode, readEventQuery("?event_id=" + EID));
    cases.sync(currentScope, caseView);
    dashboard.sync(currentScope, "");
    knowledge.sync(currentScope, "");
    syncRoot();
  }
  function syncRoot() {
    reconstruction.sync(currentScope, events.getSnapshot().root);
    syncCreation();
  }
  function syncCreation() {
    const run = reconstruction.getSnapshot().run;
    creation.sync(currentScope, run?.id ?? null, run);
  }
  const unsubscribe = [
    workspace.subscribe(syncDerived),
    events.subscribe(syncRoot),
    reconstruction.subscribe(syncCreation),
    notifications.subscribe(dashboard.invalidateWorkspace),
    auth.subscribe(() => {
      if (auth.getSnapshot().status === "authenticated") void workspace.start();
      else workspace.stop();
    }),
  ];
  await auth.initializeAuth();
  await settle();
  return {
    server,
    sdk,
    auth,
    client,
    workspace,
    events,
    reconstruction,
    creation,
    cases,
    dashboard,
    knowledge,
    services: {
      cases: casesService,
      runs: runsService,
      events: createEventsService(client),
      dashboard: createDashboardService(client),
      knowledge: createKnowledgeService(client),
    },
    scope: () => currentScope,
    permissions: () => workspacePermissions(activeMembership(workspace.getSnapshot())),
    openCase() {
      caseMode = true;
      caseView = { kind: "detail", caseId: CID, search: "" };
      syncDerived();
    },
    async close() {
      unsubscribe.forEach((fn) => fn());
      workspace.stop();
      events.stop();
      reconstruction.stop();
      creation.stop();
      cases.stop();
      dashboard.stop();
      knowledge.stop();
    },
  };
}
