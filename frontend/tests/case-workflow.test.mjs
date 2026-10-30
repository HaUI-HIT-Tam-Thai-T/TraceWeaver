import assert from "node:assert/strict";
import { test } from "node:test";
import { createCasesController } from "../src/features/cases/state/controller.ts";
import { createCasesService } from "../src/features/cases/services/createCasesService.ts";
import {
  transitionSchema,
  transitionIssue,
  transitionStates,
} from "../src/features/cases/workflow.ts";
import { initialCasesState } from "../src/features/cases/state/state.ts";
import { ApiError } from "../src/services/apiError.ts";
import { caseDetail, CID } from "./case-fixtures.mjs";
import { scope, WID } from "./event-fixtures.mjs";
import { graph } from "./reconstruction-fixtures.mjs";
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const body = () => ({
  action: "assign",
  expected_version: 1,
  owner_id: "user-a",
  reason: "  handling  ",
});
const err = (code, status = 422) =>
  new ApiError({ kind: status === 401 ? "auth" : "http", code, status, message: "Safe" });
async function setup(options = {}) {
  let detail = caseDetail(),
    reads = 0,
    posts = [],
    keys = 0,
    now = 0,
    rechecks = 0;
  const service = {
    listCases: async () => ({ items: [], next_cursor: null }),
    getCase: async () => {
      reads++;
      return options.read ? options.read(reads, detail) : structuredClone(detail);
    },
  };
  const controller = createCasesController(
    service,
    async () => {
      rechecks++;
    },
    {
      addEvidence: async () => {
        throw Error("unused");
      },
      getGraph: async () => options.graph ?? graph(),
    },
    {
      now: () => now,
      newKey: () => `key-${++keys}`,
      transitionCase: async (...args) => {
        posts.push(args);
        if (options.post) return options.post(args, detail);
        detail.case = {
          ...detail.case,
          state: transitionStates[args[2].action].to,
          owner_id: args[2].owner_id ?? detail.case.owner_id,
          version: args[2].expected_version + 1,
        };
        return structuredClone(detail.case);
      },
    },
  );
  const access = { ...scope(), canVerify: options.reviewer ?? false },
    view = { kind: "detail", caseId: CID, search: "" };
  controller.sync(access, view);
  await tick();
  return {
    controller,
    access,
    view,
    posts,
    setDetail: (d) => {
      detail = d;
    },
    setNow: (n) => {
      now = n;
    },
    reads: () => reads,
    rechecks: () => rechecks,
  };
}
test("transition schema trims reason, requires subject only for assign and rejects extras/bounds", () => {
  assert.equal(transitionSchema.parse(body()).reason, "handling");
  for (const value of [
    { ...body(), reason: " " },
    { ...body(), reason: "x".repeat(1001) },
    { ...body(), owner_id: undefined },
    { ...body(), action: "start" },
    { ...body(), state: "closed" },
    { ...body(), expected_version: 0 },
  ])
    assert.equal(transitionSchema.safeParse(value).success, false);
  assert.ok(
    transitionSchema.safeParse({ action: "start", reason: "why", expected_version: 2 }).success,
  );
});
test("all six state transitions enforce reviewer, owner, evidence/note, pending and reopen reason", () => {
  const access = { ...scope(), canVerify: true },
    d = caseDetail();
  d.case.owner_id = access.subject;
  for (const [action, states] of Object.entries(transitionStates)) {
    d.case.state = states.from;
    assert.equal(transitionIssue(d, access, action, "new reason", 0), null);
    assert.ok(transitionIssue(d, { ...access, canWrite: false }, action));
    d.case.state = "invalid";
    assert.ok(transitionIssue(d, access, action));
  }
  for (const action of ["verify_close", "verification_failed", "reopen"]) {
    d.case.state = transitionStates[action].from;
    assert.match(transitionIssue(d, { ...access, canVerify: false }, action), /reviewer/);
  }
  d.case.state = "assigned";
  assert.match(
    transitionIssue(d, { ...access, subject: "other", canVerify: false }, "start"),
    /người đang xử lý/,
  );
  d.case.state = "investigating";
  d.evidence = [];
  assert.match(transitionIssue(d, access, "request_verification"), /bằng chứng/);
  d.evidence = caseDetail().evidence;
  d.evidence[0].note = " ";
  assert.match(transitionIssue(d, access, "request_verification"), /ghi chú/);
  d.evidence = caseDetail().evidence;
  d.case.state = "awaiting_verification";
  assert.match(transitionIssue(d, access, "verify_close", "why", 1), /chờ duyệt/);
  d.case.state = "closed";
  d.history.push({ ...d.history[0], action: "verify_close", reason: "old", version: 5 });
  assert.match(transitionIssue(d, access, "reopen", " old "), /khác/);
});
test("service sends only DTO plus key and rejects wrong target/version/ID", async () => {
  const calls = [];
  const response = { ...caseDetail().case, state: "assigned", version: 2, owner_id: "user-a" };
  const service = createCasesService({
    post: async (...args) => {
      calls.push(args);
      return { data: response };
    },
  });
  await service.transitionCase(WID, CID, body(), { idempotencyKey: "key" });
  assert.equal(calls[0][0], `/api/v1/workspaces/${WID}/cases/${CID}/transitions`);
  assert.equal(calls[0][2].headers["Idempotency-Key"], "key");
  assert.equal(calls[0][1].reason, "handling");
  response.version = 3;
  await assert.rejects(service.transitionCase(WID, CID, body(), { idempotencyKey: "key" }), {
    code: "INVALID_API_RESPONSE",
  });
});
test("success GETs authoritative detail, duplicate submit cannot overlap and manual refresh never POSTs", async () => {
  const x = await setup();
  const task = x.controller.submitTransition(body());
  await x.controller.submitTransition(body());
  await task;
  assert.equal(x.posts.length, 1);
  assert.equal(x.reads(), 3);
  assert.equal(x.controller.getSnapshot().detail.data.case.version, 2);
  await x.controller.refresh();
  assert.equal(x.posts.length, 1);
  x.controller.beginNewTransition();
  await x.controller.submitTransition({ action: "start", expected_version: 2, reason: "start" });
  assert.equal(x.posts.length, 2);
  assert.notEqual(x.posts[0][3].idempotencyKey, x.posts[1][3].idempotencyKey);
});
test("preflight conflict stops POST; using new version requires explicit operation", async () => {
  const x = await setup({
    read: (n, d) => ({ ...d, case: { ...d.case, version: n > 1 ? 2 : 1 } }),
  });
  await x.controller.submitTransition(body());
  assert.equal(x.posts.length, 0);
  assert.equal(x.controller.getSnapshot().workflow.status, "conflict");
});
test("timeout committed transition replays same body/key even when fresh state/version changed", async () => {
  let count = 0;
  const x = await setup({
    post: async (args, d) => {
      count++;
      d.case = { ...d.case, state: "assigned", version: 2, owner_id: "user-a" };
      if (count === 1) throw new ApiError({ kind: "timeout", code: "TIMEOUT", message: "Safe" });
      return d.case;
    },
  });
  await x.controller.submitTransition(body());
  assert.equal(x.controller.getSnapshot().workflow.status, "uncertain");
  assert.equal(x.posts.length, 1);
  await x.controller.submitTransition(body());
  assert.equal(x.posts.length, 1);
  await x.controller.retryTransition();
  assert.equal(x.posts.length, 2);
  assert.deepEqual(x.posts[0][2], x.posts[1][2]);
  assert.equal(x.posts[0][3].idempotencyKey, x.posts[1][3].idempotencyKey);
  assert.equal(x.controller.getSnapshot().workflow.status, "success");
});
test("TTL before and after preflight prohibits replay", async () => {
  for (const after of [false, true]) {
    let x;
    x = await setup({
      read: (n, d) => {
        if (after && n === 4) x.setNow(86400000);
        return structuredClone(d);
      },
      post: async () => {
        throw new ApiError({ kind: "timeout", code: "TIMEOUT", message: "Safe" });
      },
    });
    await x.controller.submitTransition(body());
    if (!after) x.setNow(86400000);
    await x.controller.retryTransition();
    assert.equal(x.posts.length, 1);
    assert.equal(x.controller.getSnapshot().workflow.error.code, "IDEMPOTENCY_EXPIRED");
  }
});
test("verify close checks entire fresh graph and cannot POST with pending links", async () => {
  const g = graph();
  g.links[0].review_state = "pending";
  const x = await setup({ reviewer: true, graph: g });
  const d = caseDetail();
  d.case = { ...d.case, state: "awaiting_verification", owner_id: "user-a" };
  x.setDetail(d);
  await x.controller.refresh();
  await x.controller.submitTransition({
    action: "verify_close",
    reason: "close",
    expected_version: 1,
  });
  assert.equal(x.posts.length, 0);
  assert.equal(x.controller.getSnapshot().workflowGraph.pendingCount, 1);
});
test("401/403/404 purge artifacts and revalidate at most once", async () => {
  for (const status of [401, 403, 404]) {
    const x = await setup({
      post: async () => {
        throw err("HTTP_" + status, status);
      },
    });
    await x.controller.submitTransition(body());
    assert.equal(x.controller.getSnapshot().detail.data, null);
    assert.equal(x.rechecks(), status === 401 ? 0 : 1);
  }
});
test("late POST completion after scope/role/route reset cannot restore state or refetch", async () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  const x = await setup({ post: () => promise });
  const task = x.controller.submitTransition(body());
  await tick();
  x.controller.stop();
  resolve({ ...caseDetail().case, state: "assigned", version: 2 });
  await task;
  assert.deepEqual(x.controller.getSnapshot(), initialCasesState());
  assert.equal(x.reads(), 2);
});

test("form event argument cannot accidentally select replay; full reviewer workflow uses authoritative versions", async () => {
  const x = await setup({ reviewer: true, graph: { ...graph(), links: [] } });
  await x.controller.submitTransition(body(), { type: "submit" });
  for (const action of [
    "start",
    "request_verification",
    "verification_failed",
    "request_verification",
    "verify_close",
    "reopen",
  ]) {
    x.controller.beginNewTransition();
    const d = x.controller.getSnapshot().detail.data;
    await x.controller.submitTransition({
      action,
      reason: "reason " + action,
      expected_version: d.case.version,
    });
    assert.equal(x.controller.getSnapshot().detail.data.case.state, transitionStates[action].to);
  }
  assert.equal(x.posts.length, 7);
  assert.equal(x.controller.getSnapshot().detail.data.case.version, 8);
});
test("confirmed write with failed GET never replays; conflict/guard/key errors require explicit new intent", async () => {
  const x = await setup({
    read: (n, d) => {
      if (n === 3) throw err("HTTP_503", 503);
      return structuredClone(d);
    },
  });
  await x.controller.submitTransition(body());
  assert.equal(x.controller.getSnapshot().workflow.status, "success");
  assert.equal(x.controller.getSnapshot().detail.status, "error");
  await x.controller.retryTransition();
  assert.equal(x.posts.length, 1);
  await x.controller.refresh();
  assert.equal(x.controller.getSnapshot().detail.data.case.version, 2);
  for (const code of ["VERSION_CONFLICT", "GUARD_FAILED", "IDEMPOTENCY_CONFLICT"]) {
    const y = await setup({
      post: async () => {
        throw err(code, code === "GUARD_FAILED" ? 422 : 409);
      },
    });
    await y.controller.submitTransition(body());
    await y.controller.submitTransition(body());
    await y.controller.retryTransition();
    assert.equal(y.posts.length, 1);
    assert.equal(y.controller.getSnapshot().workflow.error.code, code);
  }
});
