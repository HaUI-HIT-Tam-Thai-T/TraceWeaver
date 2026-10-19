# AI scorer

Khung dịch vụ chấm điểm cặp sự kiện; chưa có runtime, model hoặc endpoint.

- `app/`: service entrypoint, cấu hình và HTTP adapter.
- `features/`: trích xuất đặc trưng từ observable events.
- `training/`: huấn luyện, chia tập và đánh giá.
- `tests/`: kiểm schema và scoring khi triển khai.

Input/output theo `../backend/contracts/openapi.json` và `../backend/contracts/schemas/domain.schema.json`.
Không ghi trực tiếp DB/workflow. Oracle không được đưa vào runtime hoặc feature.
Backend chịu trách nhiệm kiểm quyền nguồn và fallback khi scorer không khả dụng.
