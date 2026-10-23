# Case workflow

BE-20 implements five case APIs. Backend contract progress is **16/21 implemented**, five planned; this is not overall product completion. Apply migration007 and restart the source server, or rebuild the API Docker image before using new routes there.

## API

Paths below are relative to `/api/v1/workspaces/{wid}`. All use a verified user-client JWT, current active membership and current direct/group read grants for **every requested source of the run**, including empty sources. Losing one source hides the entire case/history/evidence. Viewer/admin can read with grants; only operator/reviewer can create or add evidence. Admin needs an additional writer/reviewer role for those actions.

| Method/path | Input and result |
|---|---|
| `POST /cases` | `{run_id,title}`; 201 Case in `new`, owner null, version1, Location to detail |
| `GET /cases` | Optional `state,owner_id,limit,cursor`; 200 CasesPage |
| `GET /cases/{cid}` | 200 `{case,history,evidence}` |
| `POST /cases/{cid}/evidence` | `{kind,event_ids,note}`; 201 Evidence |
| `POST /cases/{cid}/transitions` | `{action,expected_version,reason,owner_id?}`; 200 Case |

CaseCreate/CaseTransition/EvidenceCreate use existing closed JSON schemas. Server derives actor, IDs, initial state, version and timestamps. Title is nonblank, max300 characters; reason is nonblank, max1000; note max10000. NUL/invalid Unicode is rejected. Known password/token/Bearer patterns are redacted and output bounds revalidated. Opaque owner subjects retain case/whitespace; all-whitespace owners are invalid. `owner_id` is accepted only for assign, not as a hidden reassignment on another action.

POST requires application/json, max1MiB. Unknown/repeated query parameters, invalid IDs, wrong media and malformed JSON fail before writes. Invalid body/guard/action returns422; stale version409; role403; resources outside scope404. Database/audit errors return sanitized503. All errors use the existing Error schema and request_id.

## State and guards

`case_handling` definition version1 follows:

`new → assigned → investigating → awaiting_verification → closed`

`verification_failed` returns awaiting_verification to investigating. `reopen` returns closed to investigating.

| Action | Permission | Required server facts |
|---|---|---|
| assign | Operator/reviewer | Owner is current operator/reviewer with active membership and full source scope |
| start | Current owner or reviewer | Valid current owner |
| request_verification | Current owner or reviewer | Valid owner, at least one evidence item and a nonblank handling note |
| verify_close | Reviewer | Valid owner, note/evidence present, no pending link anywhere in the run |
| verification_failed | Reviewer | Reason and valid owner; owner retained |
| reopen | Reviewer | Valid owner, nonblank reason different from last close reason |

Every transition requires the current workflow version. There is no direct state/owner update endpoint and no reassignment action after new. If the owner loses permissions while a case is closed, restore the owner's required membership/grants before reopening; this version does not silently replace them.

Notes on evidence may satisfy the handling-note guard. A standalone note is also a valid evidence item under the contract; note-only evidence does not imply an observed event or a successful provisioning outcome. A review/closure decision is a human action, not an automatic training label or proof of causality.

## Evidence and closed-case protection

Evidence kind events requires nonempty event IDs; kind note requires nonblank note. Event IDs in either kind must belong to the **exact immutable run snapshot**, max1000, with case-insensitive UUID duplicates rejected. Current grants apply before insertion/read. Evidence and event references are append-only and constrained to case/run/workspace by foreign keys. Late events require a new run; they cannot be attached to an old snapshot.

Before close, every pending run link must be reviewed (accepted or rejected). This is deliberately conservative: CaseTransition has no field to select only conclusion link IDs. When any case for a run is closed, **all review/manual graph mutations for that run return409 CASE_CLOSED**, even on an unrelated link. Reopen every closed case on that run before editing its graph. Adding evidence to the closed case also returns409. Other open cases may still add their own evidence.

Closure stores immutable evidence IDs plus the link IDs/versions/review states present at closure in workflow history. Public history exposes evidence_refs; the internal closure snapshot is not an extra public DTO. Closure/reopen, evidence append and graph writers acquire the same run row lock, so a concurrent new manual proposal either precedes closure and makes its pending-link guard fail, or follows closure and is blocked. Original snapshot/links/reviews remain intact across reopen.

`Case.version` and `updated_at` describe the latest workflow transition, not evidence append or graph revisions. Adding evidence does not increment workflow version. GET detail reads current state/history/evidence in one SQL statement; separate requests may naturally observe later transitions.

## Idempotency and pagination

Create and transition accept optional Idempotency-Key using the existing1–200 visible ASCII contract. Key scope is actor/workspace/route (transition route includes case ID), TTL24h. Concurrent same-key requests serialize. Identical normalized body replays the exact committed Case response; different body409. Keys are hashed at rest. Expired keys can be reused, and requests without a key are independent. Evidence POST has no idempotency contract.

Replay rechecks current actor membership/role/full grants and transition role/ownership. It does not reapply the old state transition or re-evaluate already-completed evidence guards. A replay may return an older Case version after later transitions; GET detail obtains the current version. No extra history/audit is appended on replay.

List sorts immutable case UUID ascending, default50/max100. Signed cursor binds actor/workspace/state/owner/limit/current membership-role-source scope. Filter, caller, limit, scope changes or tampering invalidate it with400. SQL removes hidden cases before applying limit, so hidden rows do not influence cursor presence. This is **live-state pagination**, not the immutable event pagination snapshot: concurrent state/owner changes may alter filter membership between pages.

## Storage, engine and remaining work

Migration007 adds immutable workflow_instances, workflow_history, cases, case_evidence and case_evidence_events, plus transactional case_idempotency. Cases contain immutable metadata and workflow reference; **no case state or owner column competes with the workflow**. Latest workflow history supplies state/owner/version; histories, evidence and audit reject normal SQL UPDATE/DELETE/TRUNCATE. Mutations/history/idempotency/audit commit or roll back together.

`src/core/workflow/engine.js` evaluates trusted versioned definitions, role/owner rules, expected version and declared server-fact guards. It has no Express/DB/network dependency. Definitions are copied when compiled; instances persist a full definition snapshot. The same engine runs `case_handling` and `document_review` (draft → in_review → approved, or revise back to draft). Tests also persist a document_review instance through the same workflow store.

This demonstrates headless reuse. `POST /core/v1/instances`, `POST /core/v1/instances/{id}/transitions` and `GET /core/v1/instances/{id}` remain **planned**: app-service authentication plus trusted end-user context must be implemented and tested before exposing generic workflows. The store assumes its trusted caller has validated identity/scope and shares the transaction; it is not a public authorization bypass. Dashboard, scorer/model, frontend and representative performance/evaluation remain separate. Live Keycloak login and Docker API image were not rebuilt/rerun in BE-20.

## Verification

```powershell
node --test backend/tests/backend/workflow.test.js backend/tests/backend/cases.test.js
node --env-file-if-exists=.env --test backend/tests/integration/cases.test.js
node --env-file-if-exists=.env --test backend/tests/identity/cases.integration.test.js
npm.cmd test
npm.cmd run test:db
npm.cmd run test:identity
```

Identity tests run actual JWT verification/Express/PostgreSQL with the repository's existing Postman JWKS simulation and verify a recorded request to that dependency. They do not replace the case backend with a mock. Full regression:58 unit/HTTP/contract,39 PostgreSQL,38 identity/HTTP/DB tests pass, plus base/license/process smoke. Tests cover version/owner/role/evidence/closure/reopen, idempotency/revocation, cursor binding, concurrency, scoped FKs, append-only history and audit rollback. No performance or production SSO claim follows from those tests.
