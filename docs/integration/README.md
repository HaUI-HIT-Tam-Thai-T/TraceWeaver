# Tích hợp frontend, backend và AI

[Mục lục tài liệu](../README.md) · [Tham chiếu kỹ thuật](../reference/README.md)

## Cấu hình kết nối

| Thành phần | Địa chỉ / cấu hình |
|---|---|
| Web production | `https://traceweaver.quizlearn.tech` |
| API và Swagger | `https://api.quizlearn.tech`, [Swagger](https://api.quizlearn.tech/docs/) |
| Keycloak issuer | `https://api.quizlearn.tech/identity/realms/traceweaver` |
| Public client của web | `traceweaver-web`, Authorization Code + PKCE S256 |
| Callback production | `https://traceweaver.quizlearn.tech/auth/callback` |
| FE development | `http://localhost:5173`; cấu hình theo [Frontend](../../frontend/README.md) |
| Scorer | Dịch vụ nội bộ do backend gọi qua TLS; không gọi trực tiếp từ browser |

Frontend dùng API base là HTTPS origin, không thêm `/api/v1` vào biến cấu hình. Secret của ingestion, core app và account provider chỉ ở server.

## Thứ tự đọc

1. [OpenAPI và JSON Schema](../../backend/contracts/README.md): nguồn chính cho endpoint, DTO, enum và lỗi.
2. [Luồng FE và xác thực](frontend.md): tài liệu bàn giao có các cập nhật theo ngày; đối chiếu revision trước khi áp dụng ví dụ cũ.
3. [Sandbox và kiểm chứng hồ sơ](sandbox.md): phân biệt tái dựng log, sửa điều kiện, thực thi lại, delivery và proof.
4. [Quản trị workspace/tài khoản](workspace-admin.md): role, version, retry và account provisioning.
5. [API examples](api-examples.md): ví dụ snapshot ngày 26/10/2026, không phải danh mục API hiện tại.

## Quy tắc tích hợp

- Gửi access token; backend kiểm quyền workspace và nguồn hiện tại. Token hợp lệ chưa đủ quyền đọc dữ liệu.
- Lấy subject/IDs từ response, không dùng username hoặc UUID trong tài liệu làm resource ID thật.
- Tuân thủ `expected_version`, idempotency và error code của từng operation.
- Run đọc snapshot log; attempt là lần thực thi mới; verification là bước đối chiếu bằng chứng nguồn.
- Điểm AI hỗ trợ review; không dùng điểm để bỏ qua guard hoặc tự giải quyết trường hợp mơ hồ.
- Kiểm tra [hiện trạng triển khai](../overview/status.md) trước khi coi source local hoặc một bản bàn giao là đã live.

## Lịch sử quyết định

Các kế hoạch tích hợp ban đầu, yêu cầu/phản hồi AI và checklist hoàn thiện FE được giữ ở [kho lưu trữ](../archive/README.md). Chúng giải thích quyết định theo thời điểm, không thay contract hiện hành.
