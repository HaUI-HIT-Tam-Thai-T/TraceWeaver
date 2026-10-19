# Changelog

## Unreleased — BE identity/read APIs

- Docs team mở rộng từ license sang đối chiếu đề HaUI/thể lệ: Open-Core/H-P-D-I, bàn giao BE/FE/AI, dữ liệu/kiểm thử/minh chứng và demo/hồ sơ; tách bắt buộc/khuyến nghị, trạng thái đã có/còn thiếu.

- Tài liệu dùng chung docs/HUONG-DAN-LICENSE-CHO-TEAM.md: lệnh kiểm/cập nhật, file cần commit, lỗi thường gặp và giới hạn BE/FE/AI; README/CONTRIBUTING liên kết tới hướng dẫn.

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
