# Hiện trạng TraceWeaver

## BE-58 — triển khai kiểm chứng theo từng yêu cầu, 31/10/2026

Đã push nhánh `Phuoc/feat/be-sandbox-verification` đến `a38c380` và triển khai image
`traceweaver-api:be-a38c380` tại `https://api.quizlearn.tech`. Migrations001–011 đã đủ, không có migration
mới hoặc thay đổi quyền. Collector, CORS local và account-admin giữ nguyên cấu hình; hàng đợi log0.
Chỉ thay API container; DB/Keycloak/scorer/các ứng dụng khác không restart. Backup DB ứng dụng đã kiểm
archive; hash dữ liệu, membership/grants, source state và proof trước/sau không đổi, không đổi mật khẩu.

Image mới đạt34 tests cách ly trên server (gồm11 PostgreSQL), sau rollout đạt66 kiểm tra HTTPS/Keycloak
chỉ đọc và private TLS scorer23pairs/401. Simulator smoke trong container mới xác nhận yêu cầu khác không
làm stale kết quả đạt; tự đổi điều kiện rồi đổi lại vẫn phải thực thi mới. Snapshot cũ đã stale giữ nguyên,
không tự đánh dấu đạt hoặc sửa lịch sử. Browser E2E với phiên đăng nhập chưa nghiệm thu trong lượt này.

FE `frontend/fix-sandbox-status` đã push đến `ecbbda2`, có sửa thông báo proof và format source/tests;
chưa triển khai production FE trong lượt này. Vite đã bỏ proxy, FE local gọi API HTTPS trực tiếp.
Refactor core BE chưa commit ở máy local được giữ nguyên và không đưa vào image này.

Các mốc dưới đây là lịch sử, không thay thế trạng thái triển khai BE-58 ở trên.

## BE-52 — FE local gọi trực tiếp API, 30/10/2026

Oracle API chạy `traceweaver-api:be-1b6a72e`. Bật riêng
`FRONTEND_LOCAL_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`, giữ allowlist HTTPS hiện có.
21 kiểm tra HTTPS live đạt: health, GET/POST/PUT preflight, anonymous401, origin/cổng khác403,
Keycloak callback và token CORS cho hai local origins. Không sửa FE; không migration hoặc restart scorer/DB/IdP.
Local141BE/contract tests đạt,2Python tùy chọn bỏ qua; base/license98/diff đạt.
FE đặt `VITE_API_BASE_URL=https://api.quizlearn.tech` rồi khởi động lại Vite để bỏ qua proxy.
Giữ `API_PROXY_TARGET` vì Vite hiện vẫn kiểm biến này. Browser UI E2E chưa kiểm trong lượt này.
Source chuyển bằng Git bundle; chưa push commit mới lên origin. Các mốc bên dưới là lịch sử.

## Cập nhật hiện tại — 30/10/2026

Oracle đang chạy API source `4cdd022`, image `traceweaver-api:be-4cdd022`, migrations001–011,
collector và dedicated account-administration client/marker đã cấu hình. CORS/callback/Web Origin/logout
cho `https://traceweaver.quizlearn.tech` đã đăng ký. Secret và credentials giữ trên server.
40 kiểm tra quản trị HTTPS/Keycloak thật và36 kiểm tra simulator đạt: tạo account/required actions/login,
scope/grants/revoke/replay, RAM -> image -> account -> pass -> ingestion -> proof -> closed.
140 BE tests đạt,2 Python tùy chọn bỏ qua;10 simulator và15 PostgreSQL admin/lab/case đạt.
Các dòng dữ liệu cũ được đối chiếu hash không đổi; thêm account/hành trình UAT, không xóa/reset.
FE chưa sửa hoặc deploy, browser UI E2E và hosting frontend chưa xác minh. Xem [bàn giao quản trị](FE_WORKSPACE_ADMIN_HANDOFF.md)
và [simulator](FE_SANDBOX_HANDOFF.md). Các mục bên dưới là lịch sử theo mốc, không thay trạng thái mới này.

BE-38 (29/10/2026): đã deploy BE + model AI v2 lên Oracle tại https://api.quizlearn.tech/docs/, runtime release `oracle-4e2805e`. API gọi scorer bằng TLS nội bộ, AI không publish cổng Internet. Pass 23 mẫu scorer qua TLS, 20 kiểm tra hybrid/PKCE/audit/replay/dữ liệu và 49 kiểm tra live hiện có. Hashes của 72 events, 25 runs và 25 cases cũ giữ nguyên; test thêm đúng một run hybrid, không thêm event/case. PostgreSQL/Keycloak và các ứng dụng khác giữ nguyên. Xem [hướng dẫn deploy](../deploy/oracle/README.md). Các ghi chú container cũ bên dưới mô tả lịch sử hoặc container local8080, không phải deployment Oracle mới.

## BE-34 — 28/10/2026: trained model v2 opt-in

AI_BE_RUNTIME_V2 has been verified and imported: loader plus checksum-verified experimental JSON artifact, 23 HTTP sample pairs and 42 independent feature fixtures. The supplied launcher and Node probe pass; the real Node extractor passes 42/42. Explicit SCORER_MODEL_VERSION enables the exact trained version; baseline remains supported. Model success reports hybrid/non-degraded, annotating only existing pending rule-derived links. sandbox-rules-2 keeps ACL/outcome/strong-ID/ambiguity/cardinality/cycle guards. Batches <=100 share one <=5s deadline; failures discard every score. See [Scorer guide](../backend/SCORER.md) and [artifact provenance](../ai/artifacts/sandbox-v2/README.md).

Verified: 129 Node unit/HTTP/contracts, 31 Python, 50 PostgreSQL, 47 native identity/API tests pass, zero skipped. The JWT/API→Python-model→PostgreSQL path verifies scores/audit/replay/review and stopped-scorer fallback; old baseline replay stays immutable after model selection. OpenAPI has 21 source-implemented operations (20 Node + 1 private Python). No dependency install, migration, training, image rebuild/deployment or secret change. API container retains its old image. Synthetic precision 0.7273 remains below the >=95% target; no production quality or recall gain is claimed. Earlier notes below are historical where superseded.

## Historical BE-27 — 28/10/2026: baseline scorer integration

AI baseline runtime imported from origin/xkhuong/feat/ai-scorer; Node adapter tested against real Python HTTP. No trained model exists. Only reviewed baseline is enabled: scores annotate guard-approved pending links; effective_method remains rule_only with ai_baseline_only. sandbox-rules-2 applies outcome guards; optional Graph.abstentions is persisted with audit. Batch <=100, total <=5s; failures discard all scores. Runtime features are independently versioned; legacy bootstrap helpers are not trained-model parity evidence. See [Scorer guide](../backend/SCORER.md).

BE-33 follow-up verified on 28/10/2026: Docker/PostgreSQL restored using existing images and volume. All 50 DB and 46 native identity/API tests pass, zero skipped, with SCORER_PYTHON enabled. The new JWT HTTP → Python baseline → PostgreSQL test proves durable scores/audit/replay, graph/review and fallback after the scorer process is stopped. Prior 82 unit/HTTP/contract and 28 Python results remain at BE-27; no model/dependency/runtime changes in this follow-up. The earlier DB connection blocker is resolved. API container still uses its previous image; tests start a separate API from current source. No production/live-Keycloak/UI E2E or trained-model readiness is claimed. Earlier status below is historical where superseded.


Cập nhật phản hồi AI 28/10/2026. Phạm vi checkout hiện tại là backend; [contracts](../backend/contracts/README.md) xác định DTO và trạng thái implemented/planned. Source AI trên branch remote khác chưa được tích hợp vào checkout này. Phản hồi mới là lựa chọn tích hợp phía BE, chưa thay runtime/deployment hoặc chứng nhận dữ liệu/model offline của AI.

| Thành phần | Đã có | Còn thiếu |
|---|---|---|
| API | 20 Node public/core operations +1 private Python scorer; HTTP adapter/model opt-in verified | Deployment of current source |
| Identity | Keycloak local PKCE/refresh; user/ingest/core token isolation; current DB roles/grants | Production SSO/session revocation; FE login UI |
| Data | 7 migrations; immutable events/run snapshots; provenance/dedup; exact time filters; transactional audit | Raw simulator parsers/polling; representative dataset; backup/restore |
| Reconstruction | Versioned guards/review/cases; feature v2 parity; trained opt-in scores with durable audit | Representative quality/recall and performance evaluation |
| Frontend integration | Exact-origin API/health CORS; local public PKCE client có callback | Frontend runtime/screens/E2E |
| AI/simulator | Baseline + experimental model runtime, supplied synthetic manifests/metrics | Representative generator/data, independent quality reproduction |

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
