# Changelog

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
