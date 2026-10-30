# TraceWeaver AI scorer

Scorer Python có baseline, model bootstrap và model sandbox v2 opt-in, cùng pipeline sinh dữ liệu,
training/evaluation và bàn giao feature có thể tái tạo. Bắt đầu với [RUN.md](RUN.md),
[dữ liệu](START_HERE.md), [tích hợp BE](../backend/SCORER.md), [model card](artifacts/sandbox-v2/README.md),
[báo cáo thí nghiệm](REPORT.md) và [feature handoff](FEATURE_HANDOFF.md).
Mã nguồn dùng [Apache-2.0](../LICENSE); thư viện giữ license riêng trong
[dependency inventory](DEPENDENCIES.md) và [notices](THIRD_PARTY_NOTICES.txt).

## Cấu trúc thư mục

```text
ai/
  app/                         # Service scorer đang tích hợp
  artifacts/                   # Model và manifest có version
  features/                    # Feature extraction
  training/                    # Chuẩn bị dữ liệu và training
  scripts/                     # Công cụ AI
  tests/                       # Kiểm thử và fixture
  handoffs/
    AI_BE_RUNTIME_V2/          # Gói bàn giao gốc, được quản lý trong Git
```

Gói đầy đủ nằm tại [handoffs/AI_BE_RUNTIME_V2](handoffs/AI_BE_RUNTIME_V2/README.md). Các lần sửa runtime thực hiện ở `app/`, `features/`, `artifacts/` và `tests/`; giữ snapshot bàn giao nguyên vẹn để đối chiếu checksum.

BE-34 đã nhập loader và model thử nghiệm từ `AI_BE_RUNTIME_V2`, có checksum, 23 mẫu score và 42 feature fixture đối chiếu. Model chỉ chạy khi cấu hình tường minh; baseline vẫn được hỗ trợ. Xem [tích hợp BE](../backend/SCORER.md) và [nguồn gốc/giới hạn model](artifacts/sandbox-v2/README.md). [RUN](RUN.md) mô tả cách chạy baseline. Nội dung handoff/scaffold bên dưới là lịch sử trước BE-27.

## Hợp đồng và giới hạn

- `app/`: service entrypoint, cấu hình và HTTP adapter.
- `features/`: trích xuất đặc trưng từ observable events.
- `training/`: huấn luyện, chia tập và đánh giá.
- `tests/`: kiểm schema và scoring khi triển khai.

Input/output theo `../backend/contracts/openapi.json` và `../backend/contracts/schemas/domain.schema.json`.
Không ghi trực tiếp DB/workflow. Oracle không được đưa vào runtime hoặc feature.
Backend chịu trách nhiệm kiểm quyền nguồn và fallback khi scorer không khả dụng.

Đọc [AI handoff](../docs/archive/ai-backend-request.md) trước gán label/train: label1 là cạnh trực tiếp
có hướng. API giữ schema1/5 feature; BE giữ guard, quyền nguồn, ambiguity/unresolved và fallback/audit.
Model cần chọn tường minh qua `SCORER_MODEL_PATH`; thêm artifact bootstrap không tự thay model đang chọn.
Baseline bật bằng `SCORER_MODE=baseline` trong development/test. Score không phải xác suất đã hiệu chuẩn
và không tự xác nhận liên kết. Pipeline `sandbox-rules-1` và số đo bootstrap là thí nghiệm synthetic;
không dùng chúng để khẳng định chất lượng trên dữ liệu đại diện hoặc thay chính sách `sandbox-rules-2` của BE.
