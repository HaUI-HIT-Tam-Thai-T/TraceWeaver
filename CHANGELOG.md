# Changelog

## Unreleased — AI scorer checkpoint

- API bootstrap nạp model JSON, kiểm SHA-256/cấu trúc và fail readiness an toàn.
- Pipeline synthetic bootstrap và đánh giá offline theo `sandbox-rules-1`;
  ground truth tách khỏi feature, unresolved không tự thành nhãn âm.
- Feature reference v2 xử lý redaction, 42 golden fixture và bundle Python/Node
  có tài liệu nguồn, checksum và checker để BE đối chiếu.
- Smoke model đo p95 sau warm-up cho batch 24/100; CI kiểm trên Windows/Linux.
- Ghim LF cho model artifact và cập nhật tài liệu chạy/tái tạo kết quả.
- Chưa tích hợp extractor/HTTP adapter/guard/fallback/audit của BE trong checkout
  này; model policy mới chưa thay artifact bootstrap đang serve.

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
