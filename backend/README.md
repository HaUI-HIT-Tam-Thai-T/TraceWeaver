# Máy chủ TraceWeaver

Máy chủ nhận yêu cầu từ giao diện, kiểm quyền người dùng, tìm bản ghi liên quan và lưu hồ sơ xử lý. Phần này dùng Node.js, Express và PostgreSQL; mã JavaScript được chia thành module (ESM), cài thư viện từ thư mục gốc bằng npm workspace.

Nếu mới cài dự án, bắt đầu với phần chạy trên PowerShell bên dưới và [hướng dẫn đăng nhập](KEYCLOAK.md). Cách gọi từng nhóm API nằm ở [xác thực](IDENTITY.md), [nhận log](INGESTION.md), [đọc bản ghi](EVENTS.md), [dựng hành trình](RECONSTRUCTION.md), [hồ sơ](CASES.md), [thống kê](DASHBOARD.md) và [quy trình dùng chung](WORKFLOW.md).

Số API và kết quả thử ở các mốc BE-xx trong trang này là ghi nhận lịch sử. Đối chiếu [hiện trạng dự án](../docs/overview/status.md) để biết mã đã kiểm và phiên bản đã triển khai; sửa mã trên máy không tự cập nhật dịch vụ đang chạy.

## Đăng nhập và thử API

Swagger UI tại `http://localhost:8080/docs/`; OpenAPI JSON tại `/docs/openapi.json`. Chọn API/Health rồi **Authorize** để gửi mã truy cập sau đăng nhập (Bearer token). Nhãn implemented/planned phân biệt thao tác đã có mã xử lý và thao tác mới dự kiến.

Đăng nhập thật: **Authorize → keycloakLogin → Authorize**, dùng `demo.operator` hoặc `demo.viewer`; mật khẩu nằm trong `demo-credentials.local.json` tại thư mục gốc. Để trống client_secret khi đăng nhập ứng dụng web. [Hướng dẫn Keycloak và bootstrap](KEYCLOAK.md).

## Chạy trên Windows PowerShell

Chạy API + PostgreSQL bằng Docker: `docker compose up -d --build --wait api` từ thư mục gốc, dùng `.env` hiện có. Xem [chạy bằng Docker](DOCKER.md) về cập nhật bảng dữ liệu, dựng image và kết nối dịch vụ đăng nhập trong container.

Từ thư mục gốc dự án, dùng Node 24.14.1/npm 11.11.0 đã kiểm:

```powershell
npm.cmd ci
npm.cmd run db:setup
npm.cmd run db:up
```

`db:setup` chỉ tạo `.env` khi chưa tồn tại, sinh mật khẩu ngẫu nhiên và DATABASE_URL tương ứng; không in thông tin đăng nhập. `db:up` chạy PostgreSQL riêng bằng `compose.dev.yaml`, chỉ nhận kết nối tại `127.0.0.1:55432`, giữ dữ liệu trong vùng lưu trữ Docker `traceweaver_postgres_data`. Container hiện đã khởi tạo; nếu `.env` có sẵn thì giữ nguyên, không cần chạy lại setup.

Image PostgreSQL 17.11 đã khóa bằng mã băm image. `db:up` không tự tải image; trên máy mới chưa có image, chạy `docker compose -f compose.dev.yaml pull postgres` trước. Đây là môi trường phát triển trên máy cá nhân: POSTGRES_USER là tài khoản khởi tạo/cập nhật bảng của image; triển khai thực tế cần tách quyền chạy ứng dụng theo nhu cầu tối thiểu. Đổi mật khẩu trong `.env` không đặt lại mật khẩu cơ sở dữ liệu trong vùng lưu trữ đã khởi tạo.

Nếu Windows báo cổng 55432 bị chặn, kiểm dải cổng Windows dành riêng và chọn cổng khác chưa dùng trên máy (ví dụ 15432). Cập nhật cả POSTGRES_PORT và port trong DATABASE_URL ở `.env`, rồi chạy lại db:up; giữ vùng dữ liệu hiện có. Cổng PostgreSQL trong mạng Docker vẫn là 5432.

Nếu dùng PostgreSQL có sẵn thay vì Compose, điền DATABASE_URL trỏ tới cơ sở dữ liệu đã tạo, dùng tài khoản có quyền tạo bảng/vùng dữ liệu. Ví dụ sau chỉ minh họa địa chỉ kết nối, không phải tài khoản dùng được:

```text
DATABASE_URL=postgresql://USER:URL_ENCODED_PASSWORD@localhost:5432/traceweaver
```

Mật khẩu chứa ký tự đặc biệt phải được mã hóa theo quy tắc URL. Không commit `.env`. DATABASE_URL và CURSOR_SECRET là bắt buộc; db:setup tạo chúng khi chưa có file cấu hình. Với file cũ, bổ sung khóa bảo vệ mã phân trang CURSOR_SECRET nếu thiếu. Cấu hình đăng nhập OIDC phải khớp dịch vụ cấp mã; INGEST_CLIENT_ID phải khác OIDC_CLIENT_ID để tài khoản gửi log không lẫn với tài khoản người dùng. Ghi chú ban đầu này chưa bao gồm thiết lập AI; xem [dịch vụ chấm điểm](SCORER.md).

```powershell
npm.cmd run db:migrate
npm.cmd run dev:be
```

Địa chỉ máy chủ mặc định127.0.0.1:8080; API_HOST/API_PORT tùy cấu hình. `npm.cmd run start:be` chạy không tự khởi động lại khi sửa mã; thiếu bước cập nhật bảng dữ liệu thì báo chưa sẵn sàng, không tự cập nhật bảng. `db:stop` giữ dữ liệu. compose.dev.yaml chỉ chạy PostgreSQL; compose.yaml có bước cập nhật bảng, API và Keycloak, chưa chạy giao diện/AI.

## Các địa chỉ API được ghi nhận tại mốc này

| Endpoint | Kết quả |
|---|---|
| `GET /health/live` | 200 `{ "status": "ok" }`, độc lập với DB |
| `GET /health/ready` | 200 `{ "status": "ready" }` khi DB/migration sẵn sàng; ngược lại 503 `CORE_NOT_READY` |
| `GET /api/v1/me` | Nhóm làm việc và vai trò theo mã tài khoản đã xác thực |
| `GET /api/v1/workspaces/{wid}/sources` | Nguồn người dùng được cấp quyền đọc |
| `GET /api/v1/workspaces/{wid}/knowledge` | Tri thức theo nhóm làm việc và vai trò được đọc |
| `POST /api/v1/workspaces/{wid}/sources/{sid}/events:batch` | Tài khoản dịch vụ có vai trò và quyền nhận log; trả số lượng xử lý theo từng bản ghi |
| `GET /api/v1/workspaces/{wid}/events` | Tìm và lọc theo quyền đọc; phân trang trên bộ dữ liệu đã lưu cố định |
| `GET /api/v1/workspaces/{wid}/events/{eid}` | Bản ghi đã che thông tin bí mật cùng nguồn gốc; trả 404 nếu ngoài phạm vi quyền |
| `POST /api/v1/workspaces/{wid}/runs` | Người vận hành/kiểm duyệt; lưu cố định dữ liệu của lần dựng, chống thực hiện trùng và ghi lịch sử; trả 202 và Location |
| `GET /api/v1/workspaces/{wid}/runs/{rid}` | Hành trình theo quyền hiện tại đối với mọi nguồn đã dùng |
| `GET /api/v1/workspaces/{wid}/runs/{rid}/graph` | Dữ liệu của lần dựng được giữ cố định, kèm quyết định duyệt mới nhất và phiên bản; mất quyền một nguồn sẽ chặn toàn bộ kết quả |
| `POST /api/v1/workspaces/{wid}/runs/{rid}/links/{lid}/reviews` | Thêm quyết định accepted/rejected, giữ quyết định cũ; cần expected_version và reason; trả 201 Review |
| `POST /api/v1/workspaces/{wid}/runs/{rid}/links` | Thêm liên kết thủ công chờ duyệt; kiểm hai đầu thuộc dữ liệu lần dựng, không tạo vòng hoặc trùng; trả 201 Link |
| `POST /api/v1/workspaces/{wid}/cases` | Tạo hồ sơ trạng thái new, chống thực hiện trùng trong 24 giờ; trả 201 và Location |
| `GET /api/v1/workspaces/{wid}/cases` | Lọc trạng thái và người phụ trách hiện tại; mã phân trang có chữ ký, gắn với phạm vi quyền |
| `GET /api/v1/workspaces/{wid}/cases/{cid}` | Hồ sơ, lịch sử và bằng chứng; cần quyền hiện tại trên tất cả nguồn |
| `POST /api/v1/workspaces/{wid}/cases/{cid}/evidence` | Thêm ghi chú hoặc tham chiếu bản ghi của lần dựng, không sửa bằng chứng cũ; hồ sơ đã đóng trả 409 |
| `POST /api/v1/workspaces/{wid}/cases/{cid}/transitions` | Người phụ trách/kiểm duyệt; kiểm phiên bản, điều kiện, chống thực hiện trùng và ghi lịch sử |

Hợp đồng: [health OpenAPI](contracts/health.openapi.json). Các địa chỉ này kiểm tiến trình, cơ sở dữ liệu và các bảng cần thiết; chưa kiểm dịch vụ đăng nhập hay AI. Mã truy cập JWT được kiểm riêng khi xác thực API. Kiểm tra trạng thái công khai không trả địa chỉ cơ sở dữ liệu, thông tin đăng nhập hoặc chi tiết lỗi nội bộ. Các lỗi có `request_id` tương ứng header `X-Request-ID`. API nghiệp vụ chưa triển khai trả 404.

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health/live
Invoke-RestMethod http://127.0.0.1:8080/health/ready
npm.cmd test
```

## Dữ liệu và script cập nhật bảng

SQL nằm tại `backend/src/core/data/migrations/`, kiểu xuống dòng LF được cố định bằng `.gitattributes`. Script cập nhật bảng (migration) chạy trong giao dịch dữ liệu có khóa phối hợp để tránh chạy chồng, lưu mã băm SHA256 vào `public.traceweaver_schema_migrations`. Chạy lại bỏ qua migration khớp mã băm; thay file đã áp dụng hoặc thiếu lịch sử tương ứng sẽ báo lỗi. Thêm migration mới để thay cấu trúc bảng, không sửa file đã chạy và không xóa bảng/volume để né lỗi. Chưa có script tự động đưa cấu trúc bảng về phiên bản trước.

`withTransaction(pool, work)` dùng cùng kết nối cho toàn giao dịch; nếu hàm xử lý báo lỗi, hủy các thay đổi, trả kết nối về nhóm dùng chung và giữ lỗi gốc. Phần đọc/ghi dữ liệu và dịch vụ nghiệp vụ phải dùng giao dịch này để lưu thay đổi và lịch sử thao tác cùng nhau.

## Lịch sử kiểm chứng và giới hạn

<details>
<summary>Các mốc BE-03 đến BE-34 và bản sửa sau rà soát</summary>

Các kết quả dưới đây thuộc đúng lượt kiểm được ghi. Chúng không tự xác nhận trạng thái của mã hoặc máy chủ hiện tại.

Tại BE-22, API quy trình dùng mã JWT dịch vụ riêng, kiểm độc lập JWT người dùng và quyền hiện tại trong cơ sở dữ liệu. Nó dùng cùng điều kiện và khóa lần dựng của hồ sơ. Cùng bộ xử lý chạy case_handling/document_review qua HTTP; CORE_APP_SUBJECT để trống khiến API lõi trả 503. BE-23 thiết lập ứng dụng và quyền thành viên trên máy cá nhân, dựng lại API Docker sẵn sàng và kiểm cả hai quy trình bằng mã ứng dụng/người dùng do Keycloak thật cấp. Xem [quy trình](WORKFLOW.md) và [Keycloak](KEYCLOAK.md).

BE-34 hỗ trợ chế độ cơ bản và mô hình v2 phải bật cấu hình. Chế độ cơ bản vẫn ghi degraded/rule_only; xác thực và hiệu năng trên môi trường thực tế cần nghiệm thu riêng. Tại mốc danh sách ban đầu, có 20 API Node và một API chấm điểm Python. Xem [hướng dẫn AI](SCORER.md).

Các bản sửa sau rà soát gồm từ chối nội dung HTTP nén bằng 415, vá thư viện, giữ độ chính xác micro giây, kiểm lại giới hạn sau che thông tin bí mật, lọc đúng thời gian, dùng chung giao dịch và cấu hình địa chỉ web. Cần khởi động lại mã hoặc dựng lại image để áp dụng.

BE-18: 47 kiểm logic/HTTP/định nghĩa API, 29 PostgreSQL và 29 kiểm xác thực/HTTP/cơ sở dữ liệu đạt; kiểm cấu trúc, giấy phép và chạy thử tiến trình đạt. Đã áp dụng script cập nhật bảng 005 trên môi trường phát triển; PostgreSQL trên máy dùng cổng 15432 sau khi Windows dành riêng dải có cổng 55432. Mã truy cập JWT, thư viện JOSE, HTTP và cơ sở dữ liệu chạy thật; chỉ dịch vụ cung cấp khóa xác minh JWKS được mô phỏng qua Postman. Đăng nhập Keycloak đã được kiểm ở BE-15; BE-18 không kiểm lại dịch vụ đăng nhập thật hoặc API Docker. Các số lượng kiểm tra BE-12 trở xuống là lịch sử.

Cập nhật BE-12: 27 kiểm logic/HTTP/định nghĩa API, 20 PostgreSQL và 23 kiểm xác thực/HTTP/cơ sở dữ liệu đạt; kiểm cấu trúc/giấy phép đạt. Bộ dữ liệu phân trang loại cả giao dịch đang mở ở trang đầu nhưng chỉ lưu thành công sau đó. Chỉ JWKS được mô phỏng bằng Postman; backend/JOSE/PostgreSQL chạy thật. Các đoạn BE-01–03 dưới đây ghi lịch sử bộ khung ban đầu.

11 kiểm logic/HTTP đạt với Node 24.14.1. Ngày 19/10/2026 sau khi người dùng bật Docker, đã chạy migration hai lần trên PostgreSQL 17.11 thật; lần hai không áp dụng lại. `npm.cmd run test:db` đạt 5 tình huống (công cụ báo 6 kiểm tra nếu tính cả nhóm cha): cập nhật bảng đồng thời, hủy thay đổi nghiệp vụ khi lỗi, hủy thay đổi cấu trúc/lịch sử khi SQL lỗi, phát hiện mã băm lệch và trạng thái sẵn sàng HTTP 200/503 với cơ sở dữ liệu thật.

Kiểm các thành phần phối hợp tạo cơ sở dữ liệu riêng `traceweaver_test_<uuid>` trong container trên máy cá nhân, không sửa cơ sở dữ liệu phát triển và không tự xóa sau chạy. Mỗi lần chạy tạo một cơ sở dữ liệu nhỏ mới; chỉ chạy lại khi thay script cập nhật bảng hoặc cách đọc/ghi dữ liệu. Tài khoản cần quyền CREATEDB hoặc quyền khởi tạo tương ứng. Không ghi thông tin đăng nhập ra kết quả kiểm. Backend đang chạy đã trả `/health/live` = ok, `/health/ready` = ready.

BE-03 đã bổ sung [OpenAPI và schema dùng chung](contracts/README.md) cho 21 thao tác, migration 002 cho memberships/roles/groups/sources/grants/knowledge/audit. Chạy `npm run test:contracts` để kiểm OpenAPI/49 schema/fixtures; `npm run test:db` còn kiểm ràng buộc giữa các nhóm làm việc, quyền cấp trùng, phiên bản tri thức và lịch sử chỉ thêm/hủy giao dịch thật. Sau khi thêm script cập nhật bảng, chạy bước cập nhật và khởi động lại máy chủ vì danh sách script được nạp lúc khởi động.

Tại mốc ghi nhận này, 20 thao tác đã có mã xử lý, kiểm JWT/JWKS và phạm vi dữ liệu; API lõi cho ứng dụng tin cậy đã có. `npm run test:identity:native` kiểm cùng điều kiện bằng máy chủ khóa JWKS HTTP giả lập trong môi trường tự động hoặc trên máy cá nhân, không cần Postman. Lệnh test:identity vẫn dùng Postman để kiểm chính công cụ mô phỏng này. Bộ phân tích log thô, AI và kiểm toàn bộ ứng dụng vẫn cần lượt kiểm riêng; các số lượng kiểm theo mốc BE phía trên là lịch sử.

</details>

## Phân tầng

Luồng xử lý đi từ `routers/` (khai báo địa chỉ API) qua `controllers/` (nhận/trả HTTP) tới `services/` (nghiệp vụ). `middlewares/` xử lý HTTP dùng chung. `models/`, `validations/`, `utils/` là khung cho API nghiệp vụ tiếp theo. Kết nối và script cập nhật bảng dùng chung tại `backend/src/core/data/`.

## Môi trường mô phỏng và kiểm chứng hồ sơ

Môi trường mô phỏng lưu trạng thái qua từng thao tác sửa điều kiện và chạy lại yêu cầu. Xem [LAB_SANDBOX.md](LAB_SANDBOX.md) để cấu hình API nguồn, chuyển log vào hệ thống và lấy bằng chứng cho người kiểm duyệt kiểm tra trước khi đóng hồ sơ.

## Định dạng JavaScript bằng Prettier

Từ thư mục gốc, chạy `npm run format:be` để định dạng mã nguồn và kiểm thử;
chạy `npm run format:be:check` để chỉ kiểm tra. Cấu hình dùng 2 dấu cách, nháy đơn,
dấu chấm phẩy và độ dài dòng mục tiêu 100 ký tự. CI kiểm trên Windows/Linux.
Dữ liệu JSON, fixture và SQL migration được giữ nguyên.
