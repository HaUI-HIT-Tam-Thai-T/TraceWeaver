# Changelog

## Unreleased — AI scorer checkpoint

- API bootstrap nạp model JSON, kiểm SHA-256/cấu trúc và fail readiness an toàn.
- Pipeline synthetic bootstrap và đánh giá offline theo `sandbox-rules-1`;
  ground truth tách khỏi feature, unresolved không tự thành nhãn âm.
- Feature reference v2 xử lý redaction, 42 golden fixture và bundle Python/Node
  có tài liệu nguồn, checksum và checker để BE đối chiếu.
- Smoke model đo p95 sau warm-up cho batch 24/100; CI kiểm trên Windows/Linux.
- Ghim LF cho model artifact và cập nhật tài liệu chạy/tái tạo kết quả.
- Xuất model sandbox thử nghiệm có manifest, checksum dữ liệu/báo cáo, kiểm score
  offline khớp loader/API; giữ nguyên model bootstrap mặc định.
- Chưa tích hợp extractor/HTTP adapter/guard/fallback/audit của BE trong checkout
  này; model policy mới chưa thay artifact bootstrap đang serve.

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
