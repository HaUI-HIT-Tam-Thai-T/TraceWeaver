# Hiện trạng TraceWeaver

Cập nhật phản hồi AI 28/10/2026. Phạm vi checkout hiện tại là backend; [contracts](../backend/contracts/README.md) xác định DTO và trạng thái implemented/planned. Source AI trên branch remote khác chưa được tích hợp vào checkout này. Phản hồi mới là lựa chọn tích hợp phía BE, chưa thay runtime/deployment hoặc chứng nhận dữ liệu/model offline của AI.

| Thành phần | Đã có | Còn thiếu |
|---|---|---|
| API | 20/21 operations: identity/workspace reads, ingest/events, run/graph, reviews/manual links, cases/dashboard, core workflow | Scorer HTTP adapter |
| Identity | Keycloak local PKCE/refresh; user/ingest/core token isolation; current DB roles/grants | Production SSO/session revocation; FE login UI |
| Data | 7 migrations; immutable events/run snapshots; provenance/dedup; exact time filters; transactional audit | Raw simulator parsers/polling; representative dataset; backup/restore |
| Reconstruction | Versioned rule policy; ambiguity/conflict/cycle guards; review và case lifecycle | Feature extractor/model/evaluator; hybrid hiện degraded về rule_only |
| Frontend integration | Exact-origin API/health CORS; local public PKCE client có callback | Frontend runtime/screens/E2E |
| AI/simulator | Contracts và handoff | Runtime tích hợp, generator/data manifest/splits/model metrics |

## Kiểm chứng

Tại commit2db195d ngày25/10/2026: 73 unit/HTTP/contract,49 PostgreSQL,45 identity-native tests pass; base/license98packages pass; npm audit toàn cây0 advisories. Đây là kết quả tại commit/thời điểm nêu trên, không tự áp dụng cho source hoặc advisory mới. Identity-native dùng JWKS HTTP fixture, JOSE/Express/PostgreSQL thật; không phải Postman CLI hoặc live Keycloak. Live Keycloak verifier đã pass ở mốc BE-23.

Source archive c6c15cb đã cài89 runtime dependencies và trả live/ready200 khi chạy ngoài checkout, dùng Node/npm/DB đã có và cấu hình cung cấp từ ngoài gói. Collector đầu tiên có lỗi DB chưa lưu được nguyên nhân chi tiết; chạy riêng DB49/49 và collector tuần tự sau đó pass. Báo cáo fail/pass và checksum được giữ local. Chưa chứng minh máy sạch/offline, full E2E hoặc performance từ các lượt kiểm này.

Chạy các lệnh trong [INSTALL](../INSTALL.md) và [backend README](../backend/README.md). CI được cấu hình chạy native identity và npm audit; cần xem đúng run/commit trên [Actions](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/actions), không suy từ kết quả local.

## Hạn chế vận hành và tích hợp

- Source sửa không tự cập nhật container. Rebuild theo [Docker guide](../backend/DOCKER.md) trước khi demo bằng image; không có kết quả image scan/production deployment ở đây.
- Ingest nhận EventInput chuẩn hóa. Timestamp phải biểu diễn chính xác bằng microsecond, chữ số thừa chỉ được là0; không cắt/làm tròn ngầm. Xem [ingestion](../backend/INGESTION.md)/[events](../backend/EVENTS.md).
- CORS development mặc định localhost/127.0.0.1:3000; production cần HTTPS exact origins. Core workflow chỉ dành cho app server. Xem [Integration](INTEGRATION.md).
- Policy giữ request.accepted → account.created → provision.completed|failed. [Phản hồi AI ngày28/10](BACKEND_HANDOFF_RESPONSE.md#phản-hồi-ai_be_confirmation--28102026) chọn schema1/5 feature, BE giữ unresolved, AI chỉ đề xuất và unknown/mâu thuẫn outcome phải review. Outcome guard, lưu/trả reason, alias mapper và extractor chưa có runtime; scorer/fixture/text_similarity/policy version khi triển khai còn phải đồng bộ. Ambiguity không được phá bằng score; cardinality theo transition ID, chưa gộp hai outcome provision thành một slot.
- Production least privilege/TLS, backup/restore, tải đại diện, FE/AI E2E và release sản phẩm cần kiểm riêng. Tag v0.1.0-base.1 mới là scaffold.
