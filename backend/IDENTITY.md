# Identity phía BE

BE xác minh access token, không nhận mật khẩu hoặc tự cấp token. Đăng nhập/SSO/PKCE nằm ở Identity provider/client. Bước này không triển khai FE, AI hoặc Keycloak server.

Cập nhật BE-15: Keycloak local thật đã được thêm vào Docker và Swagger đã có đăng nhập Authorization Code+PKCE; operator/viewer/service tokens, refresh và API quyền đã kiểm thật. Xem [KEYCLOAK.md](KEYCLOAK.md) để đăng nhập và lấy mật khẩu demo trong file ignored. Những đoạn dưới ghi chi tiết foundation trước khi dựng IdP.

## Cấu hình

DATABASE_URL và CURSOR_SECRET ngẫu nhiên ≥32 ký tự là bắt buộc. `db:setup` sinh cả hai khi tạo env mới; với env cũ cần bổ sung cursor key riêng, giữ nguyên DB credentials. Giữ key qua restart; xoay key làm cursor cũ invalid. Không commit/log key hoặc token.

| Biến | Giá trị mặc định / ý nghĩa |
|---|---|
| OIDC_ISSUER | http://localhost:8081/realms/traceweaver; issuer realm chính xác |
| OIDC_API_AUDIENCE | traceweaver-api |
| OIDC_CLIENT_ID | traceweaver-web; authorized user client trong azp |
| OIDC_JWKS_URI | Bỏ qua để dùng issuer + /protocol/openid-connect/certs; chỉ trusted config, không lấy URL từ JWT |
| OIDC_TIMEOUT_MS | 2000, tối đa 10000 |
| CORE_APP_CLIENT_ID | traceweaver-core; client riêng cho core HTTP, khác user/ingest |
| CORE_APP_SUBJECT | Exact service-account sub; trống khiến core503, không ảnh hưởng API user |

BE-22: [Core workflow HTTP](WORKFLOW.md) dùng app JWT trong Authorization và original user JWT trong X-End-User-Authorization, cả hai được core verify độc lập. X-Workspace-Id bắt buộc; service và user đều cần membership active. Role/source grants của user vẫn đọc DB. BE-23 thêm setup-core-identity-demo.js để provision confidential client/membership local, đã kiểm token thật và cả hai workflow qua Docker API; xem [Keycloak](KEYCLOAK.md). Cấu hình production vẫn riêng.

Production bắt buộc HTTPS; development chỉ cho HTTP loopback. Token profile Keycloak-compatible: RS256, iss/aud đúng, sub không rỗng ≤255 ký tự, exp/iat bắt buộc, payload typ=Bearer và azp đúng user client. Clock tolerance 5s, JWKS cache 5 phút qua JOSE. ID token và token ingest client bị từ chối. IdP cần audience mapper cấp API audience cho access token; không nới audience để né lỗi.

Không introspect token/logout session của IdP trong bước này; JWT vẫn phải còn hạn. App permissions luôn lấy lại từ PostgreSQL, không tin roles/groups trong token hay X-Actor-Subject của caller. Không tự tạo membership/grant khi login.

## API và quyền

| API | Hành vi |
|---|---|
| GET /api/v1/me | Subject đã verify và memberships active với roles/group_ids; chưa có membership trả mảng rỗng |
| GET /api/v1/workspaces/{wid}/sources | Membership active + viewer/operator/reviewer/admin và direct/group read grants active |
| GET /api/v1/workspaces/{wid}/knowledge | Membership active + role đọc; latest version của mỗi article trong workspace |

Admin không tự đọc sources; ingest grant không thay read grant. Group membership/membership/grant thu hồi có hiệu lực với cùng token cũ. Membership/grant được kiểm lại trong query trả dữ liệu.

Sources/knowledge: limit default50/max100, keyset sort id tăng; knowledge có q≤500 tìm literal substring title/body (không coi %/_ của caller là wildcard). Cursor HMAC gắn subject/workspace/filter/current scope; đổi scope/filter hoặc tamper ->400. Chưa phải event snapshot pagination.

401 có WWW-Authenticate cho token thiếu/sai; 403 cho membership thấy được nhưng thiếu role; 404 cho workspace ngoài membership; 503 cho JWKS/DB unavailable. Health public chỉ kiểm process/DB/migrations, không cam kết IdP reachable. Auth fail closed nếu không lấy được khóa cần thiết, không có chế độ bypass.

## Kiểm chứng

`npm test` / `npm run check:base` / `npm run licenses:check` kiểm phần thông thường. `npm run test:identity` cần PostgreSQL/quyền CREATEDB và Postman CLI >=1.74.0, chạy BE thật + DB test riêng + Postman JWKS qua HTTP. Private key chỉ sinh trong bộ nhớ; mock chỉ nhận public keys, logs được test kiểm tra và không commit. DB test giữ lại sau chạy, không tự drop.

Đã kiểm token sai/hết hạn/missing exp/future nbf/wrong client, JWKS JSON/HTML/timeout/unreachable, DB scope/cursor/revocation và failures. Local Keycloak PKCE/refresh/delegated core đã kiểm theo [Keycloak guide](KEYCLOAK.md); logout/introspection/production riêng.

Mock local xuất phát từ contract certs endpoint tại postman/oidc-jwks.openapi.json; không publish/deploy. `npm run test:identity:native` giữ assertions, thay duy nhất helper JWKS bằng HTTP native, chạy tuần tự để tránh test timeout300ms dưới tải song song. CI PostgreSQL đã gọi suite native; chưa xác nhận kết quả remote. Postman command giữ để kiểm CLI lifecycle riêng. Secrets/private keys không được ghi log/file.
