# Stateful lab sandbox and case verification

This module simulates RAM allocation, an available image and an active business account; it does not
provision a VM, access a registry or execute a network health probe. Business accounts are synthetic,
independent of Keycloak login accounts. `passed` means a current attempt satisfied all three conditions
and its simulated environment matches the request and allocated RAM.
Do not describe this evidence as verification of an external production environment.

## Oracle demo deployment — 29/10/2026

BE runtime source60919cd is deployed at https://api.quizlearn.tech (image `traceweaver-api:be-60919cd`).
Migrations008–010 and runtime table grants applied; collector enabled using the existing ingest service
account without exposing its credentials. Dedicated workspace: `10000000-0000-4000-8000-000000000016`,
name `TraceWeaver Sandbox — Mô phỏng kiểm chứng`. Existing operator, reviewer, workspace-admin and viewer
accounts have separate roles/source grants in this workspace; old workspace grants remain unchanged.

Live HTTPS/Keycloak Code+PKCE verification passed36 checks. Request `LAB-LIVE-20261029-155343`
had four attempts: insufficient RAM -> unavailable image -> disabled account -> passed, with ingested logs
and immutable reviewer proof before closure. Case: `f10e80e1-7972-4b4f-856b-155c6d9f4ced`.
The run used the real hybrid scorer without degraded fallback; this is not a model-quality benchmark.
One earlier trial case remains investigating after the verification script initially expected200 instead
of the correct201 review response; it was preserved rather than deleted.

Server-only evidence/configuration lives under `.local/oracle/`: `be45-live-verification.json`,
`be45-before.json`, `be45-after.json`, and the previous release/image records for rollback. Hashes of old
events/runs/cases/memberships/roles/grants/sources matched before/after. DB/Keycloak/scorer/other apps
were not restarted. FE sandbox controls and browser E2E remain separate work; these checks used HTTPS API.

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
The Oracle deployment overlay forwards the optional `LAB_INGEST_SUBJECT` from its private server env.
Absent this setting, logs stay queued. Failed deliveries retry; source IDs remain stable across retries.
Operators cannot impersonate this service account by submitting a subject in request bodies.

## Demo sequence

### Case-bound API for FE (checker `lab-state-2`)

`GET /api/v1/workspaces/{wid}/cases/{cid}/sandbox` returns
`{case_id,case_version,observation}`. Observation includes `request_id`, `source_version`, `conditions`,
`attempts`, latest `attempt`, `environment`, `result`, `reason`, and `delivery:{status,total,delivered}`.
`conditions` carries immutable `required_ram`, `image_id`, `account_id` and current booleans
`image_available`, `account_active`. Each attempt stores these IDs/booleans, RAM requirements/availability,
three `checks:{step,passed,reason}`, all `blockers`, the first blocking `reason`, operation ID and timestamp.
Checks are preflight conditions: all three are evaluated; they do not claim external infrastructure ran.

Use `POST .../cases/{cid}/sandbox/commands` with `expected_case_version` and `expected_version`
(the observed sandbox `source_version`). Never send `request_id`; BE derives it from the case root.
The root must be an ingested event from the sandbox outbox, not another event with the same request string.
Commands use one transaction with the case/run and sandbox locks. Closed cases must be reopened.

```json
{"action":"capacity","ram":8,"expected_case_version":4,"expected_version":3}
```
```json
{"action":"image","image_id":"lab-image-LAB-001","available":true,"expected_case_version":4,"expected_version":4}
```
```json
{"action":"account","account_id":"lab-account-LAB-001","active":true,"expected_case_version":4,"expected_version":5}
```
```json
{"action":"provision","operation_id":"unique-new-attempt","expected_case_version":4,"expected_version":6}
```

Capacity/image/account require administrator plus source read access. Provision requires operator/reviewer
plus source access. The same commands on `/lab/commands` need `request_id` except capacity.
At submit, optional `image_available:false` and/or `account_active:false` create combined faults;
both default true, so existing RAM demos retain their meaning. Image/account IDs are stable per request;
repairing a different resource returns 422 `LAB_COMMAND_REJECTED` / `RESOURCE_MISMATCH`.
These are per-request simulated resources, not a shared real registry/account administration system.
At submit, request ID and its derived account/image IDs must remain unchanged under ingestion redaction.
IDs containing credential-like text (for example `token=...` or `Bearer ...`) return400 `INVALID_INPUT`
before state/log creation; use stable codes such as `LAB-001`. The response never echoes the rejected ID.
Existing requests/logs are not renamed or rewritten by this validation change.

Rerunning an existing environment reuses its allocation/identity and never spends RAM twice.
A failed rerun stops that simulated environment while keeping its RAM reserved; a later successful retry
reactivates it. No deletion/release route is introduced. Reusing an operation ID never creates another
attempt or log; case command responses include `execution:{replayed,operation_id,attempt}` so FE can
distinguish the original operation result from the current observation.

Any sandbox state version change requires a fresh execution, even unrelated changes (conservative policy).
No attempt -> `inconclusive/NOT_EXECUTED`; old execution -> `inconclusive/RERUN_REQUIRED`;
failed conditions -> `failed` with blockers. Old checker-v1 attempts require rerunning, not data rewriting.
Input/version errors: 400 invalid body; 409 case or sandbox version conflict; 422 closed case,
wrong resource, request binding or attempt limit; 403 role failure; 404 inaccessible scope.

Execution and delivery are separate: `passed` plus `delivery.status=pending` means simulation succeeded
but its new log is not confirmed ingested. It is not a business failure. Reviewer POSTs `{}` to the existing
case `verifications` endpoint after delivery; a proof saved while pending cannot close the case, even if
delivery finishes later. A new reviewer check is required. Closure compares checker/source/case versions,
request/attempt/environment and current successful delivery. No new migration is needed beyond 008–010.

### Original RAM example

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
- A change to any lab state version requires rerunning and then a new reviewer check, including unrelated allocations.
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
