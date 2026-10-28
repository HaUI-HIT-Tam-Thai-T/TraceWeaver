# Reading events

Implemented: `GET /api/v1/workspaces/{wid}/events` and `GET /api/v1/workspaces/{wid}/events/{eid}`. Use an authorized user-client JWT, an active membership and a viewer/operator/reviewer/admin role. All SQL additionally checks current direct/group source **read** grants. Ingest grants do not confer read access; admin has no automatic data grants.

Lists accept `source_id`, inclusive UTC `from`/`to`, exact `action`, case-insensitive literal `q`, `limit` (default 50, max 100) and `cursor`. Search covers redacted message, action and identifier namespace/value; `%`, `_` and backslash are literal, not query wildcards. Filters compose. Unknown, repeated/non-scalar or malformed parameters return 400, including inverted time bounds. PostgreSQL has no year zero, so that timestamp is rejected before querying or ingestion. Detail accepts no query parameters. Explicit source outside scope or an inaccessible/missing event returns 404; missing reader role returns 403.

Responses use the existing Event/EventsPage schemas. Event provenance contains the original batch ID, one-based line locator and SHA-256 of canonical redacted normalized content. Stored occurred_at spelling is preserved so the public content can reproduce the hash: exclude event_id/source_id/received_at/provenance, include parser_version, sort object keys and retain array order. There is no original secret payload or internal transaction ID in the DTO.

## Stable pagination

Sort ascending by `(occurred_at,event_id)`; cursor preserves the exact microsecond sort key. Each page sequence uses a fixed PostgreSQL visibility snapshot. Migration 004 stamps events with the top-level `xid8` returned by `pg_current_xact_id()`, and reads check `pg_visible_in_snapshot(insert_xid,snapshot)`. This excludes both newly started uploads and uploads already running at page one that commit later. Existing rows receive the migration transaction ID; immutable event content, IDs, hashes and provenance are preserved.

The snapshot functions are documented by [PostgreSQL 17](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-PG-SNAPSHOT). Top-level IDs avoid the subtransaction caveat and tuple xmin wraparound. No open transaction, exported snapshot session, stored ID list or cleanup job is held across requests.

Cursors are HMAC signed with domain separation from other cursors and bind subject/workspace, normalized filters/limit, current roles/groups/read-source set, sort order, snapshot and last key. Repeat the same query parameters on subsequent pages. Changed scope/filter/client context or tampering returns 400; membership revocation returns 404. Current SQL permission checks still apply, even on existing snapshots. Start a new sequence after permission changes to obtain a fresh cursor.

Cursor max length is 4096. A snapshot too large to fit returns sanitized 503 instead of an unstable/oversized cursor. Cursors are specific to the database instance and signing secret; rotate CURSOR_SECRET when restoring/replacing a database. Existing events are immutable; this does not provide a historical snapshot of past permissions.

## Verification

`npm test` checks query bounds/cursors and existing HTTP/contracts. `npm run test:identity` includes real JOSE → local Postman JWKS → Express → PostgreSQL event-read tests: filters, ties, schema/provenance hash, hidden sources, delayed commit, new inserts, subtransaction stamping, current grants and cursor context, sanitized errors. `npm run test:db` covers migration and database regression. Test DBs are isolated and retained. The IdP is simulated; live Keycloak/SSO and deployment CI remain separate verification.

Run `npm run db:migrate` and restart the backend after migration 004. Re-running migration is idempotent; no database recreation is needed. No FE/AI/raw-log parser changes accompany these routes.
