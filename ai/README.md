# AI integration — 28/10/2026

Runtime baseline đã được nhập từ nhánh `origin/xkhuong/feat/ai-scorer`. Xem [RUN](RUN.md) để chạy Python service và [tích hợp BE](../backend/SCORER.md). Đây là heuristic baseline, chưa có model học máy. Nội dung handoff/scaffold bên dưới là lịch sử trước BE-27.

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
