# AI scorer

Đã có 24 cặp synthetic, kiểm tra nhãn, baseline theo luật và API nội bộ chạy độc
lập. Chưa có model được huấn luyện hoặc tích hợp reconstruction ở backend.
Hướng dẫn nhanh: [RUN.md](RUN.md). Duyệt dữ liệu: [START_HERE.md](START_HERE.md).

- `app/`: config, schema validation, baseline, HTTP adapter và entrypoint.
- `features/`: trích xuất đặc trưng từ observable events.
- `training/`: tạo ví dụ và kiểm nhãn đã duyệt; chưa có pipeline huấn luyện.
- `tests/`: schema, nhãn null/0/1, scoring và HTTP thật trên loopback.
- `scripts/`: smoke demo và dependency/license inventory Python.

Input/output theo `../backend/contracts/openapi.json` và `../backend/contracts/schemas/domain.schema.json`.
Không ghi trực tiếp DB/workflow. Oracle không được đưa vào runtime hoặc feature.
Backend chịu trách nhiệm kiểm quyền nguồn và fallback khi scorer không khả dụng.

Baseline chỉ bật rõ qua `SCORER_MODE=baseline` trong development/test, trả
`model_version=baseline-rule-v1` và header `X-Scorer-Method: rule`. Chế độ mặc định
`model` trả 503 cho đến khi có model khả dụng; không tự thay thế bằng baseline.
Điểm baseline không phải xác suất và không tự ghi nhãn/accept/reject liên kết.

Code mới dùng Apache-2.0; thư viện Python giữ license riêng. Xem
[DEPENDENCIES.md](DEPENDENCIES.md) và [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).
