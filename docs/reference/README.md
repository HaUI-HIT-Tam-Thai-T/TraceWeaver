# Tham chiếu kỹ thuật

[Mục lục tài liệu](../README.md)

Tài liệu kỹ thuật chi tiết nằm cạnh source của thành phần sở hữu. Mục này tập hợp các điểm vào để tra cứu, tránh duy trì nhiều bản contract khác nhau.

## Kiến trúc và core

| Chủ đề | Nguồn chính |
|---|---|
| Kiến trúc ba tầng và ranh giới thành phần | [ARCHITECTURE](../../ARCHITECTURE.md) |
| Backend và API | [Backend](../../backend/README.md) |
| Identity, membership và quyền nguồn | [Identity](../../backend/IDENTITY.md) |
| Workflow headless | [Workflow](../../backend/WORKFLOW.md) |
| Hồ sơ, chuyển bước và kiểm chứng | [Cases](../../backend/CASES.md) |

## Dữ liệu và API

| Chủ đề | Nguồn chính |
|---|---|
| Endpoint, schema, enum và giới hạn | [OpenAPI](../../backend/contracts/openapi.json), [Contract guide](../../backend/contracts/README.md) |
| Nhận log, chống trùng, provenance | [Ingestion](../../backend/INGESTION.md) |
| Tìm kiếm và chi tiết sự kiện | [Events](../../backend/EVENTS.md) |
| Tái dựng, guard và review liên kết | [Reconstruction](../../backend/RECONSTRUCTION.md) |
| Dashboard và tri thức | [Dashboard](../../backend/DASHBOARD.md) |
| Quản trị workspace/tài khoản | [Workspace admin](../../backend/WORKSPACE_ADMIN.md) |
| Sandbox, attempt, delivery và proof | [Lab sandbox](../../backend/LAB_SANDBOX.md) |

## Frontend, AI và simulator

| Thành phần | Tài liệu |
|---|---|
| Frontend React/Vite | [Frontend](../../frontend/README.md), [Tích hợp FE](../integration/README.md) |
| AI và hợp đồng scorer | [AI](../../ai/README.md), [Scorer](../../backend/SCORER.md) |
| Model v2, provenance và giới hạn đánh giá | [Model card](../../ai/artifacts/sandbox-v2/README.md) |
| Sinh dữ liệu và thực thi mô phỏng | [Simulator](../../simulator/README.md) |

## Kiểm thử và nguồn mở

- [Cách chạy kiểm thử và phạm vi bằng chứng](../../TESTING.md).
- [Ma trận tính năng → source → tests](../overview/features.md).
- [Giấy phép và dependency](../../LICENSES.md), [SBOM](../../sbom/README.md), [bảo mật](../../SECURITY.md).

Khi ví dụ bàn giao cũ khác contract, kiểm tra OpenAPI, source và [mốc triển khai](../overview/status.md) của môi trường đang dùng.
