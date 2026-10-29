# Workspace-admin và tài khoản — bàn giao BE/FE

Trạng thái: mã BE và OpenAPI đã triển khai trong nhánh source, kiểm thử local đạt. Chưa rollout lên
Oracle: bộ duyệt tự động chặn service client/secret Keycloak, profile attribute và migration011 trên
server vì cần quyền rõ ràng cho thay đổi production. Server vẫn giữ BE simulator đang chạy trước đó.
Không diễn giải kiểm thử adapter HTTP giả lập là đã tạo/login tài khoản thật trên Keycloak production.

Phạm vi tối thiểu: quản lý thành viên trong workspace hiện có, role viewer/operator/reviewer/admin,
quyền đọc trực tiếp từng nguồn và tạo tài khoản Keycloak với mật khẩu tạm. Không tạo/xóa workspace,
không xóa tài khoản, không đổi mật khẩu tài khoản cũ, không quản trị nhóm/phiên đăng nhập/realm role.
Các tài khoản và luồng demo cũ giữ nguyên. FE chưa có giao diện quản trị mới.

## Quyền và API

Mọi endpoint yêu cầu Bearer access token hiện có, active membership và role `admin` theo DB của đúng
workspace. JWT role claims không cấp quyền. Admin không tự có quyền đọc dữ liệu nguồn: cấp/thu hồi
direct read chỉ được thực hiện cho nguồn mà chính caller có quyền đọc hiện tại. Không cấp ingest/service
roles qua API này; tài khoản ingest được bảo vệ. Service accounts không được thêm/kích hoạt/cấp quyền
như tài khoản người dùng. Tác vụ cũ vẫn kiểm lại grants/membership khi đọc/ghi.

Prefix: `/api/v1/workspaces/{wid}/admin`.
Preflight CORS cho PUT được cho phép với frontend origin trong allowlist hiện có; không mở wildcard.

| Method/path | Body / kết quả |
|---|---|
| GET `/members?limit=50&after=<subject>` | 200 `{workspace_id,version,items,next_after}`; limit1–100; items có subject/active/roles/direct_source_ids; after là subject từ trang trước, không phải token |
| POST `/members` | 201; `{subject,roles,expected_version}`; xác minh đúng human account đang enabled trong Keycloak; đã có membership trả409, kể cả membership revoked |
| PUT `/members/{subject}` | 200; `{roles,active,expected_version}`; active=false thu hồi membership tại workspace, không xóa/disable tài khoản SSO |
| PUT `/members/{subject}/sources/{sid}` | 200; `{enabled,expected_version}`; cấp/thu hồi **direct read**; không sửa group grants |
| POST `/accounts` | 201; `{username,temporary_password,roles,expected_version}` + header `Idempotency-Key`; tạo human account và membership |
| GET `/accounts/provisioning` | 200; header `Idempotency-Key`; trả operation của chính actor/workspace; không cần gửi lại password |

POST/PUT chỉ nhận JSON đóng theo OpenAPI, không nhận actor, subject giả ở body tạo account, service role,
realm role, client secret hay trường kết quả tự khai. Encode subject trên URL bằng encodeURIComponent.
GET members chỉ nhận limit/after; endpoint khác không nhận query. Không trộn version quản trị với
Case.version, Run.version, Link.version hay sandbox source_version.

`version` là version **quản trị workspace** từ GET members. Mỗi thay đổi membership/role/direct-read
tăng version; request dùng expected_version cũ trả409. Sau mutation GET lại danh sách; không tự cộng.
Phân trang live theo subject, có thể thay đổi giữa các trang; refresh thì bắt đầu lại, không cache roles
qua đổi workspace/logout. Giới hạn/cursor này không dùng signed cursor của events/cases.

Không thể bỏ role admin hoặc thu hồi membership của admin active cuối cùng:422 LAST_ADMIN_REQUIRED.
Tài khoản đang là ingest_service:422 SERVICE_ACCOUNT_PROTECTED. Thu hồi direct read không bảo đảm mất
mọi quyền nếu còn group grant; để mất quyền workspace ngay thì thu hồi membership. Không có nút xóa.

## Ví dụ request

```json
{"subject":"existing-keycloak-subject","roles":["operator"],"expected_version":1}
```
```json
{"roles":["viewer"],"active":false,"expected_version":2}
```
```json
{"enabled":true,"expected_version":3}
```
```json
{"username":"new.operator","temporary_password":"SYNTHETIC-EXAMPLE-ONLY-123","roles":["operator"],"expected_version":4}
```

Password trong ví dụ là dữ liệu giả, không dùng làm mật khẩu demo hay mặc định. Username3–64 ký tự,
chữ thường ASCII, bắt đầu chữ/số, cho phép `.`, `_`, `-`; prefix `service-account-` dành riêng và bị từ chối.
Password12–128 ký tự, còn phải đạt chính sách
Keycloak. Password chỉ gửi HTTPS, không log/lưu browser storage/DB/audit; API không trả lại password.
Người mới bắt buộc đổi mật khẩu ở lần đăng nhập đầu. Các account cũ không bị reset.

Response create/replay hoàn tất gồm `{state:"completed",subject,username,roles,active:true,version}`.
Operation pending chỉ có `{state:"pending",username,current_version}` khi GET; marker nội bộ bị loại bỏ.
Operation completed GET có thêm current_version. Version trong completed response là version lúc hoàn tất;
luôn GET members để có version hiện tại. Không có quyền nguồn tự sinh: sau khi tạo, admin cấp read từng
nguồn theo API riêng. Có thể đăng nhập nhưng chưa thấy log cho đến khi được cấp grants.

## Keycloak và DB không phải một giao dịch

BE lưu pending operation trước khi tạo bên Keycloak, với fingerprint HMAC của input và marker riêng.
Nếu Keycloak tạo xong nhưng DB/audit lỗi, membership chưa được cấp; BE không xóa/reset account đó.
503 ACCOUNT_PROVISIONING_PENDING có nghĩa kết quả cấp tài khoản **chưa rõ/chưa hoàn tất**, không được
tạo intent khác ngay. GET operation bằng cùng Idempotency-Key để xem; retry cùng key/username/password/
roles, chỉ cập nhật expected_version sau khi đọc bản mới. Fingerprint không chứa expected_version.

Retry nhận409 từ Keycloak chỉ được dùng lại tài khoản có đúng ownership marker của operation; không
nhận tài khoản tên trùng của người khác và không đổi mật khẩu của nó. Cùng key khác body trả409
IDEMPOTENCY_CONFLICT. Key của actor/workspace khác không dùng để đọc operation này. Completed replay
không tạo lại user/membership/audit. Key và secret HMAC phải giữ ổn định trong thời gian xử lý; nếu thay
CURSOR_SECRET thì pending operations cần xử lý vận hành. Không lưu password để BE tự retry ngầm.

Nếu mất key hoặc mất password đang nhập sau khi đóng trang, không tự tạo key mới để thử trùng tên;
admin kiểm tra operation/Keycloak bằng quy trình vận hành. Nếu username đã tồn tại, dùng luồng thêm
member bằng subject sau xác minh danh tính, không chiếm account đó qua create.

## Cấu hình vận hành

Áp dụng migration011 sau008–010. Runtime cần SELECT/INSERT/UPDATE trên workspace_admin_versions,
account_provisionings; SELECT/INSERT/UPDATE trên memberships/source_grants; SELECT/INSERT/DELETE trên
membership_roles; quyền audit INSERT giữ nguyên. Không cấp quyền xóa tài khoản/log hay sửa workflow history.

ACCOUNT_ADMIN_CLIENT_ID và ACCOUNT_ADMIN_CLIENT_SECRET là cấu hình server-only, để trống mặc định.
Thiếu adapter: ACCOUNT_PROVIDER_DISABLED hoặc pending khi tạo chưa hoàn tất; phần đọc và thu hồi DB vẫn
dùng được. Cấp/kích hoạt tài khoản/read và thêm membership cần xác minh human account ở Keycloak.
Production vẫn bắt buộc TLS theo OIDC_ISSUER. Adapter dùng client credentials, timeout chung10giây,
không dùng admin password trong runtime và không đưa token admin ra browser.

Service client riêng trong realm, có quyền quản lý/tra cứu user phù hợp; không cấp realm-admin.
Khai báo User Profile attribute `traceweaverProvisioningKey` có permissions view/edit chỉ admin để marker
được lưu mà user không tự đặt/sửa. Không bật unmanaged attributes cho mọi user chỉ để lưu marker.
Nếu marker không được lưu, API từ chối nhận ownership; cấu hình profile trước khi bật create account.
Tài liệu tham chiếu: [Keycloak Admin REST](https://www.keycloak.org/docs-api/26.0.8/rest-api/).

Lỗi cần FE xử lý:400 input/key;401 session;403 không phải admin;404 ngoài scope/member/operation;
409 VERSION_CONFLICT/MEMBER_EXISTS/IDEMPOTENCY_CONFLICT/ACCOUNT_OWNERSHIP_CONFLICT;
422 LAST_ADMIN_REQUIRED/MEMBER_INACTIVE/SERVICE_ACCOUNT_PROTECTED/ACCOUNT_NOT_FOUND/
ACCOUNT_UNAVAILABLE/ACCOUNT_POLICY_REJECTED;503 ADMIN_UNAVAILABLE/ACCOUNT_PROVIDER_DISABLED/
ACCOUNT_PROVIDER_UNAVAILABLE/ACCOUNT_PROVISIONING_PENDING. Không hiển thị raw lỗi provider hoặc password.

## Checklist nghiệm thu

- Viewer/operator/reviewer đơn thuần không gọi admin API; membership ngoài workspace không dùng được.
- Admin cuối cùng không tự thu hồi; hai admin thay đổi cùng version chỉ một thành công.
- Cấp direct read cho human đã xác minh; nguồn ngoài scope không cấp được; revoke membership chặn request
  dữ liệu tiếp theo cả với token cũ. Không tự đổi owner của hồ sơ đang xử lý khi thành viên bị thu hồi.
- Tạo account -> đổi password lần đầu -> login -> thấy membership, chưa có source cho đến khi cấp.
- Provider lỗi/timeout, DB/audit lỗi sau create, retry cùng key, key khác body, username trùng khác owner.
- GET operation không trả marker, password hay client token. Không log password trong error/metrics/audit.
- Test luồng demo simulator/case cũ và dữ liệu cũ; browser UI là công việc FE riêng.
