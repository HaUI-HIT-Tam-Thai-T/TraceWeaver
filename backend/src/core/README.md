# Headless core

Core độc lập với Express và giao diện người dùng.

- `data/`: PostgreSQL pool/transaction/migrations, normalized event ingestion và repository đọc events theo scope/snapshot.
- `identity/`: access JWT/JWKS verification, cursor HMAC và repository membership/role/source grants đã có, không import Express.
- `workflow/`: khung definition/version, transition, guard và audit.

Identity enforcement cho năm API đọc và một API ingest đã có; Identity provider/SSO thật và workflow engine chưa nghiệm thu. Xem `backend/IDENTITY.md` và `backend/EVENTS.md`.
Các thay đổi nghiệp vụ và audit phải dùng cùng transaction. DTO dùng chung tại `../../contracts/`.
