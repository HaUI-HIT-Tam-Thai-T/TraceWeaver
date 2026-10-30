import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/services/apiError.ts";
import { createReconstructionController } from "../src/features/reconstruction/state/controller.ts";
import { runFormDefaults, toRunBody } from "../src/features/reconstruction/form.ts";
import { event, scope, EID2 } from "./event-fixtures.mjs";
import { run, graph } from "./reconstruction-fixtures.mjs";

const body = () => toRunBody(runFormDefaults(event()), event());
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const tick = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
function setup(overrides = {}) {
  let time = 0,
    keys = 0,
    rechecks = 0;
  const calls = [],
    timers = [];
  const service = {
    createRun: async (...args) => {
      calls.push(["post", ...args]);
      return run();
    },
    getRun: async () => run(),
    getGraph: async () => graph(),
    ...overrides,
  };
  const controller = createReconstructionController({
    service,
    getEvent: overrides.getEvent ?? (async () => event()),
    revalidate: async () => {
      rechecks++;
    },
    now: () => time,
    newKey: () => `key-${++keys}`,
    schedule: (fn, delay) => {
      const item = { fn, delay, canceled: false };
      timers.push(item);
      return () => {
        item.canceled = true;
      };
    },
  });
  const access = scope(),
    root = event();
  controller.sync(access, root);
  return {
    controller,
    access,
    root,
    calls,
    timers,
    setTime: (n) => (time = n),
    rechecks: () => rechecks,
  };
}
test("preflight rejects stale root/source/window, read-only scope and no scope before POST", async () => {
  const x = setup();
  x.controller.sync(scope(false), x.root);
  await x.controller.create(body());
  assert.equal(x.calls.length, 0);
  x.controller.sync(x.access, x.root);
  await x.controller.create({ ...body(), source_ids: [EID2] });
  assert.equal(x.calls.length, 0);
  const y = setup({ getEvent: async () => event(EID2) });
  await y.controller.create(body());
  assert.equal(y.calls.length, 0);
  x.controller.stop();
  await x.controller.create(body());
  assert.equal(x.calls.length, 0);
});
test("completed/degraded loads graph immediately; failed never polls or loads graph", async () => {
  for (const status of ["completed", "failed"]) {
    let graphs = 0;
    const x = setup({
      createRun: async () => run(status, { degraded: true, degraded_reason: "ai_unavailable" }),
      getGraph: async () => {
        graphs++;
        return graph();
      },
    });
    await x.controller.create(body());
    assert.equal(graphs, status === "completed" ? 1 : 0);
    assert.equal(x.timers.length, 0);
    assert.equal(x.controller.getSnapshot().run.status, status);
  }
});
test("double submission blocked; uncertain manual retry uses identical body and key, new action gets new key", async () => {
  const first = deferred(),
    sent = [];
  const x = setup({
    createRun: async (...args) => {
      sent.push(args);
      return first.promise;
    },
  });
  const sending = x.controller.create(body());
  await tick();
  await x.controller.create(body());
  assert.equal(sent.length, 1);
  first.reject(new ApiError({ kind: "timeout", code: "TIMEOUT", message: "safe" }));
  await sending;
  assert.equal(x.controller.getSnapshot().phase, "uncertain");
  await x.controller.retry();
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0][1], sent[1][1]);
  assert.equal(sent[0][2].idempotencyKey, sent[1][2].idempotencyKey);
  x.controller.newOperation();
  await x.controller.create(body());
  assert.equal(sent[2][2].idempotencyKey, "key-2");
});
test("key expires after 24h and refresh failures cannot issue POST", async () => {
  const x = setup({
    createRun: async () => {
      throw new ApiError({ kind: "network", code: "NETWORK_ERROR", message: "safe" });
    },
  });
  await x.controller.create(body());
  x.setTime(86400000);
  await x.controller.retry();
  assert.equal(x.controller.getSnapshot().error.code, "IDEMPOTENCY_EXPIRED");
  const y = setup({
    getEvent: async () => {
      throw new ApiError({ kind: "auth", code: "AUTH", message: "safe" });
    },
  });
  await y.controller.create(body());
  assert.equal(y.calls.length, 0);
  assert.equal(y.controller.getSnapshot().phase, "reauth");
});
test("queued/running poll sequential backoff, terminal completion stops and loads graph", async () => {
  let polls = 0;
  const x = setup({
    createRun: async () => run("queued"),
    getRun: async () => run(++polls === 3 ? "completed" : "running"),
  });
  await x.controller.create(body());
  assert.equal(x.timers[0].delay, 1000);
  for (let i = 0; i < 3; i++) {
    x.timers[i].fn();
    await tick();
  }
  assert.deepEqual(
    x.timers.map((t) => t.delay),
    [1000, 2000, 4000],
  );
  assert.equal(x.controller.getSnapshot().graphStatus, "ready");
  assert.equal(polls, 3);
});
test("polling pauses at deadline, errors stop, manual continuation only GETs", async () => {
  let polls = 0;
  const x = setup({
    createRun: async () => run("queued"),
    getRun: async () => {
      polls++;
      throw new ApiError({ kind: "network", code: "NETWORK_ERROR", message: "safe" });
    },
  });
  await x.controller.create(body());
  x.setTime(300000);
  x.timers[0].fn();
  assert.equal(x.controller.getSnapshot().tracking, "paused");
  assert.equal(polls, 0);
  await x.controller.track();
  assert.equal(polls, 1);
  assert.equal(x.controller.getSnapshot().tracking, "error");
  assert.equal(x.timers.length, 1);
});
test("graph error does not replay POST, RUN_NOT_READY waits for manual graph retry", async () => {
  let graphs = 0;
  const x = setup({
    getGraph: async () => {
      if (++graphs === 1)
        throw new ApiError({ kind: "http", status: 409, code: "RUN_NOT_READY", message: "safe" });
      return graph();
    },
  });
  await x.controller.create(body());
  assert.equal(x.controller.getSnapshot().graphStatus, "error");
  assert.equal(x.timers.length, 0);
  await x.controller.loadGraph();
  assert.equal(x.calls.length, 1);
  assert.equal(x.controller.getSnapshot().graphStatus, "ready");
});
test("scope/root change, stop and late responses cannot restore artifacts; active requests are aborted", async () => {
  const d = deferred();
  let signal;
  const x = setup({
    createRun: async (_wid, _body, opts) => {
      signal = opts.signal;
      return d.promise;
    },
  });
  const request = x.controller.create(body());
  await tick();
  x.controller.sync(scope(), event(EID2));
  assert.ok(signal.aborted);
  d.resolve(run());
  await request;
  assert.equal(x.controller.getSnapshot().run, null);
  x.controller.stop();
  assert.equal(x.controller.getSnapshot().attempt, null);
  x.controller.sync(x.access, x.root);
  await x.controller.create(body());
  assert.equal(x.controller.getSnapshot().run.status, "completed");
});
test("401/403/404 purge artifacts; access recheck once, no automatic POST replay", async () => {
  for (const status of [401, 403, 404]) {
    const x = setup({
      getGraph: async () => {
        throw new ApiError({
          kind: status === 401 ? "auth" : "http",
          status,
          code: `HTTP_${status}`,
          message: "safe",
        });
      },
    });
    await x.controller.create(body());
    await x.controller.create(body());
    await x.controller.retry();
    assert.equal(x.controller.getSnapshot().run, null);
    assert.equal(x.controller.getSnapshot().attempt, null);
    assert.equal(x.rechecks(), status === 401 ? 0 : 1);
    assert.equal(x.calls.length, 1);
  }
});
test("pending GET is never overlapped, stale timer and stale graph cannot survive cleanup/remount", async () => {
  const d = deferred();
  let polls = 0;
  const x = setup({
    createRun: async () => run("running"),
    getRun: async () => {
      polls++;
      return d.promise;
    },
  });
  await x.controller.create(body());
  x.timers[0].fn();
  await tick();
  await x.controller.track();
  assert.equal(polls, 1);
  x.controller.stop();
  x.controller.sync(x.access, x.root);
  d.resolve(run());
  await tick();
  assert.equal(x.controller.getSnapshot().run, null);
  x.timers[0].fn();
  assert.equal(x.controller.getSnapshot().tracking, "idle");
  const g = deferred();
  const y = setup({ getGraph: async () => g.promise });
  const loading = y.controller.create(body());
  await tick();
  y.controller.sync(null, null);
  g.resolve(graph());
  await loading;
  assert.equal(y.controller.getSnapshot().graph, null);
});
test("malformed response remains uncertain and graph nodes outside frozen source/window are rejected", async () => {
  const x = setup({
    createRun: async () => {
      throw new ApiError({ kind: "client", code: "INVALID_API_RESPONSE", message: "safe" });
    },
  });
  await x.controller.create(body());
  assert.equal(x.controller.getSnapshot().phase, "uncertain");
  const y = setup({
    getGraph: async () => {
      const g = graph();
      g.nodes[0].occurred_at = "2026-10-26T09:00:00Z";
      return g;
    },
  });
  await y.controller.create(body());
  assert.equal(y.controller.getSnapshot().graph, null);
  assert.equal(y.controller.getSnapshot().error.code, "INVALID_API_RESPONSE");
});
