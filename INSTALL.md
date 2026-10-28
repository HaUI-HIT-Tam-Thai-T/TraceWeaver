# Cài đặt backend

1. Cài Node.js 24.14.1/npm 11.11.0 và PostgreSQL 17 hoặc Docker Compose.
2. Chạy `npm ci` tại root.
3. Nếu chưa có `.env`, chạy `npm run db:setup` để sinh mật khẩu local ngẫu nhiên. Nếu dùng DB riêng, cấu hình `DATABASE_URL` trong `.env`.
4. Với Compose, lần đầu chạy `docker compose -f compose.dev.yaml pull postgres`, rồi `npm run db:up`.
5. Chạy `npm run db:migrate`, sau đó `npm run dev:be`.
6. Kiểm `/health/live` và `/health/ready` tại `http://127.0.0.1:8080`.

`npm run start:be` chạy không watch. PowerShell dùng `npm.cmd` nếu execution policy chặn npm.ps1.

## Kiểm thử

`npm test` chạy unit/HTTP/contract tests không cần PostgreSQL. `npm run test:db` kiểm DB thật và tạo database test riêng, không tự xóa; chỉ chạy khi cần kiểm thay đổi tầng dữ liệu.

## Môi trường

Biến bắt buộc: DATABASE_URL và CURSOR_SECRET (ngẫu nhiên ≥32 ký tự, db:setup sinh khi tạo env mới). Với env cũ, bổ sung cursor key và giữ DB credentials. OIDC_ISSUER/API_AUDIENCE/CLIENT_ID và trusted OIDC_JWKS_URI tùy chọn phải khớp provider. Production dùng HTTPS. Xem [Identity BE](backend/IDENTITY.md). Scorer dành cho bước sau.

API mặc định bind loopback 8080; PostgreSQL Compose bind loopback 55432. `npm run db:stop` dừng DB và giữ volume. Không sửa migration đã áp dụng; thêm migration mới.

BE có20/21 operations và local Keycloak PKCE/demo accounts; xem [bootstrap Keycloak](backend/KEYCLOAK.md) và [hiện trạng](docs/CURRENT_STATUS.md). Mật khẩu sinh local nằm trong ignored credentials JSON, không có mật khẩu mặc định public. FE/AI/simulator chưa có runtime. `npm run test:identity` dùng Postman CLI>=1.74.0; `npm run test:identity:native` chạy cùng assertions với JWKS HTTP native và PostgreSQL, không cần CLI.

Frontend development mặc định cổng3000, callback `/auth/callback`. FRONTEND_ORIGINS chứa exact origins, rỗng để tắt; production chỉ HTTPS origins explicit. Chạy `node --env-file-if-exists=.env backend/scripts/setup-frontend-origin.js` sau khi Keycloak healthy để cập nhật public client, không reset credentials. API/health hỗ trợ CORS allowlist; core HTTP chỉ dùng từ app server. Request nén trả415. Event timestamps giữ precision microsecond; nonzero precision vượt6 digits bị reject per record.

## Kiểm tra bộ khung sau khi clone

```sh
npm ci --ignore-scripts
npm run check:base
npm run licenses:check
npm test
```

Chạy `npm run smoke` sau bước migrate để khởi động backend tạm trên loopback 18080, kiểm liveness/readiness rồi tự dừng tiến trình test. Có thể chọn cổng khác bằng `SMOKE_PORT`.

CI lặp lại cài từ lockfile trên Linux và Windows; job PostgreSQL tạo môi trường DB mới, chạy migration và integration. Đó là bằng chứng tái lập phần backend foundation; các module đang là khung chưa có lệnh build/run riêng.

## Offline

Sau khi cache npm packages và PostgreSQL/Keycloak images, có thể cài offline và chạy DB/migrate/start như trên. Auth API cần trusted JWKS endpoint hoặc khóa còn trong cache hợp lệ; thiếu khóa cần thiết thì503, không bypass. Hybrid hiện fallback rule_only khi chưa có scorer; dataset và full app offline demo chưa có.
