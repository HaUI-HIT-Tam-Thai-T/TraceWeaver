# TraceWeaver API contracts

`openapi.json` có21 operation public/core/scorer;20 implemented,1 planned (scorer). Đã có GET /me, /workspaces/{wid}/sources, /knowledge, /events, /events/{eid}; POST /workspaces/{wid}/sources/{sid}/events:batch; POST /workspaces/{wid}/runs, GET /runs/{rid}, /runs/{rid}/graph; POST /runs/{rid}/links và /runs/{rid}/links/{lid}/reviews, năm API create/list/detail/evidence/transition case, GET /workspaces/{wid}/dashboard và3 /core/v1 workflow operations với JWT verification/DB scope enforcement. Health có contract riêng `health.openapi.json`. Xem [Identity BE](../IDENTITY.md), [Batch ingestion](../INGESTION.md), [Event reads](../EVENTS.md), [Reconstruction](../RECONSTRUCTION.md), [Case workflow](../CASES.md), [Dashboard](../DASHBOARD.md) và [Core workflow](../WORKFLOW.md) về cấu hình và giới hạn kiểm chứng.

`schemas/domain.schema.json` dùng JSON Schema 2020-12, là nơi định nghĩa duy nhất 49 kiểu dữ liệu. OpenAPI tham chiếu schema ngoài file, không chép DTO sang mỗi route. Dùng JSON thay YAML để tooling Node đọc trực tiếp; không cần YAML parser riêng.

## Dùng và kiểm tra

Từ root chạy `npm run test:contracts`; `npm test` cũng bao gồm contract tests. Swagger Parser kiểm OpenAPI/refs với remote resolution tắt; Ajv compile strict và kiểm UUID/date-time, positive/negative fixtures, finite score. Chưa có Postman workspace, mock được publish.

`fixtures/valid.json` là map theo tên schema; `fixtures/invalid.json` ghi schema/payload/expected keyword. Dữ liệu synthetic, score chỉ là ví dụ cấu trúc. Runtime hash dùng canonical redacted normalized content, bỏ event_id/source_id/received_at/provenance, giữ parser_version, sort object keys và array order. Timestamp canonical giữ chính xác tới microsecond; giữ legacy millisecond hashes, reject nonzero precision vượt6digits. Xem [ingestion](../INGESTION.md). Không lấy UUID/cursor/credential mẫu làm dữ liệu/token thật.

## Semantics cần giữ khi implement

- Input object đóng field ngoài schema; payload log là JSON object linh hoạt. Server tự tạo event_id, received_at, provenance và parser_version; client không được gán chúng.
- BatchRequest chỉ kiểm envelope/count. Mỗi phần tử được kiểm riêng bằng EventInput, kể cả record không phải object; record sai trả rejected, record đúng vẫn xử lý. Body >1 MiB bị chặn tại HTTP; counters/index coverage/hash/dedup là runtime invariants.
- User JWT, ingest JWT, app service credential và scorer credential khác nhau. User context của core phải đến từ phía đã validate token, không từ header actor do client tự gán. Contract không tự chứng minh auth/source ACL.
- Me có subject và memberships; roles/group_ids nằm trong mỗi workspace membership. Role wire value cho ingest là `ingest_service`. Admin không tự có read/ingest grants.
- Pagination `{items,next_cursor}`; default limit 50/max100; cursor gắn filter/scope/sort; event cursor giữ snapshot bất biến, case cursor gắn cả limit và phân trang trạng thái hiện tại. Events sort occurred_at,event_id. Cursor sai filter/scope trả 400.
- Idempotency-Key trên POST run/case/transition là tùy chọn khi tạo lần đầu, bắt buộc nếu muốn retry an toàn; actor+workspace+route trong 24h, đổi body cùng key trả 409. Ingest dùng persistent source_event_id dedup.
- Review/transition bắt buộc expected_version và reason không trắng. Assign bắt buộc owner_id. Các guard membership/owner/evidence/role/case closed cần kiểm runtime, không chỉ schema.
- Dashboard và listCases dùng inclusive UTC from/to theo parent run created_at; cursor case gắn cả hai filter. Unresolved đếm event occurrences theo từng run với graph mới nhất; waiting là new/assigned. Không có global run-list API.
- Case detail trả `{case,history,evidence}`; WorkflowInstance chứa state/version/history. Evidence kind `events` cần event_ids không rỗng; kind `note` cần note không trắng. KnowledgeArticle có source_ref URI bắt buộc cùng version/author.
- Scorer pairs ≤100, feature schema `1`, finite score [0,1]. Caller phải kiểm exact pair_id set, model/schema compatibility, timeout/degraded; JSON Schema không so request IDs với response IDs.
- Schema không chứng minh from≤to/window≤1h, event count≤1000, graph references/cycle, source grant revocation hoặc atomic audit. Các mục đó vẫn cần business/integration tests ở các bước tiếp theo.

Thay contract phải cập nhật schema, fixtures/tests, docs và consumer trong cùng thay đổi. Không tạo CRUD quản trị sources/knowledge ngoài MVP chỉ vì DB đã có bảng.
