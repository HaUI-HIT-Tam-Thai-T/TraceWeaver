# Hướng dẫn sử dụng và vận hành

[Mục lục tài liệu](../README.md)

## Bắt đầu

1. Mở [TraceWeaver trực tuyến](https://traceweaver.quizlearn.tech) và chọn [tài khoản demo](../../README.md#chọn-vai-trò-để-trải-nghiệm).
2. Chọn workspace **TraceWeaver Sandbox — Mô phỏng kiểm chứng** để thử đúng từng vai trò.
3. Làm theo [một hành trình điều tra](demo.md): tìm log → tái dựng → xử lý → chạy lại → kiểm chứng.

## Tự vận hành

| Công việc | Hướng dẫn |
|---|---|
| Cài từ source và cấu hình môi trường | [INSTALL](../../INSTALL.md) |
| Dựng API/DB local | [Docker](../../backend/DOCKER.md) |
| Cấu hình SSO và tài khoản local | [Keycloak](../../backend/KEYCLOAK.md) |
| Chạy frontend | [Frontend](../../frontend/README.md) |
| Sinh dữ liệu mô phỏng | [Simulator](../../simulator/README.md) |
| Vận hành API/scorer trên Oracle | [Triển khai](../../deploy/oracle/README.md) |
| Kiểm license trước khi thay dependency | [Kiểm tra license](license-checks.md) |
| Đóng gói source và phát hành | [Release](release.md) |
| Chẩn đoán lỗi và gửi yêu cầu hỗ trợ | [SUPPORT](../../SUPPORT.md) |

Tài khoản local và tài khoản web trực tuyến là hai bộ riêng. Giữ `.env`, khóa, token và credentials vận hành ngoài Git; mật khẩu demo công khai chỉ áp dụng cho bốn tài khoản được ghi trong README.
