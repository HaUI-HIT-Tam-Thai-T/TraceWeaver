# Kiểm thử TraceWeaver

Chạy các lệnh từ thư mục gốc dự án, trừ khi có ghi khác. Dùng Node.js 24.14.1/npm 11.11.0 và cài thư viện cho máy chủ, giao diện theo file khóa phiên bản của từng phần.
Các lệnh dưới đây mô tả cách kiểm; kết quả lịch sử nằm ở [CURRENT_STATUS](docs/overview/status.md), không thay thế kết quả kiểm tra trên phiên bản mới.

| Phạm vi | Lệnh | Điều kiện / bằng chứng |
|---|---|---|
| Cấu trúc dự án, khai báo giấy phép và thư viện | `npm run check:base` | Cần thư viện tại thư mục gốc. Công cụ phát hiện tên file bí mật bị theo dõi trong Git, chưa quét nội dung để tìm mật khẩu |
| Giấy phép thư viện máy chủ | `npm run licenses:check` | Thư viện máy chủ phải khớp file khóa phiên bản |
| Giấy phép thư viện giao diện | `npm run licenses:frontend:check` | Thư viện giao diện phải khớp file khóa phiên bản; phạm vi gói tùy chọn tại [LICENSES](LICENSES.md) |
| Danh mục thành phần phần mềm (SBOM) của npm | `npm run sbom:check` | npm 11.11.0, đọc file khóa phiên bản, không cần mạng; [phạm vi từng SBOM](sbom/README.md) |
| Logic máy chủ, phản hồi HTTP và định nghĩa API | `npm test` | Không cần PostgreSQL; một số kiểm tra có thể bị bỏ qua nếu thiếu Python tùy chọn |
| Chỉ kiểm định nghĩa API | `npm run test:contracts` | OpenAPI, cấu trúc JSON và dữ liệu mẫu kiểm thử |
| Bộ mô phỏng | `npm run test:sim` | Logic lưu trạng thái mô phỏng, sinh và gửi log; chưa thay việc thử thao tác trên máy chủ thật |
| Giao diện web | `npm --prefix frontend test` | Kiểm bằng Node; chưa chứng minh toàn bộ luồng đăng nhập thật trên trình duyệt hoạt động |
| Kiểm lỗi mã và đóng gói web | `npm --prefix frontend run lint`, `npm --prefix frontend run build` | Đóng gói web cần cấu hình VITE hợp lệ, tạo `frontend/dist/` |
| Kiểm với PostgreSQL thật | `npm run test:db` | Cơ sở dữ liệu thật và quyền CREATEDB để tạo cơ sở dữ liệu kiểm thử riêng; không tự xóa sau khi chạy |
| Đăng nhập và quyền qua API | `npm run test:identity:native` | PostgreSQL; dùng máy chủ giả cung cấp khóa kiểm mã đăng nhập (JWKS), không dùng Keycloak thật |
| Kiểm đăng nhập qua Postman | `npm run test:identity` | PostgreSQL + Postman CLI >=1.74.0 |
| Thử nhanh máy chủ | `npm run smoke` | Cơ sở dữ liệu đã cập nhật bảng; máy chủ kiểm tra tạm chỉ nhận kết nối từ chính máy đang chạy, cổng mặc định 18080 |
| AI | `python -m unittest discover -s ai/tests` | Dùng Python trong môi trường riêng đã cài đúng thư viện yêu cầu |
| Giấy phép AI | `python -m ai.scripts.dependency_inventory --check` | Môi trường Python riêng khớp đúng danh sách phiên bản thư viện |
| Thử nhanh AI dùng quy tắc qua HTTP | `python -m ai.scripts.smoke` | Môi trường Python riêng; chạy dịch vụ chấm điểm tạm trên chính máy rồi tự dừng |

PowerShell có thể dùng `npm.cmd`; phải dùng chương trình Python bên trong môi trường riêng, xem [AI RUN](ai/RUN.md).
CI [ci.yml](.github/workflows/ci.yml) quy định các bước kiểm tự động; xem kết quả theo đúng commit tại [Actions](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/actions).

## Chọn kiểm tra theo thay đổi

- Tài liệu/giấy phép: kiểm liên kết file, danh mục thư viện và cấu trúc dự án; không cần chạy các dịch vụ.
- Nghiệp vụ/kiểm dữ liệu đầu vào: kiểm logic và định nghĩa API. Thay giao dịch dữ liệu, quyền hoặc script cập nhật bảng cần kiểm thêm với cơ sở dữ liệu và xác thực.
- Giao diện: chạy kiểm thử và kiểm lỗi mã web. Thay cấu hình đóng gói cần tạo bản web rồi kiểm trên trình duyệt.
- AI: kiểm Python, đối chiếu kết quả với dữ liệu mẫu và kiểm gọi dịch vụ qua HTTP. Độ chính xác của mô hình cần đánh giá riêng.

## Thử toàn bộ luồng trên ứng dụng

1. Đăng nhập operator/viewer/reviewer/admin bằng Keycloak; thử hủy đăng nhập, làm mới phiên, đăng xuất và thu hồi quyền.
2. Tìm bản ghi, xem nguồn phát sinh; kiểm tài khoản thiếu quyền nguồn không đọc được bản ghi, hành trình hoặc hồ sơ cũ.
3. Dựng hành trình, xem sơ đồ, duyệt liên kết và thử sửa với số phiên bản cũ để kiểm tránh ghi đè.
4. Tạo hồ sơ mô phỏng, sửa đúng điều kiện rồi chạy lại. Xem riêng kết quả thực thi, kết quả chuyển log và bằng chứng kiểm chứng.
5. Kiểm người duyệt chỉ đóng hồ sơ khi có bằng chứng đạt còn phù hợp với yêu cầu hiện tại; tài khoản chỉ đọc phải bị từ chối khi sửa dữ liệu.

Chi tiết: [FE sandbox handoff](docs/integration/sandbox.md), [workspace admin](docs/integration/workspace-admin.md),
[completion handoff](docs/archive/frontend-completion.md).
Ghi mã phiên bản hoặc commit, môi trường, lệnh đã chạy, kiểm tra đạt/lỗi/bị bỏ qua và giới hạn. Xóa mã đăng nhập, mật khẩu và dữ liệu riêng khỏi bằng chứng công khai.

[Bảng tính năng và bằng chứng](docs/overview/features.md) dẫn từng tính năng tới bộ test và cách demo; [DEMO](docs/guides/demo.md) trình bày một hành trình kiểm chứng hoàn chỉnh.

Model [sandbox v2](ai/artifacts/sandbox-v2/README.md) dùng dữ liệu tự sinh và chưa đạt mục tiêu về tỷ lệ liên kết dự đoán đúng trong số liên kết mô hình dự đoán (precision) của dự án.
Toàn bộ luồng trên trình duyệt, hiệu năng, sao lưu/khôi phục và bảo mật các image đóng gói dịch vụ cần kiểm riêng. Kiểm logic và định nghĩa API đạt chưa chứng minh các phần này đạt.
