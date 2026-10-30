import assert from "node:assert/strict";
import { test } from "node:test";
import { createLinkReviewService } from "../src/features/link-review/services/createLinkReviewService.ts";
import {
  reasonSchema,
  manualLinkCreateSchema,
  manualLinkIssue,
} from "../src/features/link-review/schemas.ts";
import { graph, RID } from "./reconstruction-fixtures.mjs";
import { WID, EID, EID2 } from "./event-fixtures.mjs";

const LID = graph().links[0].id;
const body = { decision: "accepted", reason: "  reviewed  ", expected_version: 3 };
const review = () => ({
  id: "77777777-7777-4777-8777-777777777777",
  link_id: LID,
  decision: "accepted",
  reason: "reviewed",
  actor_subject: "operator",
  created_at: "2026-10-26T06:00:01Z",
  link_version: 4,
});
const manual = () => ({
  ...graph().links[0],
  method: "manual",
  review_state: "pending",
  score: null,
  version: 1,
});
test("reason trim/limits, exact input fields, self-link and existing rejected pair validation", () => {
  assert.equal(reasonSchema.parse(" x "), "x");
  for (const input of ["", " \n\t ", "x".repeat(1001)])
    assert.equal(reasonSchema.safeParse(input).success, false);
  assert.ok(reasonSchema.safeParse("x".repeat(1000)).success);
  assert.equal(
    manualLinkCreateSchema.safeParse({ from_event_id: EID, to_event_id: EID, reason: "why" })
      .success,
    false,
  );
  const g = graph();
  g.links[0].review_state = "rejected";
  assert.equal(
    manualLinkIssue({ from_event_id: EID, to_event_id: EID2, reason: "why" }, g),
    "LINK_EXISTS",
  );
  assert.equal(
    manualLinkIssue({ from_event_id: EID, to_event_id: RID, reason: "why" }, g),
    "INVALID_LINK_INPUT",
  );
});
test("review and manual POST use strict paths/body/signal without Idempotency-Key and return validated DTOs", async () => {
  const calls = [];
  const service = createLinkReviewService({
    post: async (...args) => {
      calls.push(args);
      return { data: args[0].endsWith("/reviews") ? review() : manual() };
    },
  });
  const signal = new AbortController().signal;
  await service.reviewLink(WID, RID, LID, body, signal);
  await service.createManualLink(
    WID,
    RID,
    { from_event_id: EID, to_event_id: EID2, reason: " why " },
    signal,
  );
  assert.equal(calls[0][0], `/api/v1/workspaces/${WID}/runs/${RID}/links/${LID}/reviews`);
  assert.deepEqual(calls[0][1], { ...body, reason: "reviewed" });
  assert.deepEqual(calls[0][2], { signal });
  assert.equal(calls[1][0], `/api/v1/workspaces/${WID}/runs/${RID}/links`);
  assert.equal(calls[1][1].reason, "why");
  await assert.rejects(service.reviewLink(WID, RID, LID, { ...body, version: 2 }), {
    code: "INVALID_LINK_INPUT",
  });
  await assert.rejects(
    service.createManualLink("bad", RID, { from_event_id: EID, to_event_id: EID2, reason: "why" }),
    { code: "INVALID_LINK_INPUT" },
  );
  assert.equal(calls.length, 2);
});
test("wrong review link/decision/version and malformed/manual accepted responses are rejected", async () => {
  for (const patch of [
    { link_id: RID },
    { decision: "rejected" },
    { link_version: 3 },
    { created_at: "bad" },
  ]) {
    const service = createLinkReviewService({
      post: async () => ({ data: { ...review(), ...patch } }),
    });
    await assert.rejects(service.reviewLink(WID, RID, LID, body), { code: "INVALID_API_RESPONSE" });
  }
  for (const patch of [
    { from_event_id: RID },
    { method: "rule" },
    { review_state: "accepted" },
    { score: 0 },
    { version: 2 },
  ]) {
    const service = createLinkReviewService({
      post: async () => ({ data: { ...manual(), ...patch } }),
    });
    await assert.rejects(
      service.createManualLink(WID, RID, { from_event_id: EID, to_event_id: EID2, reason: "why" }),
      { code: "INVALID_API_RESPONSE" },
    );
  }
});
