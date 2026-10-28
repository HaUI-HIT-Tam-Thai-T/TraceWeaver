# Tích hợp backend, frontend và AI

## BE-27 — 28/10/2026: baseline scorer integration

AI baseline runtime imported from origin/xkhuong/feat/ai-scorer; Node adapter tested against real Python HTTP. No trained model exists. Only reviewed baseline is enabled: scores annotate guard-approved pending links; effective_method remains rule_only with ai_baseline_only. sandbox-rules-2 applies outcome guards; optional Graph.abstentions is persisted with audit. Batch <=100, total <=5s; failures discard all scores. Runtime features are independently versioned; legacy bootstrap helpers are not trained-model parity evidence. See [Scorer guide](../backend/SCORER.md).

BE-33 follow-up verified on 28/10/2026: Docker/PostgreSQL restored using existing images and volume. All 50 DB and 46 native identity/API tests pass, zero skipped, with SCORER_PYTHON enabled. The new JWT HTTP → Python baseline → PostgreSQL test proves durable scores/audit/replay, graph/review and fallback after the scorer process is stopped. Prior 82 unit/HTTP/contract and 28 Python results remain at BE-27; no model/dependency/runtime changes in this follow-up. The earlier DB connection blocker is resolved. API container still uses its previous image; tests start a separate API from current source. No production/live-Keycloak/UI E2E or trained-model readiness is claimed. Earlier status below is historical where superseded.


Hợp đồng dùng chung: [OpenAPI](../backend/contracts/openapi.json), [JSON Schema](../backend/contracts/schemas/domain.schema.json) và [fixtures](../backend/contracts/fixtures/valid.json). Fixtures là dữ liệu kiểm schema, không phải response lấy từ runtime. Thay DTO/enum/status phải cập nhật contract, consumer và tests cùng thay đổi. Xem [hiện trạng](CURRENT_STATUS.md) để phân biệt phần đã có và còn thiếu.

## Frontend và Identity

Bàn giao cụ thể cho React/Vite local5173 và domain `traceweaver.quizlearn.tech`: [Frontend handoff](FRONTEND_HANDOFF.md), [API reference](FRONTEND_API_REFERENCE.md). Tài liệu này ghi rõ API Oracle, proxy local, cấu hình origin/callback còn cần đăng ký và giới hạn hiện có; không đưa credentials vào source FE.

1. Cài backend theo [INSTALL](../INSTALL.md), cấu hình local Identity theo [Keycloak](../backend/KEYCLOAK.md). Mỗi máy giữ `.env` và credentials riêng.
2. Login Authorization Code + S256 PKCE với public client; không đưa client secret vào browser. Lấy workspace/roles từ `/api/v1/me`, rồi gọi sources/knowledge bằng user token. Đăng nhập thành công không tự tạo membership hoặc source grant.
3. Dùng origin chính xác. Development mặc định `http://localhost:3000`, `http://127.0.0.1:3000`; thay bằng `FRONTEND_ORIGINS` và provision callback `/auth/callback` theo Keycloak guide. Production cấu hình HTTPS origins rõ ràng. CORS không thay xác thực/quyền DB.
4. User token dùng API đọc/điều tra; confidential ingest client dùng batch ingestion. Core workflow dùng app-service token riêng và original user JWT đã kiểm độc lập; gọi từ app server, không trực tiếp từ browser. Xem [Identity](../backend/IDENTITY.md) và [core workflow](../backend/WORKFLOW.md).

Luồng ứng dụng: login → workspace/sources → events/provenance → run/graph → review/manual links → case/evidence/workflow → dashboard drill-down. Backend hiện có20/21 operations; scorer còn planned. Loading/empty/failed/degraded/unresolved cần thể hiện riêng; link đề xuất không phải quan hệ nhân quả đã được xác minh.

| HTTP | Hành vi phía consumer |
|---|---|
| 401 | Xử lý token/phiên đăng nhập |
| 403/404 | Không cho thao tác hoặc đoán tài nguyên bị ẩn; bỏ cache khi mất quyền |
| 409 | Tải version mới, cho người dùng xem thay đổi trước khi gửi lại |
| 415 | Gửi JSON không nén đúng media type; request nén không được hỗ trợ |
| 429 | Tôn trọng `Retry-After` |
| 503 | Hiển thị dịch vụ chưa sẵn sàng; chỉ coi AI degraded khi run response xác nhận |

Không giữ token/payload nhạy cảm trong localStorage. Core, FE và AI không tự bỏ qua source ACL hoặc ghi trực tiếp state/history trong DB. [Case](../backend/CASES.md) và [reconstruction](../backend/RECONSTRUCTION.md) mô tả version/idempotency/evidence guards.

## Scorer và dữ liệu

Đọc [handoff AI](BACKEND_HANDOFF.md) và [phản hồi backend ngày 28/10](BACKEND_HANDOFF_RESPONSE.md#phản-hồi-ai_be_confirmation--28102026) trước tích hợp. Policy hiện dùng `intake/request.accepted → account/account.created → provision/provision.completed|provision.failed`; default policy không có skip Intake→Provision. Label1 là **cạnh trực tiếp có hướng**. Phía BE chọn giữ schema1/5 feature, BE quản lý unresolved và AI chỉ xếp hạng/đề xuất; unknown/mâu thuẫn outcome phải review. Outcome guard, lưu reason và alias mapper/extractor chưa có runtime; text similarity/fixture tương đương và version policy khi thực thi guard còn phải đồng bộ với AI. Không dùng score để phá ambiguity hoặc ngưỡng synthetic0.20 để tự nối. Cardinality hiện theo từng transition ID, hai outcome provision là hai transition riêng; xem phản hồi để biết giới hạn.

Scorer contract hiện nhận numeric features, tối đa100 cặp:

```json
{"schema_version":"1","pairs":[{"pair_id":"p1","features":{"delta_seconds":2,"shared_id_count":0,"text_similarity":0.63,"transition_allowed":true,"conflicting_id":false}}]}
```

Response có `model_version`, `feature_schema_version="1"`, predictions trả đúng tập `pair_id`, không thiếu/thừa/trùng, score hữu hạn trong[0,1]. Sai schema/features trả422 toàn batch; model chưa ready trả503. Không tự đổi request sang raw text. Backend lọc quyền trước candidate/scorer; AI chỉ trả score, không ghi DB. Hybrid hiện degraded về rule_only vì adapter chưa triển khai.

Ingest hiện nhận `EventInput` chuẩn hóa, chưa parse raw simulator logs. Timestamp phải biểu diễn chính xác tới microsecond; chữ số thừa chỉ được là0, không tự cắt/làm tròn. Xem [ingestion](../backend/INGESTION.md) và [events](../backend/EVENTS.md).

Dataset phải có version, generator commit, nguồn/quyền sử dụng/license, parser versions, counts/checksums và split policy. Observable dùng app/scorer; oracle journey membership/expected edges chỉ cho evaluator, không mount vào API/scorer hoặc mã hóa trong IDs/features. Split theo journey/run/template trước khi sinh cặp; fit features trên train, chọn thresholds trên validation, giữ test khóa. Có hard negatives, partial IDs, late/duplicate/retry/failure/ambiguous; không đủ bằng chứng thì unresolved.

Bàn giao AI gồm source/dependency lock, feature schema/version, model checksum/card, dataset manifest/splits, baseline/model metrics và giới hạn. Không dùng model artifact không tin cậy; không gọi score là xác suất đã hiệu chuẩn khi chưa kiểm. Npm inventory không bao phủ Python/model/dataset licenses.

## Kiểm tra tích hợp

Chạy các lệnh trong [INSTALL](../INSTALL.md) và [backend README](../backend/README.md). Identity-native dùng JWKS HTTP fixture với JOSE/Express/PostgreSQL thật; verifier Keycloak kiểm token do IdP local cấp. Hai phép kiểm có phạm vi khác nhau. DB tests tạo và giữ database riêng.

FE/AI bàn giao source + lockfile, `.env.example` không secret, exact commands và license inventory; kiểm luồng thật, token isolation, permission revocation, stale version409, fallback và dữ liệu có provenance. Ghi commit, môi trường, lệnh, expected/actual và lỗi chưa xử lý. FE/AI runtime, model evaluation, full E2E, performance, backup/restore và máy sạch còn cần kiểm riêng; không dùng kết quả BE thay các kiểm này.
