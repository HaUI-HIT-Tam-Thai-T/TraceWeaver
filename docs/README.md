# Tài liệu dùng chung của team TraceWeaver

Cập nhật đối chiếu: 19/10/2026. Đọc từ đây sau khi clone; các file trong mục lục được Git track. `.local/` và `.planning/` là tài liệu chuẩn bị local, không phải tài liệu mà thành viên khác tự nhận được khi clone.

| Đọc theo thứ tự | Dùng để làm gì |
|---|---|
| [01 — Đối chiếu đề thi](01-DOI-CHIEU-DE-THI.md) | Yêu cầu bắt buộc/khuyến nghị, hiện trạng và phần còn thiếu; nguồn đề, trang/mục và rubric |
| [02 — Tích hợp BE/FE/AI](02-TICH-HOP-BE-FE-AI.md) | Phần mỗi người cần làm, API đã có/planned, hợp đồng bàn giao và thứ tự tích hợp |
| [03 — Dữ liệu, kiểm thử, minh chứng](03-DU-LIEU-KIEM-THU-MINH-CHUNG.md) | Dữ liệu demo/evaluation, test matrix và cách lưu bằng chứng thật |
| [04 — Demo và hồ sơ nộp](04-DEMO-VA-HO-SO-NOP.md) | Checklist source/release/install/report/slide, kịch bản 10 phút và cổng nghiệm thu |
| [Hướng dẫn license](HUONG-DAN-LICENSE-CHO-TEAM.md) | Các lệnh kiểm/cập nhật license và giới hạn npm/FE/AI/container |

Lệnh chạy hiện có ở [INSTALL](../INSTALL.md), [backend README](../backend/README.md) và [Identity BE](../backend/IDENTITY.md). Contract authoritative ở [backend/contracts](../backend/contracts/README.md); không định nghĩa DTO riêng khác schema khi làm FE/AI.

## Hiện trạng để tránh hiểu nhầm

BE có PostgreSQL/migrations, JWT/JWKS enforcement và ba API đọc me/sources/knowledge. 17 test thường và 15 test identity đã pass local; Identity dùng Postman JWKS stand-in, không phải Keycloak thật. Frontend/AI/simulator còn là khung. Workflow, ingestion/reconstruction/review/case/dashboard chưa chạy đầu-cuối. Tag v0.1.0-base.1 là bộ khung trước các thay đổi BE mới, không phải release nghiệm thu toàn sản phẩm.

Các bảng trong docs là checklist làm việc, không phải điểm số hoặc xác nhận BTC đã nghiệm thu. Yêu cầu vòng HaUI và thể lệ Quốc gia được ghi tách riêng; deadline lịch thực tế cần đội xác nhận.
