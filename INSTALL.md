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

Biến bắt buộc cho backend: `DATABASE_URL` và `CURSOR_SECRET` (ngẫu nhiên ≥32 ký tự, `db:setup` sinh khi tạo env mới). Với env cũ, bổ sung cursor key và giữ DB credentials. `OIDC_ISSUER`, `OIDC_API_AUDIENCE`, `OIDC_CLIENT_ID` và trusted `OIDC_JWKS_URI` tùy chọn phải khớp provider. Production dùng HTTPS. Mẫu tại `.env.example`; xem [Identity BE](backend/IDENTITY.md).

AI có hướng dẫn riêng tại [ai/RUN.md](ai/RUN.md), dùng môi trường Python độc lập và `SCORER_SERVICE_SECRET` nội bộ. Model mặc định là bootstrap; để chạy model sandbox v2, xuất artifact rồi cấu hình `SCORER_MODEL_PATH` theo hướng dẫn. API AI không tự load `.env`.

API mặc định bind loopback 8080; PostgreSQL Compose bind loopback 55432. `npm run db:stop` dừng DB và giữ volume. Không sửa migration đã áp dụng; thêm migration mới.

BE có JWT/JWKS verification, ingestion và các API đọc có quyền; IdP/login/SSO thật vẫn cần kiểm chứng. Frontend có hướng dẫn tại [frontend/README.md](frontend/README.md). AI đã có model bootstrap, baseline và pipeline offline, chạy riêng không yêu cầu DB; tích hợp scorer với reconstruction backend vẫn còn thiếu. Không có tài khoản demo cố định. `npm run test:identity` cần PostgreSQL và Postman CLI >=1.74.0, kiểm qua JWKS local stand-in, chưa xác nhận Keycloak thật.

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

Sau khi cache npm packages và PostgreSQL image, có thể cài offline, chạy DB/migrate/start như trên. Auth API cần trusted JWKS endpoint hoặc khóa còn trong cache hợp lệ; thiếu khóa cần thiết thì 503, không bypass. Dataset demo và fallback nghiệp vụ chưa triển khai.
