# Tính năng và bằng chứng

Bảng này dẫn từ tính năng tới source, bộ test và hướng dẫn demo. **Có test trong repo không có nghĩa test đã chạy đạt ở revision hiện tại.**
Kết quả theo mốc triển khai nằm ở [CURRENT_STATUS](status.md); kết quả mới phải ghi commit, môi trường, pass/fail/skip.
Core có entry point headless và adapter case riêng; kết quả kiểm thử nằm ở [hiện trạng](status.md).

| Tính năng | Source / hướng dẫn | Kiểm tra tương ứng | Cách quan sát |
|---|---|---|---|
| SSO và quyền workspace/nguồn | [Identity](../../backend/IDENTITY.md), [FE auth](../../frontend/README.md) | [HTTP security](../../backend/tests/backend/http-security.test.js), [identity tests](../../backend/tests/identity), [FE session](../../frontend/tests/auth-session.test.mjs) | Đăng nhập theo [Keycloak guide](../../backend/KEYCLOAK.md); thử cả tài khoản thiếu quyền |
| Batch ingestion, chống trùng và provenance | [Ingestion](../../backend/INGESTION.md) | [BE ingestion](../../backend/tests/backend/ingestion.test.js), [DB ingestion](../../backend/tests/integration/ingestion.test.js) | Dataset simulator có duplicate/conflict; không ghi đè sự kiện gốc |
| Tra cứu sự kiện | [Events](../../backend/EVENTS.md) | [BE events](../../backend/tests/backend/events.test.js), [FE events](../../frontend/tests/events-controller.test.mjs) | Lọc theo source/thời gian, xem provenance |
| Run, snapshot, đồ thị và unresolved | [Reconstruction](../../backend/RECONSTRUCTION.md) | [Rules](../../backend/tests/backend/reconstruction.test.js), [DB runs](../../backend/tests/integration/runs.test.js) | [Demo](../guides/demo.md): thiếu ID, retry, hai nhánh mơ hồ |
| Review và thêm liên kết | [Reconstruction](../../backend/RECONSTRUCTION.md) | [Reviews](../../backend/tests/backend/reviews.test.js), [FE review](../../frontend/tests/link-review-controller.test.mjs) | Kiểm version conflict, reason và lịch sử quyết định |
| Hồ sơ / workflow / audit | [Cases](../../backend/CASES.md), [Core workflow](../../backend/WORKFLOW.md) | [Workflow](../../backend/tests/backend/workflow.test.js), [DB cases](../../backend/tests/integration/cases.test.js), [audit](../../backend/tests/integration/audit-data.test.js) | Chuyển bước theo role, thiếu bằng chứng thì guard chặn |
| Sandbox sửa điều kiện / chạy lại / proof | [Sandbox](../../backend/LAB_SANDBOX.md) | [Simulator](../../simulator/tests/lab-state.test.mjs), [DB lab](../../backend/tests/integration/lab.test.js), [closure guard](../../backend/tests/backend/case-verification.test.js) | [Demo](../guides/demo.md): execution → delivery → verification |
| Quản trị thành viên / cấp tài khoản | [Workspace admin](../../backend/WORKSPACE_ADMIN.md) | [BE admin](../../backend/tests/backend/admin.test.js), [DB admin](../../backend/tests/integration/admin.test.js) | [Admin handoff/UAT](../integration/workspace-admin.md); cần admin và provider cấu hình đúng |
| Dashboard và tri thức | [Dashboard](../../backend/DASHBOARD.md), [FE README](../../frontend/README.md) | [DB dashboard](../../backend/tests/integration/dashboard.test.js), [FE knowledge](../../frontend/tests/knowledge.test.mjs) | Số liệu và truy cập theo scope hiện tại |
| Scorer baseline / model opt-in | [Scorer](../../backend/SCORER.md), [model card](../../ai/artifacts/sandbox-v2/README.md) | [BE scorer](../../backend/tests/backend/scorer.test.js), [feature parity](../../backend/tests/backend/features-v2.test.js), [Python model](../../ai/tests/test_model_scorer.py) | Hybrid với scorer, fallback khi lỗi; không tự duyệt cạnh |
| License và dependency provenance | [LICENSES](../../LICENSES.md), [SBOM](../../sbom/README.md) | `licenses:check`, `licenses:frontend:check`, `sbom:check`, Python inventory `--check` | Drift phải được phát hiện khi metadata/pins thay đổi |

## Các giới hạn ảnh hưởng nghiệm thu

- Browser SSO E2E, production FE, và tổ hợp BE–FE–AI phải được xác nhận trên cùng revision/deployment; không cộng kết quả của các nhánh khác nhau thành một lần nghiệm thu.
- Model sandbox v2 dùng synthetic data, chưa đạt mục tiêu precision của dự án; unit/HTTP parity không chứng minh chất lượng trên dữ liệu đại diện.
- Backup/restore, hiệu năng, rà soát image/OS và production hardening cần kiểm riêng.
- SBOM frontend có phạm vi loại optional; Python SBOM chưa có dependency graph. Chi tiết và bước khắc phục ở [SBOM README](../../sbom/README.md).
- Kịch bản server trong tài liệu cũ có thể thuộc dataset khác; demo mới cần dùng manifest, time window và quyền hiện tại.

Lệnh và điều kiện kiểm thử tại [TESTING](../../TESTING.md). Quy trình đóng gói theo [RELEASING](../guides/release.md).
