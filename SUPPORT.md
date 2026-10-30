# Hỗ trợ TraceWeaver

Đọc [README](README.md), [INSTALL](INSTALL.md) và [mục lục tài liệu](docs/README.md) trước khi báo lỗi.
Mã nguồn đang phát triển; lịch sử triển khai và hạn chế nằm ở [CURRENT_STATUS](docs/CURRENT_STATUS.md).

## Chọn kênh

- Lỗi có thể tái hiện: [bug report](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues/new?template=bug_report.md).
- Ý tưởng hoặc nhu cầu mới: [feature request](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues/new?template=feature_request.md).
- Câu hỏi cài đặt/tích hợp: [Issues](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues), ghi rõ thành phần liên quan.
- Lỗ hổng hoặc dữ liệu nhạy cảm: [SECURITY.md](SECURITY.md); không gửi credential trong issue.

## Thông tin cần có

Ghi commit/tag, OS, Node/npm/Python, trình duyệt nếu liên quan, các bước tái hiện, kết quả mong đợi/thực tế và lệnh đã thử.
Với API, thêm status, error code và request ID đã kiểm tra an toàn. Dùng dữ liệu giả; xóa token, mật khẩu và thông tin cá nhân khỏi ảnh/log.

## Lỗi thường gặp

| Dấu hiệu | Hướng kiểm tra |
|---|---|
| PowerShell chặn npm.ps1 | Dùng `npm.cmd` |
| DB không kết nối / ready 503 | Kiểm PostgreSQL, port trong env và chạy migrations; xem [Docker](backend/DOCKER.md) |
| Login hoặc callback lỗi | Kiểm issuer, client, redirect URI và exact origin; xem [Keycloak](backend/KEYCLOAK.md) |
| Frontend không gọi được API | API base phải là HTTPS origin, không kèm /api/v1; kiểm CORS localhost:5173 và env FE |
| Không đọc được run/case | Kiểm membership và quyền hiện tại cho mọi nguồn trong snapshot |
| Hybrid degraded | Kiểm cấu hình và readiness scorer; xem [SCORER](backend/SCORER.md) |
| License inventory stale | Cài đúng lockfile/pins rồi chạy generator tương ứng tại [LICENSES](LICENSES.md) |
| Port FE 5173 đã dùng | Dừng tiến trình liên quan hoặc cấu hình lại đồng bộ origin/callback; Vite dùng strictPort |

Repo chưa công bố SLA hỗ trợ; việc phản hồi phụ thuộc maintainer.
