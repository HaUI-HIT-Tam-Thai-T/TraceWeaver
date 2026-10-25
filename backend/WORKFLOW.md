# Core workflow HTTP

BE-22 exposes three internal operations through the same source API process. OpenAPI now has20/21 implemented; only scorer remains planned. These endpoints are for a trusted application server. Browser clients continue using the case API.

## Identity and scope

Configure `CORE_APP_CLIENT_ID` (default `traceweaver-core`, distinct from user/ingest clients) and `CORE_APP_SUBJECT` (exact service-account JWT sub). Empty subject disables core503 without affecting public user APIs. The identity provider must issue an RS256 access token for this confidential service client with the configured API audience. Client credentials stay at the calling server; this backend neither issues tokens nor accepts a shared secret as an access JWT. The local Keycloak setup script does not provision this additional client automatically.

Every request requires:

| Header | Value |
|---|---|
| Authorization | Bearer service-access-JWT |
| X-End-User-Authorization | Bearer original-user-access-JWT |
| X-Workspace-Id | Workspace UUID |
| Content-Type on POST | application/json |

Core independently verifies both JWTs using trusted JWKS configuration, issuer/audience, expiry, payload type and distinct authorized clients. The service sub must match configured CORE_APP_SUBJECT and have a current active membership in the requested workspace. This explicit service identity and membership grant delegation authority; no service source grants are inferred. The user needs current membership/DB role and, for cases, all requested run-source read grants including empty sources. Token roles/groups and arbitrary actor/fact headers do not grant permissions. Create body creator_subject must exactly match verified user and workspace_id must match header. Use HTTPS between servers outside loopback development. Do not send these headers to untrusted hosts, browser code, proxy access logs or analytics.

Membership/source/role revocation affects still-valid tokens immediately on subsequent operations. As with existing API verification, access JWTs are not introspected for IdP logout/session revocation and remain cryptographically valid until expiry. App client token cannot replace user/ingest credentials, and user/ingest clients cannot replace app credentials.

## Operations and definitions

| Operation | Behavior |
|---|---|
| POST /core/v1/instances | Creates document_review v1, entity_ref.type=document, state=draft/version1;201 + Location |
| GET /core/v1/instances/{id} | Returns WorkflowInstance with latest state/owner/version and sanitized immutable history |
| POST /core/v1/instances/{id}/transitions | Checks expected_version, role/owner/guards; commits history and audit atomically;200 |

`document_review` uses submit: draft→in_review for operator/reviewer; approve: in_review→approved and revise: in_review→draft require reviewer. Entities are standalone workspace-scoped document references; this API does not store document contents or introduce document-level ACLs. Creation requires operator/reviewer. Read requires viewer/operator/reviewer/admin. Entity uniqueness and transitions serialize: one concurrent duplicate create wins, other409; one transition at a version wins, other409. Uploaded definitions, unsupported version/type combinations, owner_subject or nonempty evidence_refs for documents reject422.

`case_handling` instances are created with POST case, which establishes immutable case/run/evidence scope. Read `workflow_instance_id` from the case response, then use it for core GET and transitions. Core POST for an existing case returns409 WORKFLOW_EXISTS after current ACL checks; a missing/hidden case returns404. Core never creates an orphan case workflow. Both definitions are exercised through core HTTP in the identity integration test.

Case core transitions use exactly the case repository and shared run lock. Assign uses owner_subject in the core schema (owner_id in the case API). Current owner/source/role, evidence/note, pending links, reviewer close/reopen and closed-run graph freeze guards remain authoritative. Caller evidence_refs must all belong to the same case; fabricated or other-case refs return404. History/closure records full server-derived current case evidence, even when caller supplies a subset/empty refs. Caller cannot supply guard facts or mutate state directly. State/history is shared across case and core endpoints, without a second status store. Audit records verified user as actor_subject and service as after_ref.app_subject for core writes.

Example create body, with creator_subject matching the original user JWT:

```json
{
  "definition_key": "document_review",
  "definition_version": 1,
  "entity_ref": { "type": "document", "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  "workspace_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "creator_subject": "verified-user-sub"
}
```

Transition body: `{"action":"submit","expected_version":1,"reason":"Ready for review","evidence_refs":[]}`. Reasons are redacted and revalidated. Closed JSON schemas, unknown query rejection, UUID/workspace checks, JSON-only POST and1MiB limit apply. Duplicate auth headers are rejected. Idempotency-Key is explicitly unsupported400 for these core operations; after a timeout read current instance/version before retrying. Public case APIs retain their existing24h idempotency behavior. Errors are401 for invalid tokens,403 for visible membership without permission,404 for hidden scope,409 for version/entity conflict,422 for invalid input/guards and sanitized503 for unavailable identity/database/core. Successful responses use Cache-Control:no-store.

## Verification and limits

Run `npm test`, `npm run test:db`, `npm run test:identity`. Tests use real JOSE, Express and PostgreSQL plus the repository's existing Postman JWKS simulation (`backend/postman/simulations/identity.sim.yaml`); private keys remain in memory. They check both definitions, cross-client/expired/spoofed tokens, current permissions/service membership, concurrent version/entity writes, evidence/closure guards and atomic audit rollback. This proves source runtime against a JWKS stand-in. Additional service-client provisioning and live Keycloak delegation are not claimed, and Docker API image must be rebuilt to expose these routes. No model/scorer, frontend or representative performance results are implied.
