# Hỗ trợ TraceWeaver

Đọc [README](README.md), [INSTALL](INSTALL.md) và [mục lục tài liệu](docs/README.md) trước khi báo lỗi.
Mã nguồn đang phát triển; lịch sử triển khai và hạn chế nằm ở [CURRENT_STATUS](docs/overview/status.md).

## Chọn kênh

- Lỗi có thể tái hiện: [bug report](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues/new?template=bug_report.md).
- Ý tưởng hoặc nhu cầu mới: [feature request](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues/new?template=feature_request.md).
- Câu hỏi cài đặt/tích hợp: [Issues](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues), ghi rõ thành phần liên quan.
- Lỗ hổng hoặc dữ liệu nhạy cảm: [SECURITY.md](SECURITY.md); không gửi mật khẩu hoặc khóa truy cập trong báo lỗi.

## Thông tin cần có

Ghi phiên bản hoặc mã commit đang dùng, hệ điều hành, phiên bản Node/npm/Python và trình duyệt nếu liên quan. Mô tả các bước gây lỗi, kết quả bạn mong đợi, kết quả thực tế và những lệnh đã thử.
Nếu lỗi xảy ra khi gọi API, gửi thêm mã phản hồi HTTP, mã lỗi và mã yêu cầu (request ID) sau khi kiểm tra chúng không chứa thông tin riêng. Dùng dữ liệu giả; xóa mã đăng nhập, mật khẩu và thông tin cá nhân khỏi ảnh hoặc log.

## Lỗi thường gặp

| Dấu hiệu | Hướng kiểm tra |
|---|---|
| PowerShell chặn npm.ps1 | Dùng `npm.cmd` |
| Không kết nối được cơ sở dữ liệu, hoặc kiểm tra sẵn sàng trả 503 | Kiểm PostgreSQL, số cổng trong file cấu hình và bước tạo/cập nhật bảng dữ liệu; xem [Docker](backend/DOCKER.md) |
| Không đăng nhập được hoặc không quay lại web sau đăng nhập | Kiểm địa chỉ dịch vụ đăng nhập, mã ứng dụng, địa chỉ quay lại web và địa chỉ web được phép kết nối; xem [Keycloak](backend/KEYCLOAK.md) |
| Giao diện web không kết nối được máy chủ | Địa chỉ máy chủ phải bắt đầu bằng HTTPS, không kèm /api/v1; kiểm file cấu hình web và danh sách địa chỉ được phép kết nối (CORS) cho localhost:5173 |
| Không mở được hành trình hoặc hồ sơ | Kiểm tài khoản còn thuộc nhóm làm việc và còn quyền đọc tất cả nguồn log đã dùng trong hành trình |
| Chế độ kết hợp AI báo degraded | AI không dùng được nên hệ thống dùng quy tắc; kiểm cấu hình và trạng thái dịch vụ chấm điểm AI; xem [SCORER](backend/SCORER.md) |
| Danh sách giấy phép báo lỗi thời | Cài đúng phiên bản thư viện đã khóa trong dự án rồi chạy công cụ tạo danh sách tương ứng tại [LICENSES](LICENSES.md) |
| Cổng web 5173 đang có chương trình sử dụng | Dừng chương trình đang dùng cổng đó, hoặc đổi cổng và cập nhật cả địa chỉ web/địa chỉ quay lại sau đăng nhập. Vite không tự đổi sang cổng khác |

Dự án chưa cam kết thời hạn phản hồi yêu cầu hỗ trợ. Người duy trì dự án tiếp nhận và xử lý các báo lỗi.
