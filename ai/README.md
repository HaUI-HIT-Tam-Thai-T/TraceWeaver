# AI scorer

Đã có API nội bộ chạy độc lập, baseline bootstrap, model JSON đã train có kiểm
checksum/cấu trúc, và pipeline đánh giá offline theo `sandbox-rules-1`. Model đang
serve vẫn là bootstrap cũ; thí nghiệm feature v2 chưa được promote vào API hoặc
tích hợp reconstruction của backend.

Hướng dẫn: [RUN.md](RUN.md). Dữ liệu: [START_HERE.md](START_HERE.md).
Kết quả và giới hạn: [REPORT.md](REPORT.md). Feature bàn giao BE:
[FEATURE_HANDOFF.md](FEATURE_HANDOFF.md).

- `app/`: config, schema validation, baseline, model loader và API FastAPI.
- `features/`: bootstrap extractor, policy reference v2 và golden fixtures.
- `training/`: review labels, generator, Logistic Regression và đánh giá offline.
- `artifacts/`: model/manifest bootstrap nhỏ, giữ LF để SHA-256 ổn định khi checkout.
- `tests/`: contract, null/0/1, model integrity, policy và feature handoff.
- `scripts/`: hai smoke, benchmark p95, export/check bundle và license inventory.

Input/output theo `../backend/contracts/openapi.json` và `../backend/contracts/schemas/domain.schema.json`.
Không ghi trực tiếp DB/workflow. Oracle không được đưa vào runtime hoặc feature.
Backend chịu trách nhiệm tính feature runtime, giữ guard/unresolved, quyết định
đề xuất pending và fallback/audit khi scorer không khả dụng. Chưa có adapter BE
mới trong checkout hiện tại. Dataset, report JSON sinh ra, ZIP và kế hoạch cá nhân
giữ trong `.local`, có thể tái tạo bằng các lệnh trong RUN.md.

Baseline chỉ bật rõ qua `SCORER_MODE=baseline` trong development/test, trả
`model_version=baseline-rule-v1` và header `X-Scorer-Method: rule`. Chế độ mặc định
`model` nạp artifact khi cấu hình hợp lệ; artifact thiếu/hỏng hoặc sai cấu trúc
khiến readiness/scoring trả 503, không tự thay thế bằng baseline. Score chưa được
coi là xác suất hiệu chuẩn và không tự ghi nhãn/accept/reject liên kết.

Code mới dùng Apache-2.0; thư viện Python giữ license riêng. Xem
[DEPENDENCIES.md](DEPENDENCIES.md) và [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).
