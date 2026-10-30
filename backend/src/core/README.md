# Headless core

Core độc lập với Express và giao diện người dùng.

## Ranh giới dùng chung

`index.js` là entry point headless cho Identity, Data transaction và Workflow, không khởi động HTTP,
không nạp cấu hình server hoặc import adapter TraceWeaver. HTTP routes/DTO hiện có được giữ nguyên.

- `identity/workspace-access.js`: kiểm membership, role và source grants hiện tại; không import reconstruction.
- `workflow/engine.js`, `workflow/store.js`, `workflow/repository.js`: engine, lịch sử và repository
  dùng chung; không import case/run repository hay validation case.
- `reconstruction/run-scope.js`: SQL scope riêng của run, không phải quyền workspace dùng chung.
- `../adapters/case-workflow.js`: nối case TraceWeaver vào workflow, giữ run lock, evidence,
  kiểm quyền và audit từ case repository hiện tại.
- `data/workflow-repository.js`, `data/workflow-store.js` và các re-export trong `data/run-repository.js`
  giữ tương thích cho caller cũ. Đây là các entry point tương thích, không phải API generic mới.

Ứng dụng khác đăng ký definition được tin cậy khi tạo repository, không gửi definition qua HTTP:

```js
import { createWorkflowRepository } from './index.js';

const workflows = createWorkflowRepository(pool, {
  definitions: [{ definition: yourApprovalDefinition, entityType: 'your_entity' }],
});
```

Definition dùng engine hiện có; repository hỗ trợ quy trình chuyển trạng thái theo role, version,
history và audit trên schema workflow chung. Nghiệp vụ có owner, evidence, facts/guards đặc thù
cần adapter server-side với `authorizeRead`, `create`, `transition`. Adapter phải giữ kiểm quyền,
transaction và tính nguyên tử của nghiệp vụ. Public HTTP schema vẫn chỉ nhận hai workflow đã công bố;
đăng ký headless không tự mở thêm loại workflow cho người gọi HTTP.

Quyền tạo được đặt bằng `createRoles` trong registration server-side; nếu bỏ qua, dùng các role
được phép chuyển bước từ trạng thái ban đầu. Chuyển bước kiểm role của definition và role hiện tại
trong DB, không áp writer roles riêng của TraceWeaver cho tất cả definitions. Role vẫn thuộc mô hình
Identity hiện có; thay đổi này không thêm role tùy ý vào schema. Document/case giữ chính sách cũ.

Refactor không đổi HTTP contract, cấu hình hoặc schema DB. Cập nhật source trên nhánh không tự
cập nhật server; chưa nghiệm thu tích hợp BE–FE–AI hoặc triển khai server sau refactor.

- `data/`: PostgreSQL pool/transaction/migrations, normalized event ingestion và repository đọc events theo scope/snapshot.
- `identity/`: access JWT/JWKS verification, cursor HMAC và repository membership/role/source grants đã có, không import Express.
- `reconstruction/`: candidate/rule baseline có version, evidence, abstention và cycle protection; `data/run-repository.js` lưu input/source/policy snapshot, idempotency/audit và kiểm current ACL cho run/graph. Xem [hướng dẫn](../../RECONSTRUCTION.md).
- `workflow/`: engine definition/version, transition, role/owner/fact guards và immutable instance/history; cùng engine chạy case_handling và document_review. `data/workflow-store.js` re-export store dùng chung và giữ projection riêng của case; case state/owner chỉ lấy từ lịch sử. `data/case-repository.js` nối ACL, evidence, idempotency, run lock và audit. Xem [case/workflow](../../CASES.md).

Core HTTP dùng app JWT riêng, user JWT được verify độc lập và current DB permissions.
Case core transitions giữ cùng repository/run lock/evidence guards. Xem [Core HTTP](../../WORKFLOW.md)
về CORE_APP_CLIENT_ID/CORE_APP_SUBJECT và service membership, [Identity](../../IDENTITY.md),
[Keycloak](../../KEYCLOAK.md) và [Events](../../EVENTS.md) về các ranh giới tương ứng.
Kết quả theo từng phiên bản và trạng thái server nằm ở [hiện trạng](../../../docs/overview/status.md);
kiểm thử source không tự xác nhận bản đang triển khai hoặc chất lượng model.
Các thay đổi nghiệp vụ và audit phải dùng cùng transaction. DTO dùng chung tại `../../contracts/`.
