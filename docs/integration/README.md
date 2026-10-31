# Tích hợp frontend, backend và AI

[Mục lục tài liệu](../README.md) · [Tham chiếu kỹ thuật](../reference/README.md)

## Cấu hình kết nối

| Thành phần | Địa chỉ / cấu hình |
|---|---|
| Web production | `https://traceweaver.quizlearn.tech` |
| API và Swagger | `https://api.quizlearn.tech`, [Swagger](https://api.quizlearn.tech/docs/) |
| Địa chỉ nơi cấp mã đăng nhập Keycloak | `https://api.quizlearn.tech/identity/realms/traceweaver` |
| Ứng dụng web đã đăng ký để đăng nhập | `traceweaver-web`, Authorization Code + PKCE S256 |
| Địa chỉ quay lại web sau đăng nhập | `https://traceweaver.quizlearn.tech/auth/callback` |
| Web trên máy cá nhân | `http://localhost:5173`; cấu hình theo [Frontend](../../frontend/README.md) |
| Scorer | Dịch vụ chỉ máy chủ gọi qua kết nối mã hóa TLS; trình duyệt không gọi trực tiếp |

Giao diện dùng địa chỉ máy chủ bắt đầu bằng HTTPS, không thêm `/api/v1` vào biến cấu hình. Khóa bí mật của bộ nhận log, ứng dụng gọi lõi xử lý và dịch vụ cấp tài khoản chỉ lưu ở máy chủ.

## Thứ tự đọc

1. [OpenAPI và JSON Schema](../../backend/contracts/README.md): nguồn chính cho địa chỉ API, cấu trúc dữ liệu gửi/nhận, giá trị được phép và lỗi.
2. [Luồng FE và xác thực](frontend.md): tài liệu bàn giao có các cập nhật theo ngày; đối chiếu phiên bản hoặc commit trước khi áp dụng ví dụ cũ.
3. [Sandbox và kiểm chứng hồ sơ](sandbox.md): phân biệt tái dựng log, sửa điều kiện, thực thi lại, chuyển log và bằng chứng kiểm chứng.
4. [Quản trị workspace/tài khoản](workspace-admin.md): vai trò, phiên bản, gửi lại yêu cầu và tạo tài khoản.
5. [API examples](api-examples.md): ví dụ ghi nhận tại ngày 26/10/2026, không phải danh mục API hiện tại.

## Quy tắc tích hợp

- Gửi mã truy cập sau đăng nhập (access token). Máy chủ kiểm quyền nhóm làm việc và nguồn hiện tại; mã hợp lệ chưa có nghĩa được đọc mọi dữ liệu.
- Lấy mã định danh tài khoản (subject) và mã đối tượng từ phản hồi API. Không dùng tên đăng nhập hoặc mã UUID trong ví dụ để thay mã đối tượng thật.
- Gửi số phiên bản trong `expected_version`, khóa chống thực hiện trùng khi được yêu cầu và xử lý mã lỗi theo từng API.
- Lần dựng hành trình (run) đọc bộ log đã lưu cố định. Lần chạy lại mô phỏng (attempt) là một lần thực thi mới. Kiểm chứng (verification) đối chiếu bằng chứng nguồn sau đó.
- Điểm AI hỗ trợ người kiểm duyệt; không dùng điểm để bỏ qua điều kiện kiểm tra hoặc tự chọn nhánh khi dữ liệu còn mơ hồ.
- Kiểm tra [hiện trạng triển khai](../overview/status.md) trước khi coi mã trên máy cá nhân hoặc một bản bàn giao là đã chạy trên máy chủ.

## Lịch sử quyết định

Các kế hoạch tích hợp ban đầu, yêu cầu/phản hồi AI và checklist hoàn thiện FE được giữ ở [kho lưu trữ](../archive/README.md). Chúng giải thích quyết định theo thời điểm, không thay định nghĩa API hiện hành.
