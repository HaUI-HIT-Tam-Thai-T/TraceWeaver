# Dịch vụ chấm điểm AI của TraceWeaver

Dịch vụ Python chấm điểm các cặp bản ghi có thể liên quan. Có chế độ dùng quy tắc cơ bản (baseline), mô hình khởi tạo thử nghiệm (bootstrap) và mô hình sandbox v2 chỉ dùng khi bật cấu hình. Các bước sinh dữ liệu, huấn luyện, đánh giá và bàn giao đặc trưng đầu vào đều có cách chạy lại để đối chiếu.

Để chạy thử, làm theo [hướng dẫn chạy AI](RUN.md). Khi cần tạo dữ liệu hoặc huấn luyện, đọc [điểm bắt đầu với dữ liệu](START_HERE.md). [Hướng dẫn kết nối máy chủ](../backend/SCORER.md), [nguồn gốc và giới hạn mô hình](artifacts/sandbox-v2/README.md), [báo cáo thí nghiệm](REPORT.md) và [đặc trưng bàn giao](FEATURE_HANDOFF.md) cung cấp chi tiết cho từng công việc.
Mã nguồn dùng [Apache-2.0](../LICENSE); thư viện giữ giấy phép riêng trong
[danh sách thư viện](DEPENDENCIES.md) và [thông báo bản quyền](THIRD_PARTY_NOTICES.txt).

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

Gói đầy đủ nằm tại [handoffs/AI_BE_RUNTIME_V2](handoffs/AI_BE_RUNTIME_V2/README.md). Khi sửa chương trình đang tích hợp, dùng `app/`, `features/`, `artifacts/` và `tests/`; giữ bản bàn giao nguyên vẹn để đối chiếu mã băm kiểm tra nội dung.

BE-34 đã nhập bộ nạp và mô hình thử nghiệm từ `AI_BE_RUNTIME_V2`, có mã băm, 23 mẫu điểm và 42 mẫu đặc trưng để đối chiếu. Mô hình chỉ chạy khi được chọn rõ trong cấu hình; chế độ quy tắc cơ bản vẫn dùng được. Xem [kết nối máy chủ](../backend/SCORER.md) và [nguồn gốc và giới hạn mô hình](artifacts/sandbox-v2/README.md). [RUN](RUN.md) mô tả cách chạy chế độ quy tắc cơ bản. Các ghi chú bàn giao/khung ban đầu thuộc lịch sử trước BE-27.

## Dữ liệu trao đổi và giới hạn

- `app/`: điểm khởi chạy dịch vụ, cấu hình và lớp nhận/trả dữ liệu qua HTTP.
- `features/`: tính đặc trưng đầu vào từ các bản ghi hệ thống được phép quan sát.
- `training/`: huấn luyện, chia tập và đánh giá.
- `tests/`: kiểm cấu trúc dữ liệu và kết quả chấm điểm.

Cấu trúc dữ liệu gửi vào và trả về được quy định tại `../backend/contracts/openapi.json` và `../backend/contracts/schemas/domain.schema.json`.
AI không ghi trực tiếp cơ sở dữ liệu hoặc chuyển bước hồ sơ. Đáp án đánh giá (oracle) không được đưa vào chương trình đang chạy hoặc dùng làm đặc trưng đầu vào.
Máy chủ kiểm quyền đọc nguồn; khi AI không dùng được, máy chủ chuyển về quy tắc.

Đọc [AI handoff](../docs/archive/ai-backend-request.md) trước khi gán nhãn hoặc huấn luyện: nhãn 1 biểu thị liên kết trực tiếp
có hướng. API giữ cấu trúc dữ liệu phiên bản 1 với 5 đặc trưng đầu vào; máy chủ giữ kiểm điều kiện, quyền nguồn, trạng thái chưa xác định khi còn mơ hồ, cách chuyển về quy tắc và lịch sử thao tác.
Cần chọn rõ mô hình qua `SCORER_MODEL_PATH`; thêm file mô hình khởi tạo thử nghiệm không tự thay mô hình đang chọn.
Chế độ quy tắc cơ bản được bật bằng `SCORER_MODE=baseline` khi phát triển hoặc kiểm thử. Điểm trả về không phải xác suất đã được kiểm hiệu chuẩn
và không tự xác nhận liên kết. Các bước xử lý theo `sandbox-rules-1` và số đo mô hình khởi tạo thử nghiệm là thí nghiệm trên dữ liệu tự sinh;
không dùng chúng để khẳng định chất lượng trên dữ liệu đại diện hoặc thay chính sách `sandbox-rules-2` của máy chủ.
