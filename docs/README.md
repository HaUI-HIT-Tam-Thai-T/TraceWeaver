# Tài liệu TraceWeaver

Điểm bắt đầu công khai: [Giới thiệu tiếng Việt](../README.md) · [English](../README_EN.md) · [Cài đặt](../INSTALL.md) · [Kiến trúc](../ARCHITECTURE.md) · [Kiểm thử](../TESTING.md) · [Giấy phép](../LICENSES.md) · [Hỗ trợ](../SUPPORT.md).

Quy trình cộng đồng: [Đóng góp](../CONTRIBUTING.md), [Quy tắc ứng xử](../CODE_OF_CONDUCT.md), [Bảo mật](../SECURITY.md).

## Chọn điểm bắt đầu

| Bạn muốn | Đọc trước |
|---|---|
| Hiểu sản phẩm và thử một hành trình | [Khám phá/demo](DEMO.md) |
| Đối chiếu tính năng, tests và điều kiện demo | [Tính năng và bằng chứng](FEATURE_STATUS.md) |
| Dựng môi trường của mình | [INSTALL](../INSTALL.md) |
| Tích hợp API hoặc mở rộng core | [Contracts](../backend/contracts/README.md), [Architecture](../ARCHITECTURE.md) |
| Kiểm license hoặc chuẩn bị phân phối | [LICENSES](../LICENSES.md), [SBOM](../sbom/README.md), [Đóng gói/phát hành](RELEASING.md) |

Các bàn giao theo mốc bên dưới phục vụ tích hợp; khi hướng dẫn cũ khác source mới, đối chiếu contract và revision ở CURRENT_STATUS.

**Handoff sau audit30/10:** [Hoàn thiện FE](FE_COMPLETION_HANDOFF.md) — phân biệt tái dựng với chạy lại
nghiệp vụ, tích hợp simulator/proof, phục hồi lỗi account và UAT UX. Không mở rộng phần tìm/hiển thị tài khoản.

Bàn giao quản trị: [FE — workspace và tài khoản](FE_WORKSPACE_ADMIN_HANDOFF.md) — sidebar, API,
version, retry/pending, đăng nhập lần đầu và UAT. BE đã deploy 30/10/2026; FE chưa tích hợp.
Chi tiết vận hành: [Workspace-admin BE](../backend/WORKSPACE_ADMIN.md).

Bàn giao mới cho FE: [Simulator và kiểm chứng hồ sơ](FE_SANDBOX_HANDOFF.md) — API đã triển khai,
quyền, request/response, version/retry, trạng thái log/proof và checklist UAT.
Contract sandbox dùng ngay nằm ở mục0; mục2 đã cập nhật request/case IDs sau khi thay dữ liệu server30/10.

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
