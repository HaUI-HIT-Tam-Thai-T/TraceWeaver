# Stateful lab sandbox and case verification

This module simulates resource allocation; it does not provision a VM or execute a network health probe.
`passed` means the simulated environment is running and its successful attempt allocated the requested RAM.
Do not describe this evidence as verification of an external production environment.

## Setup

Apply migrations 008–010 using the existing migration command and database owner.
Existing workspaces are not enabled automatically. In an isolated demo workspace, an administrator
with read grants for three sources calls `POST /api/v1/workspaces/{wid}/lab/configure`:

```json
{"source_ids":["<intake UUID>","<account UUID>","<provision UUID>"],"ram":2}
```

The sources must have distinct intake/account/provision services. Configuration cannot overwrite a sandbox.
The administrator role does not imply data access or reviewer permission.
Set `LAB_INGEST_SUBJECT` on the API to an existing dedicated service-account subject with active workspace
membership, `ingest_service` role and ingest grants for these sources. No service token is exposed to browsers.
The collector sends the transactional outbox through the existing ingestion service every two seconds.
Absent this setting, logs stay queued. Failed deliveries retry; source IDs remain stable across retries.
Operators cannot impersonate this service account by submitting a subject in request bodies.

## Demo sequence

1. `GET /api/v1/workspaces/{wid}/lab` reads the current `version`.
2. Operator sends commands to `POST /api/v1/workspaces/{wid}/lab/commands`:
   `{"action":"submit","request_id":"LAB-001","ram":4,"expected_version":1}`.
   Intake/account logs are queued atomically with the source state.
3. Send `{"action":"provision","request_id":"LAB-001","operation_id":"attempt-1","expected_version":2}`.
   It fails with insufficient RAM and queues a provision failure log.
4. Find the request in TraceWeaver events, reconstruct the three sources, review links and create a case.
   Assign an owner, investigate, add notes/evidence and request verification.
5. Reviewer sends `{}` to `POST /api/v1/workspaces/{wid}/cases/{cid}/verifications`.
   The result is persisted as failed. Closing is rejected.
6. Administrator sends a capacity command, using the latest lab version:
   `{"action":"capacity","ram":8,"expected_version":3}`.
7. Operator provisions again with a NEW operation ID and current version. Retrying the original operation ID
   replays that original operation; it does not execute a new attempt.
8. Reviewer runs verification again, then uses the existing `verify_close` transition with current case version.
   Closure checks the source again inside the transaction and stores the proof in immutable workflow history.

Use GET on the case `verifications` URL to retrieve immutable checks after reload. Read access requires
current case/run and sandbox source scope. POST is reviewer-only and accepts no client assertion of success.
Opening a case again requires a new reason and a new verification for its new case version.

## Policy and limitations

- Configuring a sandbox enables the additional closure guard for cases in that workspace. Use a dedicated
  workspace: historic static requests absent from the sandbox produce an inconclusive check and cannot close.
- The root event must carry exactly one distinct request identifier. It is matched to authoritative source state.
- A change to any lab state version invalidates a previously passing check, including unrelated allocations.
  Recheck before closing; this deliberately conservative first policy avoids stale proofs.
- Non-sandbox workspaces retain the existing reviewer/evidence closure policy. This is NOT a general verifier
  for arbitrary external systems. Those need a trusted source adapter and an explicit verification policy.
- Max 1,000 requests and 20 attempts per request. No reset/delete route is provided.
- Inspection is a point-in-time source observation; no continuous uptime guarantee is made.
- Source delivery failures are recorded in `core.lab_outbox` (`attempts`, `last_error`); an admin UI and
  dedicated delivery-history API are not implemented yet.
- FE buttons, general workspace membership administration, a complete bootstrap command and release-level
  installation/E2E/performance/AI evaluation remain separate work. These endpoints are available in Swagger.

## Tests

`npm run test:sim` checks source-domain behavior. `npm run test:db` includes PostgreSQL tests for persisted
capacity, permissions, concurrency, delivery replay/dedup, repair, stale checks, close and reopen.
Integration tests require an isolated database administrator with CREATEDB, never a production runtime role.
