import assert from "node:assert/strict";
import { test } from "node:test";
import { membershipSchema } from "../src/features/workspace/schemas.ts";
import { graphSchema } from "../src/features/reconstruction/schemas.ts";
import { graph } from "./reconstruction-fixtures.mjs";
import { EID, EID2, WID } from "./event-fixtures.mjs";

test("membership accepts old DTO and optional audited name for all read roles, preserves strict validation", () => {
  for (const role of ["viewer", "operator", "reviewer", "admin"]) {
    const old = { workspace_id: WID, roles: [role], group_ids: [] };
    assert.equal(membershipSchema.safeParse(old).success, true);
    assert.equal(
      membershipSchema.parse({ ...old, workspace_name: "Điều tra" }).workspace_name,
      "Điều tra",
    );
    for (const value of [null, 7, {}, "", "  "])
      assert.equal(membershipSchema.safeParse({ ...old, workspace_name: value }).success, false);
    assert.equal(membershipSchema.safeParse({ ...old, unknown_field: true }).success, false);
  }
});

test("graph accepts backend-platform abstention shapes and old responses without disabling validation", () => {
  assert.deepEqual(graphSchema.parse(graph()).abstentions, []);
  const abstentions = [
    { event_id: EID, reason_code: "OUTCOME_UNKNOWN" },
    {
      transition_id: "intake-account",
      from_event_id: EID,
      to_event_id: EID2,
      reason_code: "AMBIGUOUS_MATCH",
    },
  ];
  assert.deepEqual(graphSchema.parse({ ...graph(), abstentions }).abstentions, abstentions);
  for (const invalid of [
    { reason_code: "x" },
    { event_id: "bad", reason_code: "x" },
    { event_id: EID, reason_code: 1 },
    { event_id: EID, reason_code: "x", extra: true },
  ]) {
    assert.equal(graphSchema.safeParse({ ...graph(), abstentions: [invalid] }).success, false);
  }
});
