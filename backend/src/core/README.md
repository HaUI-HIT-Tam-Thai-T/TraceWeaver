# Headless core

Core độc lập với Express và giao diện người dùng.

- `data/`: PostgreSQL pool, transaction và migration đã có.
- `identity/`: access JWT/JWKS verification, cursor HMAC và repository membership/role/source grants đã có, không import Express.
- `workflow/`: khung definition/version, transition, guard và audit.

Identity enforcement cho ba API đọc đã có; Identity provider/SSO và workflow engine chưa triển khai. Xem `backend/IDENTITY.md`.
Các thay đổi nghiệp vụ và audit phải dùng cùng transaction. DTO dùng chung tại `../../contracts/`.
