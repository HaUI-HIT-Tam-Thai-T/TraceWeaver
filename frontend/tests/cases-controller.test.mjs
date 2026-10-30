import assert from "node:assert/strict";
import { test } from "node:test";
import { CanceledError } from "axios";
import { createCasesController } from "../src/features/cases/state/controller.ts";
import { ApiError } from "../src/services/apiError.ts";
import { caseItem, caseDetail, CID, CID2 } from "./case-fixtures.mjs";
import { scope } from "./event-fixtures.mjs";

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
  let rechecks = 0;
  const calls = [];
  const controller = createCasesController(
    {
      listCases: async (...args) => {
        calls.push(["list", ...args]);
        return overrides.listCases
          ? overrides.listCases(...args)
          : { items: [caseItem()], next_cursor: "next" };
      },
      getCase: async (...args) => {
        calls.push(["detail", ...args]);
        return overrides.getCase ? overrides.getCase(...args) : caseDetail(args[1]);
      },
    },
    async () => {
      rechecks++;
    },
  );
  return { controller, calls, rechecks: () => rechecks };
}
test("cases require ready scope and active route; invalid URL/ID never sends API request", async () => {
  const x = setup();
  x.controller.sync(null, { kind: "list", search: "" });
  await tick();
  assert.equal(x.calls.length, 0);
  x.controller.sync(scope(), { kind: "none" });
  x.controller.sync(scope(), { kind: "detail", caseId: "bad", search: "" });
  await tick();
  assert.equal(x.calls.length, 0);
  assert.equal(x.controller.getSnapshot().status, "invalid");
  const readyScope = scope();
  x.controller.sync(readyScope, { kind: "list", search: "?state=waiting" });
  await tick();
  x.controller.sync(readyScope, { kind: "list", search: "" });
  await tick();
  assert.equal(x.calls.length, 1);
  assert.equal(x.controller.getSnapshot().status, "active");
});
test("case cursor previous/next repeat filters/limit without caching payload pages; refresh resets history", async () => {
  const x = setup(),
    access = scope(),
    view = { kind: "list", search: "?state=assigned&owner_id=subject&limit=25" };
  x.controller.sync(access, view);
  await tick();
  await x.controller.nextPage();
  await x.controller.previousPage();
  assert.equal(x.calls[1][3].cursor, "next");
  assert.equal(x.calls[2][3].cursor, undefined);
  assert.deepEqual(x.calls[1][2], x.calls[0][2]);
  assert.equal(x.calls[1][2].limit, 25);
  await x.controller.refresh();
  assert.deepEqual(x.controller.getSnapshot().history, [null]);
});
test("filters, case IDs and scope changes ignore out-of-order responses even if adapter does not cancel", async () => {
  const old = deferred(),
    x = setup({
      listCases: (_wid, filters) =>
        filters.state === "new" ? old.promise : { items: [caseItem(CID2)], next_cursor: null },
    }),
    access = scope();
  x.controller.sync(access, { kind: "list", search: "?state=new" });
  await tick();
  x.controller.sync(access, { kind: "list", search: "?state=closed" });
  await tick();
  old.resolve({ items: [caseItem()], next_cursor: null });
  await tick();
  assert.equal(x.controller.getSnapshot().list.items[0].id, CID2);
  const d = deferred(),
    y = setup({ getCase: (_wid, id) => (id === CID ? d.promise : caseDetail(id)) });
  y.controller.sync(access, { kind: "detail", caseId: CID, search: "" });
  await tick();
  y.controller.sync(access, { kind: "detail", caseId: CID2, search: "" });
  await tick();
  d.resolve(caseDetail());
  await tick();
  assert.equal(y.controller.getSnapshot().detail.data.case.id, CID2);
});
test("revalidation purges history/evidence/cursor and reloads same URL once; leaving route/logout aborts late request", async () => {
  const x = setup(),
    access = scope(),
    view = { kind: "list", search: "?state=new" };
  x.controller.sync(access, view);
  await tick();
  await x.controller.nextPage();
  x.controller.sync(null, view);
  assert.equal(x.controller.getSnapshot().list.items.length, 0);
  x.controller.sync({ ...access, accessKey: {} }, view);
  await tick();
  assert.equal(x.controller.getSnapshot().index, 0);
  const d = deferred(),
    y = setup({ getCase: () => d.promise });
  y.controller.sync(access, { kind: "detail", caseId: CID, search: "" });
  await tick();
  const signal = y.calls[0][3];
  y.controller.stop();
  assert.ok(signal.aborted);
  d.resolve(caseDetail());
  await tick();
  assert.equal(y.controller.getSnapshot().detail.data, null);
});
test("401 stops retries; 403/404 revalidate once across null scope without automatic loop", async () => {
  for (const status of [401, 403, 404]) {
    const x = setup({
        listCases: async () => {
          throw new ApiError({
            kind: status === 401 ? "auth" : "http",
            status,
            code: `HTTP_${status}`,
            message: "Safe",
          });
        },
      }),
      access = scope(),
      view = { kind: "list", search: "" };
    x.controller.sync(access, view);
    await tick();
    x.controller.sync(null, view);
    x.controller.sync({ ...access, accessKey: {} }, view);
    await tick();
    assert.equal(x.calls.length, 1);
    assert.equal(x.rechecks(), status === 401 ? 0 : 1);
    assert.equal(x.controller.getSnapshot().list.items.length, 0);
    if (status === 401) {
      await x.controller.refresh();
      assert.equal(x.calls.length, 1);
    }
  }
});
test("INVALID_CURSOR resets stack and waits; network/schema/timeout retry GET, cancellation stays silent", async () => {
  for (const code of ["INVALID_CURSOR", "NETWORK_ERROR", "INVALID_API_RESPONSE", "TIMEOUT"]) {
    let attempts = 0;
    const x = setup({
      listCases: async () => {
        if (++attempts === 1) throw new ApiError({ kind: "client", code, message: "Safe" });
        return { items: [], next_cursor: null };
      },
    });
    x.controller.sync(scope(), { kind: "list", search: "" });
    await tick();
    assert.equal(x.calls.length, 1);
    assert.equal(x.controller.getSnapshot().list.error.code, code);
    await x.controller.refresh();
    assert.equal(x.controller.getSnapshot().list.status, "ready");
  }
  const x = setup({
    listCases: async () => {
      throw new CanceledError();
    },
  });
  x.controller.sync(scope(), { kind: "list", search: "" });
  await tick();
  assert.equal(x.controller.getSnapshot().list.error, null);
});
