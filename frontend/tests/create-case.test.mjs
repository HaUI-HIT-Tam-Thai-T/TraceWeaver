import assert from "node:assert/strict";
import { test } from "node:test";
import { createCaseCreationController } from "../src/features/cases/state/createCaseController.ts";
import { ApiError } from "../src/services/apiError.ts";
import { scope } from "./event-fixtures.mjs";
import { run, RID } from "./reconstruction-fixtures.mjs";
import { caseItem, CID } from "./case-fixtures.mjs";

const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { resolve, reject, promise };
};
function setup(overrides = {}) {
  let time = 0,
    keys = 0,
    rechecks = 0;
  const calls = [];
  const controller = createCaseCreationController({
    service: {
      createCase: async (...args) => {
        calls.push(args);
        return overrides.createCase ? overrides.createCase(...args) : caseItem();
      },
    },
    getRun: overrides.getRun ?? (async () => run()),
    revalidate: async () => {
      rechecks++;
    },
    now: () => time,
    newKey: () => `key-${++keys}`,
  });
  const access = scope(),
    anchor = {};
  controller.sync(access, RID, anchor);
  return {
    controller,
    calls,
    access,
    anchor,
    setTime: (n) => (time = n),
    rechecks: () => rechecks,
  };
}
test("case creation validates title/role and preflights completed run before creating key/POST", async () => {
  const x = setup();
  await x.controller.create("  ");
  assert.equal(x.calls.length, 0);
  x.controller.newOperation();
  await x.controller.create(" case ");
  assert.equal(x.calls[0][1].title, "case");
  assert.equal(x.controller.getSnapshot().caseId, CID);
  const y = setup({ getRun: async () => run("running") });
  await y.controller.create("case");
  assert.equal(y.calls.length, 0);
  assert.equal(y.controller.getSnapshot().error.code, "RUN_NOT_READY");
  const z = setup();
  z.controller.sync(scope(false), RID, z.anchor);
  await z.controller.create("case");
  assert.equal(z.calls.length, 0);
});
test("double submit locks; uncertain retry preserves same key/body; new operation gets new key", async () => {
  const d = deferred(),
    x = setup({ createCase: () => d.promise });
  const task = x.controller.create(" case ");
  await tick();
  await x.controller.create("another");
  assert.equal(x.calls.length, 1);
  d.reject(new ApiError({ kind: "timeout", code: "TIMEOUT", message: "Safe" }));
  await task;
  assert.equal(x.controller.getSnapshot().status, "uncertain");
  await x.controller.retry();
  assert.equal(x.calls.length, 2);
  assert.deepEqual(x.calls[0][1], x.calls[1][1]);
  assert.equal(x.calls[0][2].idempotencyKey, x.calls[1][2].idempotencyKey);
  x.controller.newOperation();
  await x.controller.create("different");
  assert.equal(x.calls[2][2].idempotencyKey, "key-2");
});
test("TTL checked before and after preflight prevents expired replay; schema/network failures do not auto POST", async () => {
  const d = deferred();
  let preflight = 0;
  const x = setup({
    getRun: async () => (++preflight === 1 ? run() : d.promise),
    createCase: async () => {
      throw new ApiError({ kind: "network", code: "NETWORK_ERROR", message: "Safe" });
    },
  });
  await x.controller.create("case");
  x.setTime(86399999);
  const task = x.controller.retry();
  await tick();
  x.setTime(86400000);
  d.resolve(run());
  await task;
  assert.equal(x.calls.length, 1);
  assert.equal(x.controller.getSnapshot().error.code, "IDEMPOTENCY_EXPIRED");
  const y = setup({
    createCase: async () => {
      throw new ApiError({ kind: "client", code: "INVALID_API_RESPONSE", message: "Safe" });
    },
  });
  await y.controller.create("case");
  assert.equal(y.calls.length, 1);
  assert.equal(y.controller.getSnapshot().status, "uncertain");
  y.setTime(86400000);
  await y.controller.retry();
  assert.equal(y.calls.length, 1);
});
test("replayed Case may have stale version: controller exposes ID only, never trusts workflow state", async () => {
  const x = setup({
    createCase: async () => ({
      ...caseItem(),
      state: "assigned",
      owner_id: "other-subject",
      version: 2,
    }),
  });
  await x.controller.create("case");
  assert.equal(x.controller.getSnapshot().caseId, CID);
  assert.equal("case" in x.controller.getSnapshot(), false);
  await x.controller.retry();
  assert.equal(x.calls.length, 1);
});
test("scope/run/root reset or logout aborts create and prevents stale success/navigation", async () => {
  const d = deferred();
  let signal;
  const x = setup({
    createCase: async (_wid, _body, opts) => {
      signal = opts.signal;
      return d.promise;
    },
  });
  const task = x.controller.create("case");
  await tick();
  x.controller.sync({ ...x.access, accessKey: {} }, RID, {});
  assert.ok(signal.aborted);
  d.resolve(caseItem());
  await task;
  assert.equal(x.controller.getSnapshot().caseId, null);
  assert.equal(x.controller.getSnapshot().attempt, null);
  x.controller.stop();
  await x.controller.create("case");
  assert.equal(x.calls.length, 1);
});
test("401/403/404 clear operation and revalidate once, no automatic replay", async () => {
  for (const status of [401, 403, 404]) {
    const x = setup({
      createCase: async () => {
        throw new ApiError({
          kind: status === 401 ? "auth" : "http",
          status,
          code: `HTTP_${status}`,
          message: "Safe",
        });
      },
    });
    await x.controller.create("case");
    await x.controller.retry();
    await x.controller.create("case");
    assert.equal(x.calls.length, 1);
    assert.equal(x.controller.getSnapshot().attempt, null);
    assert.equal(x.rechecks(), status === 401 ? 0 : 1);
  }
});
