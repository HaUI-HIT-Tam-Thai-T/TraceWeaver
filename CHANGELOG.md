# Changelog

## Unreleased — Trusted core workflow HTTP

- Implement three internal core workflow operations:20/21 API operations implemented, scorer still planned. Require distinct configured app-client JWT/exact service subject, independently verified original user JWT and explicit workspace. Current service/user memberships, user roles and case full-source grants apply; token role/actor/fact spoofing cannot authorize.
- Persist workspace-scoped document_review v1 instances with entity uniqueness, serialized expected-version transitions and atomic history/audit. Case instances retain existing createCase ownership of run scope; core GET/transitions share authoritative case state, repository/run locks, evidence/owner/close/reopen guards and graph freeze. Both definitions verified through core HTTP.
- Add CORE_APP_CLIENT_ID/CORE_APP_SUBJECT configuration, closed input/media/query bounds, credential isolation and OpenAPI dual-credential contract. Empty subject disables core503; live Keycloak bootstrap does not yet provision the additional service client. Document references have workspace permissions, no content store or separate document ACL.
- Verify62 unit/HTTP/contract,44 PostgreSQL and45 identity/HTTP/DB tests, base/license98packages, Compose config and source process smoke. Existing Postman JWKS simulation reused with real JOSE/Express/DB. No dependency/migration/FE/AI/image build; PostgreSQL restarted with existing volume. Live core-client Keycloak delegation and Docker API rebuild remain unverified.

## Unreleased — Dashboard and case time filters

- Implement GET workspace dashboard:17/21 operations implemented, four planned. One SQL statement counts current full-source visible runs, degraded runs, per-run unresolved events from live graph links/reviews and new/assigned cases from latest workflow history.
- Share inclusive UTC parent-run creation-time filters with case listing; preserve fractional boundaries at PostgreSQL microsecond precision and bind signed case cursors to both filters. Unknown/duplicate/invalid queries fail400; membership, reader role and direct/group grants apply without admin bypass.
- Verify60 unit/HTTP/contract,40 PostgreSQL and39 identity/HTTP/DB tests; base/license98packages and source process smoke pass. Reuse Postman JWKS simulation, no live Keycloak claim. Restore existing PostgreSQL container networking while retaining its data volume.
- No dependencies, migrations, image builds or frontend changes. Three core workflow HTTP operations and scorer remain planned. No global run-list route or representative performance claim.

## Unreleased — Case workflow APIs

- Implement create/list/detail/evidence/transition case APIs:16/21 implemented. Current full run-source scope applies to every case artifact, signed live-list cursor and idempotent response.
- Persist immutable workflow instances and append-only history as sole state/owner/version source. Versioned definition engine runs case_handling and document_review headlessly; generic core HTTP remains planned pending app credential/trusted-user delegation.
- Enforce owner/reviewer/version/evidence/verification/reopen guards. Closure conservatively requires no pending run link and freezes all graph edits while any run case is closed. Shared run lock prevents concurrent manual proposal/closure from both committing; closure captures link/evidence versions.
- Add migration007 and scoped evidence FKs, hashed24h create/transition idempotency and atomic audit/rollback. Apply to development. Verify58unit/HTTP/contract+39PostgreSQL+38identity/HTTP/DB tests, targetedFK/replay follow-ups, base/license98packages and source process smoke.
- No dependencies/image rebuild/liveKeycloak changes. Remaining operations: dashboard, three core workflow endpoints and scorer. Headless reuse is not a claim of completed core HTTP authorization.

## Unreleased — Link review and manual APIs

- Implement reviewLink/createManualLink: 11/21 operations implemented. Append-only reviews project current state/version without changing snapshot or original evidence; manual proposals remain pending with null score and redacted reason evidence.
- Serialize graph writers per run; reject stale versions, duplicate pairs, self-links and cycles, including reacceptance. Current operator/reviewer membership and all-source grants apply. Audit failure rolls back edits; graph reads capture revisions in one statement.
- Add migration006 with scoped review FK, unique link/version and immutable history. Apply to development; verify 51 unit/HTTP/contract, 32 PostgreSQL and 31 identity/HTTP/DB tests plus base, license and process smoke checks.
- Case/workflow and closed-case evidence guards remain pending before case APIs can be enabled. Docker API image has not been rebuilt; new routes verified using source processes. No dependency changes.

## Unreleased — Reconstruction runs and graph APIs

- Implement createRun/getRun/getGraph, taking the contract to 9/21 implemented operations. Bounded rule execution persists a completed run, input event/source/policy snapshot, pending links, idempotency response and audit in one transaction; POST returns 202 with Location.
- Current role/membership/direct/group read grants protect every requested source, including empty sources, and block the whole old artifact after revocation. Concurrent Idempotency-Key retries replay one committed response for 24h; changed input returns 409.
- Pin sandbox action rules, preserve missing-evidence labels and event provenance; absent scorer makes hybrid explicitly degraded to rule_only. Migration 005 adds immutable snapshot tables and endpoint/workspace/source constraints.
- Verify 47 unit/HTTP/contract, 29 PostgreSQL and 29 identity/HTTP/DB tests; base/license/process smoke pass. Apply migration on development. Resolve Windows reserved host port by changing ignored local PostgreSQL configuration from 55432 to 15432, retaining data volume. Docker API image has not been rebuilt in this step.

## Unreleased — Headless reconstruction rules

- Add scoped candidate generation and a deterministic rule baseline with versioned server policy, explicit service/action transitions, namespace-aware strong-ID matching and conflict rejection.
- Enforce inclusive scope/window/root bounds and 1,000-event limit before candidate filtering; preserve timestamp precision, abstain on ambiguous matches, support declared branches and reject cyclic proposals.
- Keep rule evidence pending for review; ignore message/payload/oracle-shaped metadata. Run persistence/snapshot/API and model evaluation remain pending; API progress stays 6/21.

## Unreleased — Swagger OAuth callback fix

- Serve oauth2-redirect.js required by Swagger UI5.34 callback HTML. Its missing404 left login on a blank page and Swagger without a token.
- Regression follows the actual callback HTML's script references, checks JavaScript content type and executes the code/state handoff to its opener. Live Keycloak verifier now checks callback assets too.

## Unreleased — Live Keycloak/Swagger login

- Pinned local Keycloak26.8.1, isolated persistent IdP volume, random ignored demo/admin/service credentials and idempotent demo workspace/source grants.
- Swagger Authorization Code+S256 PKCE login, exact callback origins, separate confidential ingest client; no password-grant/auth bypass. Explicit exact-host dev-only internal JWKS path; production HTTP remains rejected.
- Verified real operator/viewer login, PKCE negatives/CORS, refresh and scoped API/ingest/read with Keycloak-issued JWTs. New registration does not auto-grant app permissions. API count remains6/21.

## Unreleased — Swagger UI

- Local Swagger UI at /docs/ with API/Health definitions, schema refs, Bearer Authorize and implemented/planned labels. No CDN/online validator or persistent token storage.
- Swagger UI5.34.0 Apache-2.0 pinned; Docker bundles assets/specs. API progress remains6/21.

## Unreleased — Docker API

- Pinned Node24 multi-stage image with runtime dependencies, non-root/read-only API and allowlisted build context excluding local secrets/data.
- Default Compose reuses development PostgreSQL/volume, runs one-shot migrations before API readiness; container-only DB URL setup preserves host .env and correctly escapes credentials.
- Verified image build, migration exit0, container live/ready200 and anonymous /me401;29 tests/base/license pass. API progress remains6/21; live IdP in container not verified.

## Unreleased — BE event reads

- GET events và event detail theo current source read ACL; public provenance/hash, time/source/action/literal text/identifier filters.
- Fixed PostgreSQL visibility snapshot và signed occurred_at/event_id keyset cursor; late commits không chen vào các trang cũ. Migration 004 preserves event IDs/content/hash and stamps top-level xid8.
- API progress 6/21 implemented, 15 planned; user/ingest token isolation và immediate permission revocation giữ nguyên. Reject PostgreSQL-invalid year0000 trước query/ingest.
- Local verification: 27 unit/HTTP/contract, 20 PostgreSQL, 23 identity/HTTP/DB tests pass; base/license/process smoke pass. Real backend/JOSE/DB against local Postman JWKS; live Keycloak/SSO/CI chưa nghiệm thu.

## Unreleased — BE batch ingestion

- POST events:batch: per-record validation/redaction, canonical dedup/conflict, immutable events/provenance and transactional audit; migration 003.
- Separate ingest JWT authorized client plus current DB membership/role/source grants. User tokens cannot ingest; ingest tokens cannot use user read routes.
- API progress: 4/21 implemented, 17 planned. Input is normalized EventInput; raw simulator parsers and event read routes remain pending.
- Local verification: 25 unit/HTTP/contract, 20 PostgreSQL, 7 identity auth and 9 identity HTTP/DB tests pass; base/license/process smoke pass. JWKS simulated locally with Postman; live IdP/CI not verified.

## Unreleased — BE identity/read APIs

- JWT/JWKS verification bằng JOSE: RS256, issuer/audience/expiry/client checks; không tin quyền trong token, không có auth bypass.
- GET /api/v1/me và sources/knowledge theo workspace với role/grants PostgreSQL, group access, revocation và signed keyset cursor.
- Cấu hình OIDC/CURSOR_SECRET, cập nhật OpenAPI implemented/planned và dependency notices.
- Kiểm local: 17 unit/HTTP/contract tests, 15 identity tests qua Postman JWKS HTTP + PostgreSQL thật, base/license/process smoke pass. Chưa xác nhận live Keycloak/PKCE/SSO hoặc CI identity; không làm FE/AI trong thay đổi này.

## 0.1.0-base.1 — 2026-10-19

- Base backend Node.js/Express/PostgreSQL, JavaScript ES modules.
- Router/controller/service, middleware request ID và xử lý lỗi tập trung.
- Healthcheck, config, DB pool/transaction và migration runner.
- OpenAPI/JSON Schema, fixtures và kiểm thử hợp đồng.
- Khung headless core, frontend, AI scorer và simulator.
- GitHub Actions cho backend tests và các lệnh Makefile.

- Apache-2.0, SPDX, dependency/license inventory và third-party notices.
- Kiểm bộ khung, manifest/lock, smoke và CI Linux/Windows/PostgreSQL.
- README thể hiện kiến trúc ba tầng, H-P-D-I và giới hạn triển khai thực tế.
