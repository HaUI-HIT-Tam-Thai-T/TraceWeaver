# Headless core

Core độc lập với Express và giao diện người dùng.

- `data/`: PostgreSQL pool/transaction/migrations, normalized event ingestion và repository đọc events theo scope/snapshot.
- `identity/`: access JWT/JWKS verification, cursor HMAC và repository membership/role/source grants đã có, không import Express.
- `reconstruction/`: candidate/rule baseline có version, evidence, abstention và cycle protection; `data/run-repository.js` lưu input/source/policy snapshot, idempotency/audit và kiểm current ACL cho run/graph. Xem [hướng dẫn](../../RECONSTRUCTION.md).
- `workflow/`: engine definition/version, transition, role/owner/fact guards; cùng engine chạy case_handling và document_review. `data/workflow-store.js` giữ immutable instance/history; case state/owner chỉ lấy từ lịch sử. `data/case-repository.js` nối ACL, evidence, idempotency, run lock và audit. Xem [case/workflow](../../CASES.md).

Identity enforcement đã có cho16 API. Workflow engine đã kiểm headless và qua case HTTP/JWT/PostgreSQL; ba core HTTP nội bộ còn planned, cần app credential + trusted end-user context. Keycloak local/Swagger PKCE đã kiểm ở mốc trước. Xem `backend/IDENTITY.md`, `backend/KEYCLOAK.md` và `backend/EVENTS.md`.
Các thay đổi nghiệp vụ và audit phải dùng cùng transaction. DTO dùng chung tại `../../contracts/`.
