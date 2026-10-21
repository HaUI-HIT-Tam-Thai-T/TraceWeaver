# TraceWeaver backend

Node.js + Express + PostgreSQL. JavaScript ESM; npm workspace tại root. Hiện có 6/21 API: GET /me, sources, knowledge, events, event detail và POST batch ingestion. Xem [Identity BE](IDENTITY.md), [ingestion](INGESTION.md) và [events](EVENTS.md) về cấu hình/quyền và giới hạn kiểm chứng.

## Chạy trên Windows PowerShell

Chạy API + PostgreSQL bằng Docker: `docker compose up -d --build --wait api` từ root, dùng `.env` hiện có. Xem [Docker API](DOCKER.md) về migration, build và cấu hình IdP trong container.

Từ root repo, dùng Node 24.14.1/npm 11.11.0 đã kiểm:

```powershell
npm.cmd ci
npm.cmd run db:setup
npm.cmd run db:up
```

`db:setup` chỉ tạo `.env` khi chưa tồn tại, sinh password ngẫu nhiên và DATABASE_URL tương ứng; không in credentials. `db:up` chạy PostgreSQL riêng bằng `compose.dev.yaml`, chỉ bind `127.0.0.1:55432`, giữ dữ liệu trong volume `traceweaver_postgres_data`. Container hiện đã khởi tạo; nếu `.env` có sẵn thì giữ nguyên, không cần chạy lại setup.

Image PostgreSQL 17.11 đã pin digest. `db:up` không tự pull; trên máy mới chưa có image, chạy `docker compose -f compose.dev.yaml pull postgres` trước. Đây là môi trường development: POSTGRES_USER là tài khoản bootstrap/migration của image, không phải cấu hình quyền tối thiểu cho production. Không đổi password trong `.env` để đặt lại password của volume đã khởi tạo.

Nếu dùng PostgreSQL có sẵn thay vì Compose, điền DATABASE_URL trỏ đến database đã tạo và user có quyền tạo bảng/schema. Ví dụ cấu trúc, không phải credential có sẵn:

```text
DATABASE_URL=postgresql://USER:URL_ENCODED_PASSWORD@localhost:5432/traceweaver
```

Password có ký tự đặc biệt phải URL-encode. Không commit `.env`. DATABASE_URL và CURSOR_SECRET là bắt buộc; db:setup sinh mới khi chưa có env. Với env cũ cần bổ sung cursor key. OIDC cấu hình theo provider; INGEST_CLIENT_ID phải khác OIDC_CLIENT_ID. Scorer vẫn thuộc bước sau.

```powershell
npm.cmd run db:migrate
npm.cmd run dev:be
```

API chạy trên host mặc định bind `127.0.0.1:8080`; có thể đổi bằng API_HOST/API_PORT. Dùng `npm.cmd run start:be` để chạy không watch. Không tự migration lúc khởi động server; thiếu schema thì readiness chưa đạt. `npm.cmd run db:stop` dừng DB, giữ nguyên volume. `compose.dev.yaml` chỉ chạy PostgreSQL; `compose.yaml` bổ sung migration/API, chưa có FE/IdP/AI.

## Endpoint hiện có

| Endpoint | Kết quả |
|---|---|
| `GET /health/live` | 200 `{ "status": "ok" }`, độc lập với DB |
| `GET /health/ready` | 200 `{ "status": "ready" }` khi DB/migration sẵn sàng; ngược lại 503 `CORE_NOT_READY` |
| `GET /api/v1/me` | Membership/roles theo subject đã xác thực |
| `GET /api/v1/workspaces/{wid}/sources` | Nguồn có read grant |
| `GET /api/v1/workspaces/{wid}/knowledge` | Knowledge theo membership/reader role |
| `POST /api/v1/workspaces/{wid}/sources/{sid}/events:batch` | Ingest client + ingest role/grant; counters từng record |
| `GET /api/v1/workspaces/{wid}/events` | Search/filter và cursor snapshot theo read grants |
| `GET /api/v1/workspaces/{wid}/events/{eid}` | Event đã redacted và provenance; 404 ngoài scope |

Hợp đồng: [health OpenAPI](contracts/health.openapi.json). Đây là operational health, chưa đánh giá readiness của Identity provider/scorer; JWT verification được thực hiện riêng tại API auth. Health public không trả host DB, credentials hay stacktrace. Các lỗi có `request_id` tương ứng header `X-Request-ID`. Business routes chưa triển khai trả 404.

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health/live
Invoke-RestMethod http://127.0.0.1:8080/health/ready
npm.cmd test
```

## Dữ liệu và migration

SQL nằm tại `backend/src/core/data/migrations/`, LF line endings được cố định bằng `.gitattributes`. Migration chạy trong transaction có advisory lock và lưu SHA256 vào `public.traceweaver_schema_migrations`. Chạy lại bỏ qua migration khớp checksum; thay file đã áp dụng hoặc thiếu lịch sử tương ứng sẽ fail. Thêm migration mới để thay schema, không sửa file đã chạy và không xóa bảng/volume để né lỗi. Chưa có down migration tự động.

`withTransaction(pool, work)` dùng cùng client cho toàn transaction; khi callback lỗi sẽ rollback, release connection và giữ lỗi gốc. Repository/service nghiệp vụ sau này phải dùng transaction này cho cập nhật cùng audit.

## Kiểm chứng hiện tại và bước tiếp theo

Cập nhật BE-12: 27 unit/HTTP/contract, 20 PostgreSQL và 23 identity/HTTP/DB tests pass; base/license checks pass. Snapshot loại cả transaction đang mở rồi commit sau trang đầu. Chỉ JWKS được mô phỏng bằng Postman; backend/JOSE/PostgreSQL chạy thật. Các đoạn BE-01–03 dưới đây ghi lịch sử foundation.

11 unit/HTTP test pass với Node 24.14.1. Ngày 19/10/2026 sau khi người dùng bật Docker, đã chạy migration hai lần trên PostgreSQL 17.11 thật; lần hai không áp dụng lại. `npm.cmd run test:db` pass 5 tình huống (runner báo 6 tests tính cả test cha): concurrent migration, rollback business write, rollback DDL/history khi SQL lỗi, checksum drift và HTTP readiness 200/503 với DB connection thật.

Integration tests tạo database riêng `traceweaver_test_<uuid>` trong container local, không sửa DB development và không tự drop database. Mỗi lần chạy tạo một DB nhỏ mới; chỉ chạy lại khi thay migration/DB behavior. Cần user có CREATEDB hoặc quyền bootstrap tương ứng. Không ghi credentials vào test output. Backend đang chạy đã trả `/health/live` = ok, `/health/ready` = ready.

BE-03 đã bổ sung [OpenAPI và schema dùng chung](contracts/README.md) cho 21 operation, migration 002 cho memberships/roles/groups/sources/grants/knowledge/audit. Chạy `npm run test:contracts` để kiểm OpenAPI/49 schema/fixtures; `npm run test:db` còn kiểm ràng buộc cross-workspace, duplicate grants, knowledge version và audit append-only/rollback thật. Sau khi thêm migration phải migrate và restart BE vì server nạp danh sách migration lúc startup.

Sáu API đã implemented với JWT/JWKS và DB permissions; Keycloak thật chưa nghiệm thu. `npm run test:identity` kiểm token/quyền/revocation/cursor/snapshot; xem [EVENTS.md](EVENTS.md). Tiếp theo phía BE là reconstruction run/rule baseline và snapshot theo source scope; raw simulator parsers là việc riêng.

## Phân tầng

`routers/` → `controllers/` → `services/`; `middlewares/` xử lý HTTP chung. `models/`, `validations/`, `utils/` là khung cho API nghiệp vụ tiếp theo. Kết nối và migrations dùng chung tại `backend/src/core/data/`.
