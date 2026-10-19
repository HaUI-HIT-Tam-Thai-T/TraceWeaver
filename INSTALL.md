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

Biến bắt buộc: `DATABASE_URL`. Các biến tùy chọn: `APP_ENV`, `API_HOST`, `API_PORT`, `DB_POOL_MAX`, `SHUTDOWN_TIMEOUT_MS`. Mẫu tại `.env.example`; các biến OIDC/scorer dành cho module tương lai.

API mặc định bind loopback 8080; PostgreSQL Compose bind loopback 55432. `npm run db:stop` dừng DB và giữ volume. Không sửa migration đã áp dụng; thêm migration mới.

Base chưa bao gồm OIDC, giao diện, scorer hoặc simulator chạy được. Không có tài khoản hay mật khẩu demo cố định.

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

Sau khi đã cache npm packages và PostgreSQL image, có thể dùng `npm ci --offline --ignore-scripts`, `npm run db:up` (không pull), migrate và start như trên. Máy chưa có cache cần Internet ở lần chuẩn bị đầu. Base không gọi API bên ngoài; dataset demo và fallback nghiệp vụ chưa triển khai.
