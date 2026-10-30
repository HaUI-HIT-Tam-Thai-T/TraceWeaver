# Changelog

## Unreleased — Reusable backend core

- Add a headless core entry point, shared workspace authorization and a separate reconstruction scope module.
- Extract reusable workflow repository/store with trusted server-side definition registration and creation roles; keep TraceWeaver case rules in an application adapter and preserve existing import entry points.
- Add role-policy unit coverage and PostgreSQL coverage for an admin-only registered workflow. Existing HTTP contracts, configuration and database schema are unchanged.
- Deploy API `be-843c7d0`; verify 60 isolated-image tests, 66 HTTPS/Keycloak checks and 23 private TLS scorer pairs. Preserve existing business data, permissions, private configuration, frontend and other services.

## Unreleased — Evidence-led repository presentation

- Add a TraceWeaver-specific overview illustration, a guided investigation/sandbox demo and feature-to-test evidence map.
- Add reproducible CycloneDX npm/Python inventories with explicit optional/WASM and Python graph limits; document source packaging and distribution scope.
- Add npm dependency audit scheduling, Dependabot configuration and CI checks for SBOM/Python license drift. No release, image or deployment is created by these configurations.

## Unreleased — Repository documentation and licensing

- Replace the historical root introduction with Vietnamese/English project overviews, setup links and explicit implementation/model limits.
- Add architecture, testing, support, community conduct and consolidated licensing documentation; update installation and contribution guidance.
- Add a frontend npm inventory with bundled non-optional dependency notices and separate optional/platform package scope. Refresh backend/Python inventories without changing dependency versions.

## Unreleased — Administration deployed and FE handoff (BE-51)

- Push and deploy runtime4cdd022 as traceweaver-api:be-4cdd022 on Oracle; apply011 and runtime grants. Configure dedicated service-only Keycloak account client with manage/view/query-users, admin-only ownership marker and server-only secret. Keep public Admin REST closed; route BE Admin REST over the exact private Docker endpoint while token issuer stays HTTPS.
- Preserve existing credentials and hashes of all pre-existing rows checked across events/runs/cases/memberships/roles/grants/sources/workflows. Append one UAT human account and one simulator journey; no deletion/reset. Reuse existing scorer/IdP/database containers.
- Pass40 live HTTPS/Keycloak account checks including required password/profile actions, login, grants/revocation/replay/service protection; pass36 simulator checks through collector, hybrid non-degraded, immutable proof and closure. Add exact production FE CORS/callback/Web Origin/logout; preflights pass.140BE pass/2optional Python skips,10sim and15PG pass; base/license98/diff pass.
- Add docs/integration/workspace-admin.md for sidebar, endpoints, versions, recovery, first login and UAT; update deployment status and simulator handoff. No FE edits/deployment or browser UI E2E claim. Private rollout evidence and credentials remain on server.
## Unreleased — Administration audit fixes (BE-50)

- Protect configured core and collector subjects independently of ingest roles at the repository boundary. Human administration cannot add their membership, change roles/active state or direct-read grants; human revocation still works without the identity provider.
- Reject new account provisioning with ACCOUNT_PROVIDER_DISABLED before creating a pending operation or request audit when no provider is configured. Keep existing pending status, completed replay and conflicting-body detection available.
- Verify138 BE tests (two optional Python skips),10 simulator tests and15 PostgreSQL admin/lab/case checks, plus base/license98/diff checks. No migration, dependency, FE or production change; fixes are local source commits pending push/deployment.

## Unreleased — Workspace administration and account provisioning (BE-48)

- Add workspace-admin member directory, existing-account membership, role/revocation and scoped direct-read grants with workspace CAS, last-admin and service-account protection, atomic audit and PUT CORS support for existing allowed origins.
- Add opt-in Keycloak human-account creation with temporary password, owned idempotent provisioning, caller-scoped operation status and safe retry after provider/DB/audit failures. Passwords/provider tokens are not persisted in application state/audit or returned. Add migration011 and OpenAPI36 operations; handoff backend/WORKSPACE_ADMIN.md.
- Verify138 BE tests (two optional Python skips),10 simulator tests,13 PostgreSQL admin/lab/case checks, additional real-HTTP adapter and race/audit fault regressions, base/license98/diff checks. FE unchanged. New production rollout is blocked by automatic approval review pending explicit approval for the dedicated Keycloak service client/secret/profile and migration011/runtime grants; existing simulator deployment is unchanged.

## Unreleased — FE sandbox integration handoff

- Add docs/integration/sandbox.md with deployed workspace, role matrix, case-bound endpoints, JSON examples, separate execution/delivery/proof states, CAS/replay/error handling and UAT checklist. Describe admin-only repair visibility and the total-RAM semantics explicitly. No runtime or FE changes.

## Unreleased — Oracle sandbox rollout (BE-46)

- Push Phuoc/feat/be-sandbox-verification and deploy API source60919cd as be-60919cd on Oracle. Apply migrations008–010, runtime grants and server-local collector configuration; create a separate sandbox workspace using existing operator/reviewer/admin/viewer/ingest identities without password changes.
- Pass36 live HTTPS/Keycloak PKCE checks: combined failures, independent repairs/retries, real log ingestion, hybrid run, failed then passing immutable proof, closure guard and viewer denial. Preserve the first trial case after fixing a script status expectation. Hashes of all old events/runs/cases/memberships/roles/grants/sources unchanged; all services healthy. No FE/browser E2E claim.

## Unreleased — Sandbox ID validation and CLI guidance (BE-44)

- Reject new sandbox request IDs whose request/account/image identifiers would change under ingestion redaction, before state or outbox writes. Apply validation at HTTP and repository boundaries, preserve redaction and existing data, and return a non-echoing 400 INVALID_INPUT.
- Verify rejected IDs leave DB/outbox unchanged and accepted Unicode IDs survive simulator -> ingestion -> run -> case binding. 133 BE tests pass (two optional Python tests skipped), 10 simulator and three sandbox PostgreSQL tests pass; OpenAPI/base/license98/diff pass.
- Correct simulator README: JSON is written only with explicit --out; the CLI has no default output directory. FE and server deployment remain unchanged.

## Unreleased — Three-condition sandbox verification (BE-41)

- Add combined RAM/image/account faults, targeted repairs, immutable attempt snapshots and safe retries of an existing simulated environment without duplicate allocations.
- Bind case sandbox commands to ingested sandbox root events in one transaction; reject client-selected request IDs. Require matching checker/source/case versions, consistent allocation/conditions and delivered attempt logs before closure.
- Add case-bound read/command endpoints and FE handoff in backend/LAB_SANDBOX.md. Preserve non-sandbox closure policy and all FE source. Existing migrations 008–010 suffice.
- Verify 132 BE tests (two optional Python tests skipped), 10 simulator tests, three sandbox PostgreSQL tests, eight legacy case PostgreSQL checks and eight real JWT/HTTP/PostgreSQL case checks. OpenAPI/base/license/diff checks pass. No remote deployment or browser E2E claim: uploading the source bundle to Oracle was blocked by automatic approval review pending explicit destination/source-transfer authorization.

## Unreleased — Realistic deployed lab demo

- Append LAB-DEMO-20261028-v2 to the existing Oracle demo workspace: 36 Vietnamese operational events, 12 runs and 12 cases with readable request codes, synthetic student accounts, courses, resource sizes, varied timings and three specific provisioning failures. Preserve missing-evidence and missing-correlation scenarios and mark every message/case as demo.
- Reuse the transactional seed runner and current authorization/workflow repositories. Rerun inserts zero artifacts; hashes of the previous 36 events and their runs/cases are unchanged. Verify 278 HTTPS assertions with operator/viewer, including search `[Demo]`, pagination, event details, case history and graphs. Local suite:129 pass,2 optional Python tests skipped; base checks pass. No frontend changes, dependencies, schema/ACL changes, API rebuild or remote Git push.

## Unreleased — AI MVP confirmation response

- Answer all five questions from AI_BE_CONFIRMATION: retain scorer schema1 and all-namespace shared_id_count; BE owns unresolved/strong-ID guards; AI ranks/proposes only; unknown/conflicting outcomes require review; retry ambiguity stays unresolved with cardinality per transition ID.
- Distinguish intended BE integration choices from current runtime: outcome guard, persisted/exposed abstention reasons, namespace alias mapper, feature extractor and scorer adapter remain unimplemented. Record policy versioning and separate provision-outcome transition caveats. Align existing AI/integration/status documentation without changing runtime, contracts, deployment or data.
- Verify18 existing reconstruction/contract tests, base checks and29 local Markdown links/anchors. No claim of AI artifact evaluation, bilateral approval, scorer integration or deployed compliance.

## Unreleased — Frontend demo dataset

- Add explicit-target, dry-run-first frontend seed using existing ingestion/run/case repositories in one transaction. Label 36 synthetic events, 12 runs and 12 cases with FE-DEMO; cover four workflow states, missing identifiers, retry, provision failure and hybrid degradation. Reruns preserve user edits and add no duplicate artifacts.
- Apply to the user-selected Oracle demo workspace; verify 148 HTTPS/PKCE assertions for operator/viewer, events/cursors, graph evidence, case filters/history and dashboard. Second seed inserts zero events/runs/cases. Fixture normalization/rule test and base checks pass. Preserve accounts, ACLs, schema, runtime and existing records; no reviewer provisioning or frontend E2E claim.

## Unreleased — Local frontend login callback

- Register the exact localhost:5173 callback, Web Origin and logout redirect on Oracle's live `traceweaver-web` Keycloak client. Verify local and Swagger login forms200, token preflight200, logout302, rejection of unregistered redirects and API health200. Record pending realm-import synchronization and frontend end-to-end verification in the handoff; API CORS and runtime source remain unchanged.

## Unreleased — Frontend API handoff

- Add Vietnamese React/Vite handoff for localhost:5173 and traceweaver.quizlearn.tech: PKCE/session startup, API proxy, workspace/source permissions, graph review, case workflow, pagination, concurrency, retries and UI error handling.
- Document all21 contract operations plus2 health routes and49 DTOs with field constraints and examples. Distinguish16 browser operations, server-only ingest/core and planned scorer. Explicitly record pending frontend origin/callback registration, reviewer provisioning and demo data; no deployment configuration changed in this documentation task.
- Verify60 JSON examples against the existing schema,440 local links/anchors, operation/schema coverage,5 contract tests, base checks and license inventory98packages. React/Vite snippets are integration examples, not a built or end-to-end-tested frontend. No runtime, dependency, schema, credential or database changes.

## Unreleased — Documentation cleanup

- Consolidate integration/data handoff guidance into docs/archive/integration-history.md and license maintenance into CONTRIBUTING.md. Keep runtime/API/install/security/license documentation; remove duplicate preparation/progress checklists from public docs. Council evidence remains local.

## Unreleased — Council backend evidence

- Map all8 eligibility conditions and11 scored criteria from the HaUI2026 council form to backend evidence and remaining FE/AI/release gates; record public repository/release/CI observations without claiming a judge score.
- Add clean-commit `evidence:backend` collector with bounded sequential DB/identity files, no skip/todo/cancel acceptance and sanitized summaries. Add `package:source` for exact Git source archives with sensitive-path exclusions, manifest and SHA256; neither command publishes or creates a tag.
- Verify collector at2db195d:73 unit/HTTP/contract,49 PostgreSQL,45 native identity tests, base/license98, source readiness and audit0. Retain an initial failed parallel DB collector run; its cause remains undiagnosed, independent full DB49/49 and subsequent bounded collector pass. This is not load verification.
- Install89 runtime packages from source archive c6c15cb outside checkout and pass live/ready200 with external DB configuration. Existing machine/cache/DB used; no fresh OS/offline/full product/image verification. Runtime source/contracts/manifest/lock unchanged between the archived commit and2db195d.

## Unreleased — Integration and handoff alignment

- Add exact-origin API/health CORS and safe local Keycloak frontend callback provisioning; preserve Swagger, S256 PKCE, credentials and service clients. Production origins remain explicit HTTPS; core HTTP stays server-only. Existing realm frontend redirects return login200; rerun leaves credential/env/import file hashes unchanged.
- Add native HTTP JWKS identity suite to the PostgreSQL CI job and dependency audit gate. Preserve original Postman command/assertions; native suite runs sequentially and passes45/45 locally. Remote CI has not been verified.
- Refresh shared capability/acceptance/docs, correct fresh Keycloak image-pull instructions, and track original AI handoff plus backend response. Existing rule vocabulary/labels are documented; outcome/retry/features/model thresholds remain decisions to agree with AI. FE/scorer/simulator/full product gates are not marked complete.

## Unreleased — Audit runtime corrections

- Reject compressed public/core bodies415 before decompression; pin body-parser2.4.0 and fast-uri3.1.9, refresh notices. Child-process regression verifies process survival. Full npm audit reports0 advisories at verification time.
- Reject records that exceed schema bounds after redaction. Preserve canonical microseconds/dedup distinctions and legacy millisecond hashes; explicitly reject nonrepresentable finer precision. Apply ceil/floor SQL event filter bounds, reuse core transaction client and reject malformed knowledge query text400.
- Verification:73 unit/HTTP/contract,49 DB,45 native identity tests pass; base/license98 pass. Existing local Keycloak frontend origin/callback provisioning verified. Old Docker image not rebuilt in this session; source restart/rebuild required. Scorer/model/FE/simulator/E2E/performance and production readiness remain separate.

## Unreleased — Live local core identity

- Add development/loopback-only bootstrap for confidential core Keycloak client through Admin REST, signed service JWT/subject verification, service workspace membership only and CORE_APP configuration. Preserve existing user/ingest/admin credentials, realm and other environment values; reruns preserve file hashes and revoked membership remains revoked. Save core credential only in ignored local JSON/import.
- Extend live PKCE verifier with core/user/ingest token isolation, wrong-secret/creator/workspace/role/version checks, document workflow and guarded case transitions through shared history. Live audit check confirms verified user+service identity and no core data roles/source grants. Tokens are never printed or written to disk; smoke documents/cases/evidence retained.
- Recreate only the Keycloak container after its old network disappeared, preserving its named volume. Rebuild API using existing pinned base image; dependency cache was absent, so89 runtime packages were installed inside the image from unchanged lockfile. No host dependency install or image pull. Docker API/Keycloak/PostgreSQL healthy; migration container exit0.
- Verify66 unit/HTTP/contract and10 targeted core PostgreSQL/JWT/HTTP tests, live Keycloak protocol/delegation, base/license98packages and Compose config. API count stays20/21; scorer/FE/AI, production identity and performance remain separate.

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
