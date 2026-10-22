# Headless core

Core độc lập với Express và giao diện người dùng.

- `data/`: PostgreSQL pool/transaction/migrations, normalized event ingestion và repository đọc events theo scope/snapshot.
- `identity/`: access JWT/JWKS verification, cursor HMAC và repository membership/role/source grants đã có, không import Express.
- `reconstruction/`: candidate/rule baseline có version, evidence, abstention và cycle protection; `data/run-repository.js` lưu input/source/policy snapshot, idempotency/audit và kiểm current ACL cho run/graph. Xem [hướng dẫn](../../RECONSTRUCTION.md).
- `workflow/`: khung definition/version, transition, guard và audit.

Identity enforcement cho bảy API đọc, một API tạo run và một API ingest đã có; Keycloak local/Swagger PKCE đã kiểm. Workflow engine chưa nghiệm thu. Xem `backend/IDENTITY.md`, `backend/KEYCLOAK.md` và `backend/EVENTS.md`.
Các thay đổi nghiệp vụ và audit phải dùng cùng transaction. DTO dùng chung tại `../../contracts/`.
