# Hướng dẫn sử dụng và vận hành

[Mục lục tài liệu](../README.md)

## Bắt đầu

1. Mở [TraceWeaver trực tuyến](https://traceweaver.quizlearn.tech) và chọn [tài khoản demo](../../README.md#chọn-vai-trò-để-trải-nghiệm).
2. Chọn nhóm làm việc **TraceWeaver Sandbox — Mô phỏng kiểm chứng** để thử đúng từng vai trò.
3. Làm theo [một hành trình điều tra](demo.md): tìm log → tái dựng → xử lý → chạy lại → kiểm chứng.

## Tự vận hành

| Công việc | Hướng dẫn |
|---|---|
| Cài từ mã nguồn và cấu hình môi trường | [INSTALL](../../INSTALL.md) |
| Chạy máy chủ và cơ sở dữ liệu trên máy cá nhân | [Docker](../../backend/DOCKER.md) |
| Thiết lập đăng nhập tập trung và tài khoản trên máy cá nhân | [Keycloak](../../backend/KEYCLOAK.md) |
| Chạy giao diện web | [Frontend](../../frontend/README.md) |
| Sinh dữ liệu mô phỏng | [Simulator](../../simulator/README.md) |
| Vận hành máy chủ và dịch vụ chấm điểm AI trên Oracle | [Triển khai](../../deploy/oracle/README.md) |
| Kiểm giấy phép khi thay thư viện | [Kiểm tra license](license-checks.md) |
| Đóng gói mã nguồn và phát hành | [Release](release.md) |
| Chẩn đoán lỗi và gửi yêu cầu hỗ trợ | [SUPPORT](../../SUPPORT.md) |

Tài khoản trên máy cá nhân và tài khoản web trực tuyến là hai bộ riêng. Không đưa `.env`, khóa truy cập, mã đăng nhập hoặc mật khẩu vận hành lên Git; mật khẩu demo công khai chỉ áp dụng cho bốn tài khoản được ghi trong README.
