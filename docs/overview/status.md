# Hiện trạng TraceWeaver

## Refactor core BE — 31/10/2026

Nhánh `Phuoc/feat/be-sandbox-verification` đã đồng bộ `dev` trước khi đưa phần refactor BE
vào source. Có entry point headless, quyền workspace dùng chung, run scope riêng và workflow
repository/store dùng chung; case TraceWeaver được nối qua adapter. Các import cũ giữ tương thích.
Không đổi HTTP contract, cấu hình, dependency hoặc schema DB; FE giữ theo `dev`.

Kiểm tra local: 146 BE/contract tests đạt, 2 test Python tùy chọn bỏ qua; 31 PostgreSQL integration
tests cho core workflow/cases/runs/reviews/dashboard/lab và 6 core HTTP/JWT/PostgreSQL tests đạt,
không skip ở hai nhóm tích hợp. Base checks, inventory 98 npm packages và headless import đạt.
HTTP fixture chạy ngoài sandbox; PostgreSQL local được khởi động lại bằng container/volume hiện có
và chờ phục hồi xong trước lượt DB đạt. Đây không phải kiểm thử browser/live Keycloak hoặc scorer Python.

Refactor này chưa triển khai server. API server vẫn là `be-a38c380`; các mốc triển khai phía dưới
giữ nguyên phạm vi và kết quả lịch sử của chúng.

## Web trực tuyến và tài khoản demo — 31/10/2026

Frontend đã được triển khai tại [traceweaver.quizlearn.tech](https://traceweaver.quizlearn.tech), dùng API/Keycloak tại `api.quizlearn.tech`. Nginx phục vụ file tĩnh qua HTTPS; bật khởi động cùng server, tự khởi động lại sau 5 giây khi tiến trình dừng và timer gia hạn chứng chỉ. Release FE `fe-20261030T185157Z` được build từ working tree local tại thời điểm triển khai, không phải toàn bộ source đã được commit lên `dev`.

Đã kiểm build TypeScript/Vite, HTTPS, route SPA, tải JS/CSS, HTTP chuyển sang HTTPS, CORS và trình duyệt chuyển tới trang đăng nhập Keycloak với callback production/PKCE. Bốn tài khoản demo đã được kiểm đăng nhập PKCE và `/api/v1/me` trả 200; danh sách/mật khẩu demo được công khai theo xác nhận của người dùng tại [README](../../README.md#chọn-vai-trò-để-trải-nghiệm). Chưa kiểm toàn bộ luồng nghiệp vụ sau đăng nhập bằng trình duyệt, forced crash, reboot hoặc renewal dry-run.

Quyền `viewer` chỉ đọc trong workspace Sandbox; ở workspace TraceWeaver tài khoản này hiện có thêm `operator`/`reviewer`. Quyền không bị thay đổi khi cập nhật mật khẩu. Các ghi chú FE “chưa triển khai” ở các mốc cũ bên dưới mô tả phạm vi của lần kiểm tương ứng.

Mục lục tài liệu đã được phân nhóm ngày 31/10/2026; xem [docs](../README.md). Việc tổ chức tài liệu không đồng nghĩa các cổng sản phẩm/kiểm thử còn lại đã đạt.

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
FE chưa sửa hoặc deploy, browser UI E2E và hosting frontend chưa xác minh. Xem [bàn giao quản trị](../integration/workspace-admin.md)
và [simulator](../integration/sandbox.md). Các mục bên dưới là lịch sử theo mốc, không thay trạng thái mới này.

BE-38 (29/10/2026): đã deploy BE + model AI v2 lên Oracle tại https://api.quizlearn.tech/docs/, runtime release `oracle-4e2805e`. API gọi scorer bằng TLS nội bộ, AI không publish cổng Internet. Pass 23 mẫu scorer qua TLS, 20 kiểm tra hybrid/PKCE/audit/replay/dữ liệu và 49 kiểm tra live hiện có. Hashes của 72 events, 25 runs và 25 cases cũ giữ nguyên; test thêm đúng một run hybrid, không thêm event/case. PostgreSQL/Keycloak và các ứng dụng khác giữ nguyên. Xem [hướng dẫn deploy](../../deploy/oracle/README.md). Các ghi chú container cũ bên dưới mô tả lịch sử hoặc container local8080, không phải deployment Oracle mới.

## BE-34 — 28/10/2026: bật mô hình v2 bằng cấu hình

Đã kiểm tra và nhập gói AI_BE_RUNTIME_V2: bộ nạp, mô hình JSON thử nghiệm có kiểm mã băm, 23 cặp mẫu HTTP và 42 mẫu kiểm đặc trưng độc lập. Chương trình khởi chạy và công cụ thăm dò Node đi kèm đều đạt; bộ trích xuất đặc trưng Node thực tế đạt 42/42 mẫu. Đặt SCORER_MODEL_VERSION để chọn đúng phiên bản đã huấn luyện; chế độ dùng quy tắc cơ bản vẫn được hỗ trợ. Khi mô hình chạy thành công, kết quả ghi hybrid và không suy giảm, chỉ bổ sung điểm cho các liên kết do quy tắc tạo đang chờ duyệt. sandbox-rules-2 giữ kiểm quyền nguồn, kết quả nghiệp vụ, mã liên kết mạnh, trường hợp mơ hồ, số liên kết cho phép và chu trình. Mỗi đợt tối đa 100 cặp dùng chung thời hạn tối đa 5 giây; nếu lỗi, bỏ toàn bộ điểm. Xem [hướng dẫn dịch vụ chấm điểm](../../backend/SCORER.md) và [nguồn gốc mô hình](../../ai/artifacts/sandbox-v2/README.md).

Kết quả: 129 kiểm tra Node về logic/HTTP/định nghĩa API, 31 Python, 50 PostgreSQL và 47 kiểm đăng nhập/API bằng máy chủ khóa giả lập đều đạt, không bỏ qua. Luồng JWT/API → mô hình Python → PostgreSQL đã kiểm điểm lưu, lịch sử thao tác, gửi lại yêu cầu, duyệt liên kết và chuyển về quy tắc khi dừng AI. Kết quả cũ từ chế độ cơ bản giữ nguyên khi gửi lại, kể cả sau khi chọn mô hình. OpenAPI có 21 thao tác đã có mã xử lý (20 Node và 1 Python nội bộ). Không cài thư viện, cập nhật bảng dữ liệu, huấn luyện, dựng lại image, triển khai hoặc đổi khóa bí mật. Container API vẫn dùng image cũ. Tỷ lệ liên kết dự đoán đúng (precision) trên dữ liệu tự sinh là 0.7273, thấp hơn mục tiêu ít nhất 95%; chưa chứng minh chất lượng dùng thực tế hoặc khả năng tìm được nhiều liên kết đúng hơn. Các ghi chú cũ bên dưới chỉ áp dụng cho thời điểm tương ứng.

## Lịch sử BE-27 — 28/10/2026: tích hợp AI dùng quy tắc cơ bản

Nhập dịch vụ AI từ origin/xkhuong/feat/ai-scorer; kiểm bộ kết nối Node với dịch vụ HTTP Python thật. Tại mốc này chưa có mô hình đã huấn luyện. Chỉ bật chế độ cơ bản đã được xem xét: điểm bổ sung cho các liên kết chờ duyệt đã qua điều kiện; effective_method vẫn là rule_only cùng ai_baseline_only. sandbox-rules-2 kiểm kết quả nghiệp vụ; Graph.abstentions tùy chọn được lưu cùng lịch sử thao tác. Mỗi đợt tối đa 100 cặp, tổng thời hạn tối đa 5 giây; lỗi thì bỏ mọi điểm. Đặc trưng đầu vào có phiên bản riêng; công cụ khởi tạo cũ không chứng minh kết quả khớp mô hình đã huấn luyện. Xem [hướng dẫn chấm điểm](../../backend/SCORER.md).

Kiểm bổ sung BE-33 ngày 28/10/2026: khôi phục Docker/PostgreSQL bằng image và vùng dữ liệu sẵn có. Cả 50 kiểm cơ sở dữ liệu và 46 kiểm đăng nhập/API đều đạt, không bỏ qua, với SCORER_PYTHON được bật. Luồng JWT HTTP → Python cơ bản → PostgreSQL kiểm được việc lưu điểm, lịch sử thao tác, gửi lại, đồ thị, duyệt liên kết và chuyển về quy tắc sau khi dừng AI. Kết quả 82 kiểm logic/HTTP/định nghĩa API và 28 kiểm Python vẫn thuộc BE-27; lần bổ sung không đổi mô hình, thư viện hoặc dịch vụ xử lý. Đã giải quyết việc không kết nối được cơ sở dữ liệu trước đó. Container API vẫn dùng image cũ; kiểm thử khởi động API riêng từ mã hiện tại. Chưa xác nhận triển khai thực tế, Keycloak thật, toàn bộ luồng giao diện hoặc mức sẵn sàng của mô hình đã huấn luyện. Ghi chú cũ bên dưới giữ phạm vi lịch sử của chúng.

Cập nhật phản hồi AI 28/10/2026. Phạm vi checkout hiện tại là backend; [contracts](../../backend/contracts/README.md) xác định DTO và trạng thái implemented/planned. Source AI trên branch remote khác chưa được tích hợp vào checkout này. Phản hồi mới là lựa chọn tích hợp phía BE, chưa thay runtime/deployment hoặc chứng nhận dữ liệu/model offline của AI.

| Thành phần | Đã có | Còn thiếu |
|---|---|---|
| API | 20 thao tác Node công khai/lõi và 1 Python nội bộ; đã kiểm kết nối HTTP và bật mô hình bằng cấu hình | Triển khai mã nguồn hiện tại |
| Identity | Keycloak local PKCE/refresh; user/ingest/core token isolation; current DB roles/grants | Production SSO/session revocation; FE login UI |
| Data | 7 migrations; immutable events/run snapshots; provenance/dedup; exact time filters; transactional audit | Raw simulator parsers/polling; representative dataset; backup/restore |
| Reconstruction | Versioned guards/review/cases; feature v2 parity; trained opt-in scores with durable audit | Đánh giá chất lượng, khả năng tìm đủ liên kết và hiệu năng trên dữ liệu đại diện |
| Frontend integration | Exact-origin API/health CORS; local public PKCE client có callback | Giao diện chạy được và kiểm toàn bộ hành trình trên trình duyệt |
| AI/simulator | Baseline + experimental model runtime, supplied synthetic manifests/metrics | Representative generator/data, independent quality reproduction |

## Kiểm chứng

Tại commit2db195d ngày25/10/2026: 73 unit/HTTP/contract,49 PostgreSQL,45 identity-native tests pass; base/license98packages pass; npm audit toàn cây0 advisories. Đây là kết quả tại commit/thời điểm nêu trên, không tự áp dụng cho source hoặc advisory mới. Identity-native dùng JWKS HTTP fixture, JOSE/Express/PostgreSQL thật; không phải Postman CLI hoặc live Keycloak. Live Keycloak verifier đã pass ở mốc BE-23.

Source archive c6c15cb đã cài89 runtime dependencies và trả live/ready200 khi chạy ngoài checkout, dùng Node/npm/DB đã có và cấu hình cung cấp từ ngoài gói. Collector đầu tiên có lỗi DB chưa lưu được nguyên nhân chi tiết; chạy riêng DB49/49 và collector tuần tự sau đó pass. Báo cáo fail/pass và checksum được giữ local. Chưa chứng minh máy sạch/offline, full E2E hoặc performance từ các lượt kiểm này.

Chạy các lệnh trong [INSTALL](../../INSTALL.md) và [backend README](../../backend/README.md). CI được cấu hình chạy native identity và npm audit; cần xem đúng run/commit trên [Actions](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/actions), không suy từ kết quả local.

## Hạn chế vận hành và tích hợp

- Source sửa không tự cập nhật container. Rebuild theo [Docker guide](../../backend/DOCKER.md) trước khi demo bằng image; không có kết quả image scan/production deployment ở đây.
- Ingest nhận EventInput chuẩn hóa. Timestamp phải biểu diễn chính xác bằng microsecond, chữ số thừa chỉ được là0; không cắt/làm tròn ngầm. Xem [ingestion](../../backend/INGESTION.md)/[events](../../backend/EVENTS.md).
- CORS development mặc định localhost/127.0.0.1:3000; production cần HTTPS exact origins. Core workflow chỉ dành cho app server. Xem [Integration](../archive/integration-history.md).
- Policy giữ request.accepted → account.created → provision.completed|failed. [Phản hồi AI ngày28/10](../archive/ai-backend-response.md#phản-hồi-ai_be_confirmation--28102026) chọn schema1/5 feature, BE giữ unresolved, AI chỉ đề xuất và unknown/mâu thuẫn outcome phải review. Outcome guard, lưu/trả reason, alias mapper và extractor chưa có runtime; scorer/fixture/text_similarity/policy version khi triển khai còn phải đồng bộ. Ambiguity không được phá bằng score; cardinality theo transition ID, chưa gộp hai outcome provision thành một slot.
- Production least privilege/TLS, backup/restore, tải đại diện, FE/AI E2E và release sản phẩm cần kiểm riêng. Tag v0.1.0-base.1 mới là scaffold.
