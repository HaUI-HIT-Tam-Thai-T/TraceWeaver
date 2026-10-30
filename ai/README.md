# TraceWeaver AI scorer

Scorer Python hiện có baseline và model sandbox v2 opt-in. Bắt đầu với [RUN.md](RUN.md), [tích hợp BE](../backend/SCORER.md), [model card](artifacts/sandbox-v2/README.md), [dependency inventory](DEPENDENCIES.md) và [notices](THIRD_PARTY_NOTICES.txt). Mã nguồn dùng [Apache-2.0](../LICENSE). Các ghi chú scaffold bên dưới được giữ làm lịch sử; không mô tả mức triển khai hiện tại.

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

# AI scorer

Khung dịch vụ chấm điểm cặp sự kiện; chưa có runtime, model hoặc endpoint.

- `app/`: service entrypoint, cấu hình và HTTP adapter.
- `features/`: trích xuất đặc trưng từ observable events.
- `training/`: huấn luyện, chia tập và đánh giá.
- `tests/`: kiểm schema và scoring khi triển khai.

Input/output theo `../backend/contracts/openapi.json` và `../backend/contracts/schemas/domain.schema.json`.
Không ghi trực tiếp DB/workflow. Oracle không được đưa vào runtime hoặc feature.
Backend chịu trách nhiệm kiểm quyền nguồn và fallback khi scorer không khả dụng.

Đọc [AI handoff](../docs/BACKEND_HANDOFF.md) và [backend response ngày28/10](../docs/BACKEND_HANDOFF_RESPONSE.md#phản-hồi-ai_be_confirmation--28102026) trước gán label/train: label1 là cạnh trực tiếp có hướng; action/ID namespaces dùng cùng policy. Phía BE chọn schema1/5 feature, shared_id_count đếm mọi namespace, strong-ID/unresolved ở BE và AI chỉ xếp hạng/đề xuất. Unknown/mâu thuẫn outcome phải review theo hướng MVP; outcome guard/lưu reason/alias mapper/extractor BE chưa triển khai. Runtime AI được mô tả ở handoff chưa có source tại checkout này; fixture/text_similarity/policy version và model thresholds còn cần đồng bộ, không coi phản hồi tài liệu là bằng chứng runtime/model đã tuân thủ.
