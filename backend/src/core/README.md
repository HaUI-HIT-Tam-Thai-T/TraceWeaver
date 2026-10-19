# Headless core

Core độc lập với Express và giao diện người dùng.

- `data/`: PostgreSQL pool, transaction và migration đã có.
- `identity/`: khung xác minh danh tính, membership, role và source grants.
- `workflow/`: khung definition/version, transition, guard và audit.

Identity và workflow chưa triển khai. Không mở API nghiệp vụ trước khi có xác thực và kiểm quyền.
Các thay đổi nghiệp vụ và audit phải dùng cùng transaction. DTO dùng chung tại `../../contracts/`.
