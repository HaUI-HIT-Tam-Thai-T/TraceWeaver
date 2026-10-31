# Tham chiếu kỹ thuật

[Mục lục tài liệu](../README.md)

Tài liệu kỹ thuật chi tiết nằm cạnh mã nguồn của thành phần sở hữu. Mục này tập hợp các điểm vào để tra cứu, để các thành phần cùng tra cứu một định nghĩa API.

## Kiến trúc và core

| Chủ đề | Nguồn chính |
|---|---|
| Kiến trúc ba tầng và ranh giới thành phần | [ARCHITECTURE](../../ARCHITECTURE.md) |
| Backend và API | [Backend](../../backend/README.md) |
| Đăng nhập, thành viên nhóm làm việc và quyền đọc nguồn | [Identity](../../backend/IDENTITY.md) |
| Quy trình xử lý dùng chung, không phụ thuộc giao diện | [Workflow](../../backend/WORKFLOW.md) |
| Hồ sơ, chuyển bước và kiểm chứng | [Cases](../../backend/CASES.md) |

## Dữ liệu và API

| Chủ đề | Nguồn chính |
|---|---|
| Địa chỉ API, cấu trúc dữ liệu, giá trị được phép và giới hạn | [OpenAPI](../../backend/contracts/openapi.json), [Contract guide](../../backend/contracts/README.md) |
| Nhận log, chống trùng và lưu thông tin nguồn phát sinh | [Ingestion](../../backend/INGESTION.md) |
| Tìm kiếm và chi tiết sự kiện | [Events](../../backend/EVENTS.md) |
| Dựng hành trình, kiểm điều kiện và duyệt liên kết | [Reconstruction](../../backend/RECONSTRUCTION.md) |
| Thống kê và tri thức | [Dashboard](../../backend/DASHBOARD.md) |
| Quản trị nhóm làm việc và tài khoản | [Workspace admin](../../backend/WORKSPACE_ADMIN.md) |
| Mô phỏng, lần chạy lại, chuyển log và bằng chứng kiểm chứng | [Lab sandbox](../../backend/LAB_SANDBOX.md) |

## Frontend, AI và simulator

| Thành phần | Tài liệu |
|---|---|
| Frontend React/Vite | [Frontend](../../frontend/README.md), [Tích hợp FE](../integration/README.md) |
| AI và quy định dữ liệu gửi tới dịch vụ chấm điểm | [AI](../../ai/README.md), [Scorer](../../backend/SCORER.md) |
| Mô hình v2, nguồn gốc và giới hạn đánh giá | [Model card](../../ai/artifacts/sandbox-v2/README.md) |
| Sinh dữ liệu và thực thi mô phỏng | [Simulator](../../simulator/README.md) |

## Kiểm thử và nguồn mở

- [Cách chạy kiểm thử và phạm vi bằng chứng](../../TESTING.md).
- [Đối chiếu tính năng, mã nguồn và bài kiểm tra](../overview/features.md).
- [Giấy phép và thư viện sử dụng](../../LICENSES.md), [SBOM](../../sbom/README.md), [bảo mật](../../SECURITY.md).

Khi ví dụ bàn giao cũ khác định nghĩa API hiện tại, kiểm tra OpenAPI, mã nguồn và [mốc triển khai](../overview/status.md) của môi trường đang dùng.
