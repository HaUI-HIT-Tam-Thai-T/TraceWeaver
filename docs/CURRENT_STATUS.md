# Hiện trạng TraceWeaver — 25/10/2026

Đây là bảng capability hiện tại của nhánh phát triển; các mục BE cũ trong changelog/SUMMARY là lịch sử. API và DTO authoritative ở [contracts](../backend/contracts/README.md). Không dùng số API để suy phần trăm hoàn thành toàn sản phẩm.

| Thành phần | Đã có | Còn thiếu |
|---|---|---|
| Backend API | 20/21 operations: me/sources/knowledge, batch/events, run/graph, review/manual links, cases/dashboard, core workflows | Scorer HTTP adapter |
| Identity | Keycloak local PKCE/refresh, user/ingest/core client isolation, current DB role/grants, hai workflow definitions | Production identity/session revocation, FE login UI |
| Data | 7 migrations, immutable event/run snapshot/provenance, dedup/conflict, pagination, transactional audit | Raw simulator parsers/polling, representative dataset, backup/restore rehearsal |
| Reconstruction | Versioned rule policy, evidence/conflict/ambiguity/cycle guards, review/case lifecycle | Feature extractor/model/evaluator; hybrid hiện degraded về rule_only |
| Frontend integration | CORS exact origins cho API/health; local public PKCE client có exact /auth/callback | React/runtime/screens/E2E chưa có |
| AI/simulator | Contracts và bàn giao | Runtime/source baseline AI chưa có trong checkout; generator/data manifest/splits/model metrics chưa có |

Sau sửa audit: **73 unit/HTTP/contract,49 PostgreSQL,45 identity-native tests pass**; base/license98packages pass; npm audit toàn cây trả0 advisories tại lần chạy này. Identity-native dùng JWKS HTTP cục bộ, JOSE/Express/PostgreSQL thật và assertions chung; không phải Postman CLI hoặc Keycloak thật. Live Keycloak verifier đã pass ở mốc BE-23; lượt sửa này kiểm lại provisioning frontend origins/callbacks qua Admin REST. Không ghi CI remote pass khi chưa đọc được run.

Các lỗi đã sửa trong source: request nén bị từ chối415 trước decompress, body-parser2.4.0/fast-uri3.1.9, revalidate sau redaction, precision microsecond/dedup, exact event filters, nested DB checkout và malformed knowledge query. Không sửa hay suy đoán lại timestamp của dữ liệu cũ; hashes của input millisecond giữ tương thích. Cần ingest lại dưới identity mới nếu dữ liệu nguồn cũ đã mất precision.

`EventInput.occurred_at` hỗ trợ instant biểu diễn chính xác bằng microseconds: tối đa6 chữ số có nghĩa sau giây, chữ số thừa chỉ được là0. Khác trả per-record `UNSUPPORTED_TIMESTAMP_PRECISION`; không cắt/làm tròn ngầm. Timestamp canonical có ít nhất3 chữ số, giữ đến6 khi cần. Bộ lọc from/to vẫn nhận precision cao hơn, SQL ceil lower/floor upper để giữ khoảng inclusive chính xác.

CORS: development mặc định http://localhost:3000 và http://127.0.0.1:3000 (theo FRONTEND_PORT); `FRONTEND_ORIGINS` là danh sách exact origins, rỗng để tắt. Production phải cấu hình HTTPS origins rõ ràng. Core HTTP không có browser CORS. Chạy [setup frontend origin](../backend/KEYCLOAK.md) để cập nhật realm đã tồn tại mà không reset tài khoản.

Source đã sửa không đồng nghĩa container cũ đã đổi: sau pull code, chạy `docker compose up -d --build --wait api` theo [Docker guide](../backend/DOCKER.md). Lượt sửa không rebuild image vì Docker CLI không có trong shell. Production least privilege/TLS, image vulnerability scan, machine-fresh/full offline/E2E, performance10k events/5 users và release sản phẩm vẫn cần kiểm riêng.

Handoff: [yêu cầu gốc từ AI](BACKEND_HANDOFF.md), [phản hồi backend](BACKEND_HANDOFF_RESPONSE.md). Label là directed direct edge; giữ vocabulary policy hiện tại. Outcome/retry/account replacement, text similarity artifacts và model thresholds chưa được hai bên chốt; không tự đánh dấu đã thống nhất.

| Mục audit | Trạng thái sau sửa |
|---|---|
| S01,S02 | Chặn compressed body, dependency đã vá, npm audit0 |
| B01 | Reject record quá schema sau redaction, không poison run |
| B02,B03 | Canonical microseconds/dedup chính xác; inclusive SQL bounds |
| B04,B05 | Cùng transaction client khi core lookup; query malformed400 |
| I01 | Handoff ghi rõ vocabulary/direct-edge label và quyết định còn mở |
| I02 | Source CORS + local Keycloak callback đã cấu hình/kiểm; image cũ cần rebuild |
| D01,D02,D03 | Docs hiện trạng đồng bộ; handoff được track; fresh image pull được ghi rõ |
| V01 | CI đã gọi native identity và npm audit; remote run chưa xác nhận |
