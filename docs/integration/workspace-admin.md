# Bàn giao FE — Quản trị workspace và tài khoản

Cập nhật **30/10/2026 (Asia/Saigon)**. Runtime source `4cdd022`, image `traceweaver-api:be-4cdd022`
đã deploy tại [API/Swagger](https://api.quizlearn.tech/docs/), migrations001–011 đã áp dụng.
Đã kiểm qua HTTPS và Keycloak thật; FE chưa được sửa hoặc triển khai trong lượt này.

## Việc FE cần làm và sidebar

Thêm mục **Quản trị workspace** cho người có role `admin` của workspace đang chọn.
Một trang `/workspace-admin` với phần **Thành viên và quyền** cùng **Tạo tài khoản** là đủ.

| Phần UI | Chức năng |
|---|---|
| Thành viên | Subject, active/revoked, roles, direct_source_ids; phân trang |
| Thêm người đã có SSO | Nhập subject Keycloak, chọn roles; không tạo lại username |
| Sửa thành viên | Chọn roles, kích hoạt/thu hồi membership workspace |
| Quyền nguồn | Cấp/thu hồi direct read theo nguồn caller hiện đọc được |
| Tạo tài khoản | Username, mật khẩu tạm, roles; giữ operation key để phục hồi |
| Trạng thái tạo | Pending/completed từ BE; refresh danh sách sau hoàn tất |

Lấy quyền từ membership của workspace trong `GET /api/v1/me`, không tin JWT role claims.
BE kiểm lại mỗi request. Admin không tự có quyền đọc mọi nguồn hoặc quyền reviewer.
Danh sách hiện trả **subject**, không có username/display_name/email; không giả tên từ subject.
Hiển thị subject rút gọn kèm copy nguyên giá trị, encode subject trên URL.

Sidebar **Hồ sơ** giữ panel kiểm chứng mô phỏng trong chi tiết hồ sơ theo
[bàn giao simulator](sandbox.md). Tài khoản SSO ở đây khác tài khoản nghiệp vụ mô phỏng
được bật bằng command `account` trong hồ sơ. Không thêm workspace CRUD, realm/group management,
xóa tài khoản/log hoặc reset mật khẩu vào phạm vi này.

## Môi trường và SSO

| Mục | Giá trị |
|---|---|
| API origin/prefix | `https://api.quizlearn.tech/api/v1` |
| OpenAPI | [Contract đang phục vụ](https://api.quizlearn.tech/docs/openapi.json) |
| Issuer | `https://api.quizlearn.tech/identity/realms/traceweaver` |
| Public client | `traceweaver-web`, Authorization Code + PKCE S256 |
| Workspace UAT | `10000000-0000-4000-8000-000000000016` |
| FE production đã đăng ký | `https://traceweaver.quizlearn.tech` |
| Callback production | `https://traceweaver.quizlearn.tech/auth/callback` |

API đã cho phép exact-origin CORS GET/POST/PUT và Authorization/Content-Type/Idempotency-Key cho origin
production trên, giữ origin Swagger. Keycloak đã có callback, Web Origin và logout URI production;
kiểm form login, token CORS và API PUT preflight đạt. Chưa xác nhận DNS, hosting SPA hoặc UI production.
Local `http://localhost:5173` hiện dùng Vite proxy `/api`. BE hỗ trợ opt-in gọi trực tiếp bằng
`FRONTEND_LOCAL_ORIGINS=http://localhost:5173,http://127.0.0.1:5173` trong môi trường API server;
chỉ có hiệu lực sau khi triển khai source mới và khởi động lại API. Không tự bật local origins mặc định.
Callback/Web Origin local đã có từ trước; phải kiểm lại đúng hostname/cổng khi triển khai.
Xem [cấu hình React/Vite](frontend.md).

Để FE local gọi trực tiếp, đặt trong `frontend/.env.development.local`:
BE-52 đã triển khai ngày 30/10/2026 với API image `traceweaver-api:be-1b6a72e`.
21 kiểm tra live đạt, gồm callback/token CORS Keycloak cho cả hai local origins.
Chưa kiểm lại toàn bộ UI bằng trình duyệt trong lượt này.

```dotenv
VITE_API_BASE_URL=https://api.quizlearn.tech
API_PROXY_TARGET=https://api.quizlearn.tech
```

Giữ các biến `VITE_KEYCLOAK_*` hiện có và khởi động lại Vite. Không sửa giao diện hoặc service FE.
`API_PROXY_TARGET` vẫn cần cho cấu hình Vite hiện tại, nhưng request có API base URL tuyệt đối
sẽ gọi trực tiếp API HTTPS, không đi qua proxy `/api`. Không thêm `/api/v1` vào base URL.
BE chỉ chấp nhận đúng origins được liệt kê; `localhost` và `127.0.0.1` là hai origins riêng,
không tự cho cổng khác, LAN IP hoặc domain khác. JWT, role và source grants vẫn được kiểm như cũ.

Dùng SSO và tài khoản hiện có. Thông tin đăng nhập chỉ xem trên server, không đưa vào docs/Git/VITE/log.
FE dùng user bearer; không gọi Admin REST, không nhận service secret. Admin REST chỉ qua mạng Docker nội bộ.

## API và version

Prefix: `/api/v1/workspaces/{wid}/admin`. POST/PUT gửi `Content-Type: application/json`.

| Method/path | Input | Thành công |
|---|---|---|
| GET `/members?limit=50&after=...` | limit1–100; bỏ after khi bắt đầu | 200 `{workspace_id,version,items,next_after}` |
| POST `/members` | `{subject,roles,expected_version}` | 201 `{subject,active,roles,version}` |
| PUT `/members/{subject}` | `{roles,active,expected_version}` | 200, có subject/roles/active/version |
| PUT `/members/{subject}/sources/{sid}` | `{enabled,expected_version}` | 200 `{subject,source_id,enabled,version}` |
| POST `/accounts` | `{username,temporary_password,roles,expected_version}` + Idempotency-Key | 201 completed operation |
| GET `/accounts/provisioning` | Header Idempotency-Key, không body/query | 200 operation của chính actor/workspace |

`items`: `{subject,active,roles,direct_source_ids}`. Phân trang dùng subject từ `next_after`, không dùng
cursor events/cases. Sau mutation refresh từ trang đầu vì danh sách có thể đổi giữa các trang.
`version` là version quản trị workspace từ GET members, độc lập case/run/link/sandbox version.
Không tự cộng version FE. Stale409 thì đọc lại và cho người dùng xem dữ liệu mới trước khi gửi lại.

`roles`: mảng khác rỗng, không trùng, chỉ viewer/operator/reviewer/admin. Không cấp ingest_service.
`active:false` chỉ thu hồi membership workspace, không khóa SSO toàn hệ thống và không xóa tài khoản.
Không gửi actor, realm role, service secret hoặc trường kết quả tự khai vào body.

Ví dụ thêm thành viên đã có SSO:

```json
{"subject":"keycloak-human-subject","roles":["operator"],"expected_version":1}
```

Ví dụ tạo account; password dưới đây là **dữ liệu giả**, không dùng làm mặc định:

```json
{"username":"new.operator","temporary_password":"SYNTHETIC-EXAMPLE-ONLY-123","roles":["operator"],"expected_version":2}
```

Username3–64 ký tự ASCII chữ thường, bắt đầu chữ/số, còn lại cho `.`, `_`, `-`; không prefix
`service-account-`. Password12–128 ký tự và phải đạt chính sách Keycloak. Chỉ giữ password trong bộ nhớ
form khi xử lý, không localStorage/sessionStorage/URL/analytics/log. Sau khi hoàn tất và bàn giao theo
kênh phù hợp, xóa password khỏi form. API không trả lại password.

## Tạo account và phục hồi lỗi

1. Đọc version mới, sinh một Idempotency-Key cho một intent tạo account.
2. POST account. `201 {state:"completed",subject,username,roles,active:true,version}` nghĩa SSO và
   membership hoàn tất. Refresh danh sách; account mới chưa tự có quyền nguồn.
3. Timeout/503 ACCOUNT_PROVISIONING_PENDING: giữ key/body, GET operation. Pending có
   `{state:"pending",username,current_version}`; completed GET có thêm current_version.
4. Retry cùng key/username/password/roles; chỉ đổi expected_version theo bản vừa đọc. Completed replay
   trả kết quả cũ, không tạo lại user. Không tạo key mới để thử lại cùng account.
5. Mất password/key sau reload: kiểm tra theo quy trình vận hành, không tự tạo intent khác.

Keycloak và PostgreSQL không chung giao dịch: SSO có thể đã tạo nhưng membership chưa hoàn tất.
BE nhận lại đúng account có ownership marker của operation; không chiếm username của người khác,
không reset mật khẩu cũ hoặc xóa account để rollback. Không hiện thành công chỉ vì thấy pending.

| Lỗi | FE xử lý |
|---|---|
| 400 INVALID_INPUT / IDEMPOTENCY_REQUIRED | Kiểm form/header theo contract đóng |
| 401 / 403 | Session hoặc thiếu quyền; xóa cache quyền khi đổi workspace/logout |
| 404 | Ngoài scope/không tồn tại; không suy đoán đã thành công |
| 409 VERSION_CONFLICT | Đọc lại version và dữ liệu; không ghi đè mù |
| 409 MEMBER_EXISTS | Sửa membership hiện có, kể cả revoked |
| 409 IDEMPOTENCY_CONFLICT | Cùng key khác body; giữ nguyên intent |
| 409 ACCOUNT_OWNERSHIP_CONFLICT | Username thuộc account khác; không reset/adopt |
| 422 LAST_ADMIN_REQUIRED | Giữ ít nhất một admin active |
| 422 SERVICE_ACCOUNT_PROTECTED | Không sửa service; provider có thể chặn trước bằng ACCOUNT_UNAVAILABLE |
| 422 ACCOUNT_NOT_FOUND / ACCOUNT_UNAVAILABLE / MEMBER_INACTIVE | Kiểm subject/trạng thái human SSO và membership |
| 422 ACCOUNT_POLICY_REJECTED | Profile/password không đạt chính sách; dùng lỗi đã làm sạch từ BE |
| 503 ACCOUNT_PROVIDER_DISABLED | Chưa có adapter; không tự retry. Không sinh pending giả; operation cũ vẫn đọc/replay completed được |
| 503 ACCOUNT_PROVISIONING_PENDING | GET operation, retry cùng key/body khi cần |
| 503 ACCOUNT_PROVIDER_UNAVAILABLE / ADMIN_UNAVAILABLE | Tạm ngừng thao tác; không tự khai thành công |

Admin cuối cùng và configured core/collector hoặc ingest service được BE bảo vệ. Thu hồi direct read
không thu hồi quyền có từ group; thu hồi membership chặn toàn workspace ngay cả với token cũ.

## Đăng nhập lần đầu và UAT FE

Account mới phải đổi mật khẩu trong Keycloak. UAT thật còn yêu cầu bổ sung profile (họ/tên/email);
để Keycloak hoàn thành required actions rồi quay về callback. FE không gọi API admin đổi mật khẩu
và không giả định nhận token ngay sau nhập mật khẩu tạm.

- Admin xem/phân trang/thêm subject; viewer/operator/reviewer đơn thuần bị403.
- Tạo -> đổi password/profile -> callback -> `/me` thấy membership -> chưa thấy nguồn.
- Cấp read -> thấy đúng nguồn; revoke -> mất nguồn; revoke membership -> token cũ cũng bị chặn.
- Hai tab cùng version chỉ một mutation thành công; không thu hồi admin cuối hoặc sửa service.
- Thử pending/timeout, replay completed, key khác body, username trùng khác owner.
- Chạy checklist [simulator](sandbox.md), không dùng quản trị SSO thay command mô phỏng.

Server đã đạt **40 kiểm tra quản trị HTTPS/Keycloak** và **36 kiểm tra simulator**. Case mới
`5115dbaf-7190-493c-8cb6-12bfa467816d` đã đóng, request `LAB-BE51-20261029-185155` giữ lịch sử
RAM -> image -> account -> passed, log delivered, proof reviewer đạt; hybrid không degraded.
Mã UAT dùng thời gian UTC server; ngày bàn giao ở đầu tài liệu theo Asia/Saigon.
Giữ account/hồ sơ UAT để xem lịch sử. Chưa kiểm toàn bộ UI FE bằng trình duyệt.

Chi tiết vận hành: [Workspace-admin BE](../../backend/WORKSPACE_ADMIN.md). OpenAPI là nguồn chuẩn DTO.
