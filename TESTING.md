# Kiểm thử TraceWeaver

Chạy từ root trừ khi ghi khác. Dùng Node.js 24.14.1/npm 11.11.0; cài root và frontend theo lockfile.
Các lệnh dưới đây mô tả cách kiểm; kết quả lịch sử nằm ở [CURRENT_STATUS](docs/CURRENT_STATUS.md), không chứng minh revision mới đã pass.

| Phạm vi | Lệnh | Điều kiện / bằng chứng |
|---|---|---|
| Cấu trúc, SPDX, manifests | `npm run check:base` | Root dependencies; phát hiện tracked secret-file paths, không phải secret-content scanner |
| License backend | `npm run licenses:check` | Root dependencies đúng lockfile |
| License frontend | `npm run licenses:frontend:check` | Frontend dependencies đúng lockfile; giới hạn optional tại [LICENSES](LICENSES.md) |
| Unit / HTTP / contract BE | `npm test` | Không cần PostgreSQL; một số test có thể skip nếu thiếu Python tùy chọn |
| Contracts riêng | `npm run test:contracts` | OpenAPI, JSON Schema và fixtures |
| Simulator | `npm run test:sim` | Logic stateful và sinh/gửi log; không thay UAT server |
| Frontend | `npm --prefix frontend test` | Node tests; không thay browser SSO E2E |
| Frontend lint / build | `npm --prefix frontend run lint`, `npm --prefix frontend run build` | Build cần cấu hình VITE hợp lệ, tạo `frontend/dist/` |
| PostgreSQL integration | `npm run test:db` | DB thật và quyền CREATEDB; tạo DB test riêng, không tự xóa |
| Identity HTTP / DB | `npm run test:identity:native` | PostgreSQL; JWKS HTTP fixture, không phải live Keycloak |
| Identity qua Postman | `npm run test:identity` | PostgreSQL + Postman CLI >=1.74.0 |
| Backend smoke | `npm run smoke` | DB đã migrate; API tạm mặc định loopback 18080 |
| AI | `python -m unittest discover -s ai/tests` | Interpreter trong venv đúng requirements |
| AI license | `python -m ai.scripts.dependency_inventory --check` | Venv riêng đúng requirements |
| AI HTTP baseline | `python -m ai.scripts.smoke` | Venv; khởi động scorer loopback tạm rồi tự dừng |

PowerShell có thể dùng `npm.cmd`; Python phải là executable trong venv, xem [AI RUN](ai/RUN.md).
CI [ci.yml](.github/workflows/ci.yml) định nghĩa các job thực tế; xem kết quả theo đúng commit tại [Actions](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/actions).

## Chọn kiểm tra theo thay đổi

- Docs/license: kiểm liên kết local, inventory và base; không cần khởi động stack.
- Nghiệp vụ/validation: unit và contracts; thay transaction/quyền/migration cần thêm DB/identity.
- UI: frontend tests/lint; thay cấu hình build cần build và kiểm trên trình duyệt.
- Scorer/features/model: Python tests, fixture parity và kiểm tích hợp HTTP; chất lượng cần đánh giá độc lập.

## UAT tích hợp

1. Đăng nhập operator/viewer/reviewer/admin bằng Keycloak; kiểm hủy login, refresh, logout và hết quyền.
2. Tra cứu events, mở provenance; kiểm người thiếu quyền nguồn không đọc được event/run/case cũ.
3. Tạo run, xem graph, duyệt liên kết và thử cập nhật với version cũ.
4. Tạo hồ sơ sandbox, sửa đúng điều kiện rồi chạy lại; phân biệt execution, log delivery và proof.
5. Kiểm reviewer chỉ đóng được khi có bằng chứng đạt khớp yêu cầu hiện tại; kiểm viewer bị từ chối thao tác ghi.

Chi tiết: [FE sandbox handoff](docs/FE_SANDBOX_HANDOFF.md), [workspace admin](docs/FE_WORKSPACE_ADMIN_HANDOFF.md),
[completion handoff](docs/FE_COMPLETION_HANDOFF.md).
Ghi revision, môi trường, lệnh, pass/fail/skip và giới hạn; loại token, credentials và dữ liệu riêng khỏi bằng chứng công khai.

Model [sandbox v2](ai/artifacts/sandbox-v2/README.md) dùng dữ liệu synthetic và chưa đạt mục tiêu precision của dự án.
Full browser E2E, hiệu năng, backup/restore và bảo mật image cần kiểm riêng; unit/contract pass không thay các bằng chứng này.
