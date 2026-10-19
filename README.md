# TraceWeaver

Base dự án tái dựng hành trình yêu cầu cấp môi trường thực hành từ dấu vết của ba dịch vụ intake, account và provision, định hướng DX-Lab HaUI 2026.

## Cấu trúc

```text
src/
  backend/       # Node.js/Express: HTTP, routers, controllers, services, middleware
  core/          # Headless: identity, data, workflow
  frontend/      # Khung giao diện
  ai/            # Khung scorer và training
  simulator/     # Khung sinh dữ liệu giả
contracts/       # OpenAPI, JSON Schema và fixtures
scripts/         # Thiết lập môi trường local
tests/           # Backend, contract và PostgreSQL integration
.github/         # Issue/PR templates và CI
```

Backend dùng JavaScript ES modules, Express và PostgreSQL. Đã có cấu hình môi trường, healthcheck, xử lý lỗi, transaction và migrations. Các phần còn lại mới là khung; API nghiệp vụ, OIDC và AI chưa triển khai. OpenAPI đánh dấu rõ các operation dự kiến.

## Chạy backend

Yêu cầu Node.js 24.14.1, npm 11.11.0 và PostgreSQL 17 hoặc Docker Compose.

```sh
npm ci
npm run db:setup
# Chỉ cần pull khi máy chưa có image PostgreSQL:
docker compose -f compose.dev.yaml pull postgres
npm run db:up
npm run db:migrate
npm run dev:be
```

Nếu đã có `.env`, bỏ qua `db:setup`. Script giữ nguyên cấu hình hiện có. Có thể dùng PostgreSQL riêng bằng `DATABASE_URL`.

- `GET http://127.0.0.1:8080/health/live`: tiến trình hoạt động.
- `GET http://127.0.0.1:8080/health/ready`: DB và migrations sẵn sàng.
- `npm test`: unit, HTTP và contract tests, không cần DB.
- `npm run test:db`: integration, cần PostgreSQL và quyền tạo DB test.
- `npm run start:be`: chạy backend không watch.
- `npm run db:stop`: dừng DB và giữ dữ liệu.

PowerShell có thể dùng `npm.cmd`. Makefile cung cấp lệnh tương đương cho môi trường có GNU Make.

## Ranh giới kiến trúc

Core cung cấp Identity/Data/Workflow dùng chung, không phụ thuộc UI. Backend là lớp HTTP trung gian. Các module sau sẽ bổ sung workspace/tri thức, dữ liệu có provenance, review và workflow có audit, cùng scorer có bằng chứng và giới hạn rõ ràng. Base hiện tại chưa phải sản phẩm hoàn chỉnh hoặc bằng chứng đạt nghiệm thu bài thi.

Xem [cài đặt](INSTALL.md), [đóng góp](CONTRIBUTING.md), [bảo mật](SECURITY.md) và [API contracts](contracts/README.md).

License sản phẩm chưa được chủ sở hữu chốt; package hiện để `UNLICENSED`.
