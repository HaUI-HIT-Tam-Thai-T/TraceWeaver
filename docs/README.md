# Tài liệu TraceWeaver

Tài liệu được chia theo tổng quan, vận hành và thành phần kỹ thuật. Chỉ các chức năng trong [hiện trạng](CURRENT_STATUS.md) được xem là đã triển khai.

| Chủ đề | Tài liệu |
|---|---|
| Tổng quan, kiến trúc ba tầng, công nghệ | [README](../README.md) |
| Cài từ source, cấu hình và kiểm thử | [INSTALL](../INSTALL.md) |
| Docker, local Identity và demo login | [Docker](../backend/DOCKER.md), [Keycloak](../backend/KEYCLOAK.md) |
| Backend/API | [Backend](../backend/README.md), [OpenAPI và schemas](../backend/contracts/README.md) |
| Bàn giao React/Vite | [Luồng và tích hợp FE](FRONTEND_HANDOFF.md), [API reference chi tiết](FRONTEND_API_REFERENCE.md) |
| Xác thực và quyền dữ liệu | [Identity](../backend/IDENTITY.md) |
| Dữ liệu đầu vào và truy vấn | [Ingestion](../backend/INGESTION.md), [Events](../backend/EVENTS.md) |
| Tái dựng và duyệt liên kết | [Reconstruction](../backend/RECONSTRUCTION.md) |
| AI scorer, model opt-in và cách test | [Scorer](../backend/SCORER.md), [Model và provenance](../ai/artifacts/sandbox-v2/README.md) |
| Quy trình và thống kê | [Cases](../backend/CASES.md), [Core workflow](../backend/WORKFLOW.md), [Dashboard](../backend/DASHBOARD.md) |
| Tích hợp FE/AI/simulator | [Integration](INTEGRATION.md), [AI handoff](BACKEND_HANDOFF.md), [Backend response](BACKEND_HANDOFF_RESPONSE.md) |
| Đóng góp, license, bảo mật | [Contributing](../CONTRIBUTING.md), [Dependency inventory](../backend/DEPENDENCIES.md), [Notices](../backend/THIRD_PARTY_NOTICES.txt), [Security](../SECURITY.md) |
| Thay đổi và báo lỗi | [Changelog](../CHANGELOG.md), [Issues](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues) |

OpenAPI/JSON Schema là hợp đồng chung; không tạo DTO riêng khác schema. Checklist chuẩn bị thi và báo cáo kiểm chứng local không thuộc tài liệu sử dụng công khai. Backend đã tích hợp scorer baseline/model v2 opt-in; kết quả và giới hạn cập nhật ở [CURRENT_STATUS](CURRENT_STATUS.md). Tag v0.1.0-base.1 là bản scaffold.

## Quy ước thư mục

- `docs/`: tài liệu dùng chung và bàn giao giữa các thành phần.
- `backend/*.md`, `ai/*.md`, `frontend/README.md`: hướng dẫn gắn với source của từng thành phần.
- `.planning/`: kế hoạch, quyết định và trạng thái làm việc local.
- `ai/handoffs/`: gói bàn giao AI được quản lý trong Git, giữ nguyên nội dung/checksum.
- `.local/reports/`: kết quả kiểm tra và bản ghi thao tác local.
- `.local/scripts/`: script vận hành/demo dùng riêng trên máy.
- `.local/releases/`: bản nháp PR và release.
- `.local/ai-test/`: phiên test AI đang chạy, payload, log và báo cáo của phiên.

Runtime AI, Keycloak và cache giữ nguyên ở `.local/ai-venv/`, `.local/keycloak/` và `.local/npm-cache/`. Không đưa secret, môi trường Python hoặc cache vào Git.
