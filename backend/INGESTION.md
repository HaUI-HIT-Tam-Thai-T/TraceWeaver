# Batch ingestion

`POST /api/v1/workspaces/{wid}/sources/{sid}/events:batch` receives the existing normalized `BatchRequest` contract. It does not parse raw simulator log files. Source metadata must use intake/intake-v1, account/account-v1 or provision/provision-v1; each record service must match the source.

The JWT/JWKS checks use a separate client from INGEST_CLIENT_ID (default traceweaver-ingest), distinct from the user client. User tokens cannot ingest; ingest tokens cannot access user read routes. Active membership, ingest_service DB role and direct/group ingest grants are required; read/admin alone is insufficient. Producers obtain tokens from the IdP; this API does not read INGEST_CLIENT_SECRET. Local Keycloak integration is verified; production IdP remains separate. No token bypass.

Envelopes contain 1–500 records, with the existing 1 MiB JSON body limit. Invalid envelopes return 422. Individual invalid records return a sanitized rejection code while valid records proceed. Unknown input fields such as received_at/parser_version are rejected. A whole batch and its audit commit in one transaction; infrastructure/audit failure rolls everything back and returns sanitized 503. Source grant revocation is checked on every new batch.

Migration 003 adds batches and immutable events. Source event identity is unique within workspace/source. A canonical SHA-256 of normalized, redacted content (including registered parser version, excluding server event/receive/batch metadata) distinguishes duplicates from conflicts. Hashing sorts object keys and preserves array order. Changed content for the same ID is rejected without modifying the original event. Retries return the original event ID. Secret-only differences that redact to identical content are duplicates. Original secrets are not hashed or persisted in batch digests.

Redaction recursively masks credential-named payload keys and common key=value/key:value credentials and Bearer values in strings. It is a bounded heuristic, not arbitrary sensitive-data classification: producers must keep secrets out of source IDs, identifier values, field names and other free text. Payload nesting beyond 32 levels is rejected. Original input is never echoed in errors or audit. No raw log archive is created.

Provenance stores batch_id, one-based locator, content_hash, source/parser metadata and receive time. [Event read APIs](EVENTS.md) assemble the implemented public Event DTO.

Revalidate all bounded fields after redaction: an expanded message/action/identifier rejects that record before storage. Timestamps are canonicalized without losing microseconds; millisecond input retains legacy canonical hashes. Nonzero digits beyond6 fractional places reject with UNSUPPORTED_TIMESTAMP_PRECISION; extra trailing zeroes are accepted. Existing stored events are not rewritten or reconstructed. Compressed HTTP bodies are unsupported and return415 before decompression.

Checks: `npm test`, `npm run check:base`, `npm run licenses:check`; PostgreSQL coverage: `node --env-file-if-exists=.env --test backend/tests/integration/ingestion.test.js`. Integration tests create and retain an isolated test DB, including a deliberate audit-failure trigger in that test DB only. Run `npm run db:migrate` before serving against an existing development DB. No automatic migration on server startup.
