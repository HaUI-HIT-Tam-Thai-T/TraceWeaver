// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
"use strict";
// Copied to the bundle root. This tests Node -> scorer HTTP, not BE integration.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8"));

async function main() {
  const address = new URL(process.env.SCORER_INTERNAL_URL || "http://127.0.0.1:8000");
  if (address.protocol !== "http:" || address.hostname !== "127.0.0.1" || address.pathname !== "/" || address.search || address.hash || address.username || address.password) {
    throw new Error("This local probe requires http://127.0.0.1:<port>");
  }
  const secret = process.env.SCORER_SERVICE_SECRET;
  if (!secret || secret.length < 32 || /\s/.test(secret)) throw new Error("Set SCORER_SERVICE_SECRET locally before running the probe");
  const expected = read("samples/expected-response.json");
  const payload = read("samples/score-request.json");
  const response = await fetch(new URL("/internal/v1/score-pairs", address), {
    method: "POST", signal: AbortSignal.timeout(5000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify(payload)
  });
  assert.equal(response.status, 200, "Scorer did not return HTTP 200");
  assert.equal(response.headers.get("x-scorer-method"), "model");
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ["feature_schema_version", "model_version", "predictions"]);
  assert.equal(body.model_version, expected.model_version);
  assert.equal(body.feature_schema_version, "1");
  assert.equal(body.predictions.length, payload.pairs.length);
  const wanted = new Map(expected.predictions.map(item => [item.pair_id, item.score]));
  for (const prediction of body.predictions) {
    assert.deepEqual(Object.keys(prediction).sort(), ["pair_id", "score"]);
    assert.ok(wanted.has(prediction.pair_id), "Missing, extra or duplicate pair_id");
    assert.equal(typeof prediction.score, "number");
    assert.ok(Number.isFinite(prediction.score) && prediction.score >= 0 && prediction.score <= 1);
    assert.ok(Math.abs(prediction.score - wanted.get(prediction.pair_id)) <= 1e-6, "Score differs from offline reference");
    wanted.delete(prediction.pair_id);
  }
  assert.equal(wanted.size, 0);
  console.log(JSON.stringify({ status: "passed", model_version: body.model_version,
    feature_schema_version: body.feature_schema_version, checked_pairs: body.predictions.length, method: "model" }));
}
main().catch(() => { console.error("Node scorer probe failed; check local URL/credential, model version, response schema and scores."); process.exitCode = 1; });
