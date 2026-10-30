# API reference chi tiết — TraceWeaver

> **Phạm vi:** ví dụ API theo snapshot ngày 26/10/2026. Số operation và trạng thái implemented/planned bên dưới là lịch sử; dùng [OpenAPI hiện tại](../../backend/contracts/openapi.json) làm contract. [Mục lục tích hợp](README.md).

Cập nhật26/10/2026 theo contract tại `116e156`. Đọc [luồng FE](frontend.md) trước khi tích hợp. Base origin: `https://api.quizlearn.tech`. Tài liệu mô tả **21 operation trong OpenAPI (20 implemented, scorer planned) +2 health**, cùng49 DTO.

Các ví dụ JSON đã kiểm theo JSON Schema; ID/timestamp/hash/điểm đều minh họa, không phải dữ liệu thực đã có trên Oracle. Tính hợp schema không chứng minh token/quyền/guard/cycle/tương quan resource hợp lệ. Khi chạy thật, lấy IDs từ response trước và subject từ `/me`; không sao chép UUID mẫu. Các resource có related IDs dùng cùng ví dụ để dễ đọc; từng ví dụ có thể ở thời điểm khác nhau.

## A. Quy ước chung

- JSON trực tiếp, không có `{data:...}` chung. POST `Content-Type: application/json`, tối đa1MiB ở backend; không hỗ trợ request compression.
- Error: [Error](#dto-error). Có `X-Request-ID`, `Cache-Control:no-store`; CORS expose Location/X-Request-ID/Retry-After khi origin được cho phép. Nginx có thể trả lỗi HTML.
- Path ID là UUID; owner/actor là Identity subject, không phải username. UTC kết thúcZ; giữ precision timestamp.
- Query không nhận field lạ/lặp; optional chưa dùng thì bỏ hẳn. Chi tiết không có query nếu bảng không liệt kê.
- Pagination limit default50/max100, opaque cursor≤4096; giữ cùng filter/limit/scope. Không có total/offset/page.
- Idempotency-Key chỉ có contract cho createRun/createCase/transitionCase; 1–200 visible ASCII, không khoảng trắng, TTL24h, actor/workspace/route scoped.
- Quyền browser: user access JWT của traceweaver-web, audience traceweaver-api. Server checks current DB membership/role/grants; admin không tự bypass.
- Các HTTP lỗi dùng chung trong spec là tập khả năng, không phải bảo đảm mọi status xuất hiện ở mỗi operation. Controller có thể trả413/415 cho POST ngay cả khi một bảng spec chưa liệt kê.

## B. Danh mục endpoints

| Operation | Method / path | Consumer | Trạng thái |
|---|---|---|---|
| [getMe](#op-getme) | GET `/api/v1/me` | Browser | implemented |
| [listSources](#op-listsources) | GET `/api/v1/workspaces/{wid}/sources` | Browser | implemented |
| [listKnowledge](#op-listknowledge) | GET `/api/v1/workspaces/{wid}/knowledge` | Browser | implemented |
| [ingestEvents](#op-ingestevents) | POST `/api/v1/workspaces/{wid}/sources/{sid}/events:batch` | Producer server | implemented |
| [listEvents](#op-listevents) | GET `/api/v1/workspaces/{wid}/events` | Browser | implemented |
| [getEvent](#op-getevent) | GET `/api/v1/workspaces/{wid}/events/{eid}` | Browser | implemented |
| [createRun](#op-createrun) | POST `/api/v1/workspaces/{wid}/runs` | Browser | implemented |
| [getRun](#op-getrun) | GET `/api/v1/workspaces/{wid}/runs/{rid}` | Browser | implemented |
| [getGraph](#op-getgraph) | GET `/api/v1/workspaces/{wid}/runs/{rid}/graph` | Browser | implemented |
| [reviewLink](#op-reviewlink) | POST `/api/v1/workspaces/{wid}/runs/{rid}/links/{lid}/reviews` | Browser | implemented |
| [createManualLink](#op-createmanuallink) | POST `/api/v1/workspaces/{wid}/runs/{rid}/links` | Browser | implemented |
| [createCase](#op-createcase) | POST `/api/v1/workspaces/{wid}/cases` | Browser | implemented |
| [listCases](#op-listcases) | GET `/api/v1/workspaces/{wid}/cases` | Browser | implemented |
| [getCase](#op-getcase) | GET `/api/v1/workspaces/{wid}/cases/{cid}` | Browser | implemented |
| [addEvidence](#op-addevidence) | POST `/api/v1/workspaces/{wid}/cases/{cid}/evidence` | Browser | implemented |
| [transitionCase](#op-transitioncase) | POST `/api/v1/workspaces/{wid}/cases/{cid}/transitions` | Browser | implemented |
| [getDashboard](#op-getdashboard) | GET `/api/v1/workspaces/{wid}/dashboard` | Browser | implemented |
| [createWorkflowInstance](#op-createworkflowinstance) | POST `/core/v1/instances` | App server | implemented |
| [transitionWorkflowInstance](#op-transitionworkflowinstance) | POST `/core/v1/instances/{id}/transitions` | App server | implemented |
| [getWorkflowInstance](#op-getworkflowinstance) | GET `/core/v1/instances/{id}` | App server | implemented |
| [scorePairs](#op-scorepairs) | POST `/internal/v1/score-pairs` | Scorer nội bộ | planned |
| [getLiveness](#op-getliveness) | GET `/health/live` | Public health | implemented |
| [getReadiness](#op-getreadiness) | GET `/health/ready` | Public health | implemented |

## C. Chi tiết từng operation

<a id="op-getme"></a>

### getMe — Thông tin người dùng và workspace

`GET /api/v1/me`

**Consumer:** Browser. **Trạng thái:** implemented.

Không cần wid. Response có subject và memberships; mảng memberships rỗng là đăng nhập hợp lệ nhưng chưa được cấp workspace. Không dùng role claims trong JWT thay dữ liệu này.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

Không có path/query parameters.

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [Me](#dto-me); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-listsources"></a>

### listSources — Nguồn được cấp quyền đọc

`GET /api/v1/workspaces/{wid}/sources`

**Consumer:** Browser. **Trạng thái:** implemented.

Cần membership và role đọc, chỉ trả source có direct/group read grant hiện tại. Admin không tự có quyền dữ liệu. Phân trang UUID tăng; chưa có CRUD sources.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `limit` | query | Không | integer; min `1`; max `100`; default 50 |
| `cursor` | query | Không | string; minLength `1`; maxLength `4096` |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [SourcesPage](#dto-sourcespage); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-listknowledge"></a>

### listKnowledge — Tra cứu tri thức

`GET /api/v1/workspaces/{wid}/knowledge`

**Consumer:** Browser. **Trạng thái:** implemented.

Cần membership và role đọc. q tìm literal substring không phân biệt hoa/thường trên title/body của latest version. Chỉ đọc, chưa có API tạo/sửa article.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `limit` | query | Không | integer; min `1`; max `100`; default 50 |
| `cursor` | query | Không | string; minLength `1`; maxLength `4096` |
| `q` | query | Không | string; minLength `1`; maxLength `500` |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [KnowledgePage](#dto-knowledgepage); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-ingestevents"></a>

### ingestEvents — Nhận batch event chuẩn hóa — server producer

`POST /api/v1/workspaces/{wid}/sources/{sid}/events:batch`

**Consumer:** Producer server. **Trạng thái:** implemented.

Chỉ server producer: đúng ingest-client JWT + ingest_service role + ingest grant của source. 1–500 records, HTTP body tối đa1 MiB. Kiểm từng EventInput độc lập, rejected không làm mất record hợp lệ. Cùng source_event_id/nội dung canonical là duplicate; khác nội dung là SOURCE_EVENT_CONFLICT. source.service phải khớp event.service. Parser_version/received_at/IDs/provenance do server sinh; timestamp không chứa nonzero precision vượt microsecond. Không gửi client secret trực tiếp làm Bearer.

**Xác thực:** `Authorization: Bearer <ingest access JWT>`; producer tự lấy token phía server.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `sid` | path | Có | [Id](#dto-id); — |

**Body:** [BatchRequest](#dto-batchrequest), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:BatchRequest -->
```json
{
  "events": [
    {
      "source_event_id": "intake-demo-001",
      "occurred_at": "2026-10-26T06:00:00.000Z",
      "service": "intake",
      "action": "request.accepted",
      "outcome": "success",
      "identifiers": [
        {
          "namespace": "request",
          "value": "request-demo-001"
        }
      ],
      "message": "Đã tiếp nhận yêu cầu",
      "payload": {
        "request_type": "account"
      }
    }
  ]
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [BatchResult](#dto-batchresult); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-listevents"></a>

### listEvents — Tìm kiếm và phân trang events

`GET /api/v1/workspaces/{wid}/events`

**Consumer:** Browser. **Trạng thái:** implemented.

Role đọc và current source grants. from/to inclusive theo occurred_at; q tìm literal substring trên message/action/identifier đã redacted; action khớp chính xác. Sort occurred_at,event_id tăng. Giữ nguyên limit/filters khi dùng cursor; snapshot loại event mới đến giữa các trang. Explicit source ngoài scope trả404.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `limit` | query | Không | integer; min `1`; max `100`; default 50 |
| `cursor` | query | Không | string; minLength `1`; maxLength `4096` |
| `from` | query | Không | [UtcTime](#dto-utctime); — |
| `to` | query | Không | [UtcTime](#dto-utctime); — |
| `source_id` | query | Không | [Id](#dto-id); — |
| `q` | query | Không | string; minLength `1`; maxLength `500` |
| `action` | query | Không | string; minLength `1`; maxLength `200` |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [EventsPage](#dto-eventspage); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-getevent"></a>

### getEvent — Chi tiết event và provenance

`GET /api/v1/workspaces/{wid}/events/{eid}`

**Consumer:** Browser. **Trạng thái:** implemented.

Không nhận query parameters. Event bị ẩn hoặc không tồn tại đều404. Payload trả dưới field payload_redacted; provenance không chứa raw secrets. Event.event_id dùng làm root/manual endpoint/evidence reference.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `eid` | path | Có | [Id](#dto-id); — |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [Event](#dto-event); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-createrun"></a>

### createRun — Tạo reconstruction run

`POST /api/v1/workspaces/{wid}/runs`

**Consumer:** Browser. **Trạng thái:** implemented.

Chỉ operator/reviewer + read grants trên mọi source_ids, kể cả nguồn rỗng. Root thuộc scope/window; tối đa1h/1000events trước lọc candidates. Trả202 + Location; hiện completed ngay trong request transaction. Hybrid hiện degraded ai_unavailable, effective_method rule_only, model_version null. Tạo Idempotency-Key một lần cho thao tác, retry cùng key/body trong24h. Không có key tạo run mới.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `Idempotency-Key` | header | Không | string; minLength `1`; maxLength `200` |

**Body:** [RunCreate](#dto-runcreate), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:RunCreate -->
```json
{
  "root_event_id": "11111111-1111-4111-8111-111111111111",
  "source_ids": [
    "30000000-0000-4000-8000-000000000015",
    "30000000-0000-4000-8000-000000000016"
  ],
  "window": {
    "from": "2026-10-26T05:59:00Z",
    "to": "2026-10-26T06:01:00Z"
  },
  "mode": "rule_only"
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 202 | [Run](#dto-run); xem ví dụ đầy đủ ở mục DTO; có Location |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-getrun"></a>

### getRun — Đọc trạng thái run

`GET /api/v1/workspaces/{wid}/runs/{rid}`

**Consumer:** Browser. **Trạng thái:** implemented.

Role đọc và toàn bộ current grants của requested source scope, kể cả nguồn rỗng. Mất một grant ẩn toàn run. Không có endpoint GET danh sách /runs.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `rid` | path | Có | [Id](#dto-id); — |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [Run](#dto-run); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-getgraph"></a>

### getGraph — Đọc graph và revision mới nhất

`GET /api/v1/workspaces/{wid}/runs/{rid}/graph`

**Consumer:** Browser. **Trạng thái:** implemented.

Run completed mới đọc được; khác trạng thái trả409 RUN_NOT_READY. Nodes là toàn snapshot; link có evidence/version/review_state. Graph.version độc lập Link.version; refetch sau review/manual. Missing step chỉ là chưa có bằng chứng.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `rid` | path | Có | [Id](#dto-id); — |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [Graph](#dto-graph); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-reviewlink"></a>

### reviewLink — Chấp nhận hoặc bác bỏ link

`POST /api/v1/workspaces/{wid}/runs/{rid}/links/{lid}/reviews`

**Consumer:** Browser. **Trạng thái:** implemented.

Operator/reviewer, full run-source scope. expected_version là Link.version. Mọi review append history và tăng version, stale409 VERSION_CONFLICT. Reaccept cạnh rejected kiểm cycle lại. Có bất kỳ closed case của run:409 CASE_CLOSED. Không hỗ trợ idempotency; timeout thì đọc graph trước khi quyết định lại.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `rid` | path | Có | [Id](#dto-id); — |
| `lid` | path | Có | [Id](#dto-id); — |

**Body:** [ReviewCreate](#dto-reviewcreate), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:ReviewCreate -->
```json
{
  "decision": "accepted",
  "reason": "Đã đối chiếu request identifier",
  "expected_version": 1
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 201 | [Review](#dto-review); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-createmanuallink"></a>

### createManualLink — Đề xuất link thủ công

`POST /api/v1/workspaces/{wid}/runs/{rid}/links`

**Consumer:** Browser. **Trạng thái:** implemented.

Operator/reviewer, full run-source scope, run completed. Server tạo manual/pending/null score/version1. Hai event phải thuộc exact snapshot; self/cycle422, duplicate pair409 LINK_EXISTS kể cả rejected. Closed case của run chặn409 CASE_CLOSED. Không tự accepted và không có idempotency contract.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `rid` | path | Có | [Id](#dto-id); — |

**Body:** [ManualLinkCreate](#dto-manuallinkcreate), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:ManualLinkCreate -->
```json
{
  "from_event_id": "11111111-1111-4111-8111-111111111111",
  "to_event_id": "22222222-2222-4222-8222-222222222222",
  "reason": "Đề xuất dựa trên bằng chứng đã kiểm tra"
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 201 | [Link](#dto-link); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-createcase"></a>

### createCase — Tạo case từ run

`POST /api/v1/workspaces/{wid}/cases`

**Consumer:** Browser. **Trạng thái:** implemented.

Operator/reviewer, run completed và full source grants. Title không trắng tối đa300; tạo new/owner null/version1. Runtime trả Location tới detail dù OpenAPI createCase chưa mô tả header này. Hỗ trợ Idempotency-Key24h; FE không tự gửi workflow/state/creator.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `Idempotency-Key` | header | Không | string; minLength `1`; maxLength `200` |

**Body:** [CaseCreate](#dto-casecreate), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:CaseCreate -->
```json
{
  "run_id": "55555555-5555-4555-8555-555555555555",
  "title": "Điều tra yêu cầu cấp tài khoản"
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 201 | [Case](#dto-case); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-listcases"></a>

### listCases — Danh sách case theo trạng thái/owner

`GET /api/v1/workspaces/{wid}/cases`

**Consumer:** Browser. **Trạng thái:** implemented.

Role đọc + full run-source grants cho từng case. from/to inclusive theo parent run.created_at, không theo case.created_at. state nhận một enum duy nhất; owner_id là subject. UUID tăng, live-state pagination; cursor gắn cả limit/filters/current scope. Waiting gồm new và assigned, cần gọi hai query riêng.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `limit` | query | Không | integer; min `1`; max `100`; default 50 |
| `cursor` | query | Không | string; minLength `1`; maxLength `4096` |
| `state` | query | Không | [CaseState](#dto-casestate); — |
| `owner_id` | query | Không | [Subject](#dto-subject); — |
| `from` | query | Không | [UtcTime](#dto-utctime); — |
| `to` | query | Không | [UtcTime](#dto-utctime); — |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [CasesPage](#dto-casespage); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-getcase"></a>

### getCase — Chi tiết case, history và evidence

`GET /api/v1/workspaces/{wid}/cases/{cid}`

**Consumer:** Browser. **Trạng thái:** implemented.

Role đọc + full current run-source grants. Body là {case,history,evidence}, không phải chỉ Case. History/evidence append-only. Case.version phản ánh workflow transition; thêm evidence không tăng version.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `cid` | path | Có | [Id](#dto-id); — |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [CaseDetail](#dto-casedetail); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-addevidence"></a>

### addEvidence — Thêm evidence/ghi chú

`POST /api/v1/workspaces/{wid}/cases/{cid}/evidence`

**Consumer:** Browser. **Trạng thái:** implemented.

Operator/reviewer + full source grants. Bắt buộc cả kind/event_ids/note. kind=events cần event_ids không rỗng, kind=note cần note không trắng. Event refs thuộc exact run snapshot, tối đa1000; note tối đa10000. Case closed409. Không có idempotency contract; timeout GET detail trước khi retry. Version workflow không tăng.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `cid` | path | Có | [Id](#dto-id); — |

**Body:** [EvidenceCreate](#dto-evidencecreate), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:EvidenceCreate -->
```json
{
  "kind": "note",
  "event_ids": [],
  "note": "Đã đối chiếu thông tin; cần reviewer xác minh"
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 201 | [Evidence](#dto-evidence); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-transitioncase"></a>

### transitionCase — Chuyển trạng thái case

`POST /api/v1/workspaces/{wid}/cases/{cid}/transitions`

**Consumer:** Browser. **Trạng thái:** implemented.

Mọi action cần current Case.version và reason không trắng≤1000. assign chỉ new và cần owner_id là subject có quyền; start/request_verification cần owner hoặc reviewer. verify_close/verification_failed/reopen cần reviewer. Verify cần note+evidence; close không còn link pending trên toàn run; reopen cần reason khác last close và owner hợp lệ. owner_id chỉ được gửi khi assign. Hỗ trợ Idempotency-Key24h.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `cid` | path | Có | [Id](#dto-id); — |
| `Idempotency-Key` | header | Không | string; minLength `1`; maxLength `200` |

**Body:** [CaseTransition](#dto-casetransition), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:CaseTransition -->
```json
{
  "action": "assign",
  "expected_version": 1,
  "reason": "Nhận xử lý yêu cầu",
  "owner_id": "example-user-sub"
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [Case](#dto-case); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-getdashboard"></a>

### getDashboard — Thống kê theo run và quyền hiện tại

`GET /api/v1/workspaces/{wid}/dashboard`

**Consumer:** Browser. **Trạng thái:** implemented.

Role đọc + full current grants trên từng run. from/to inclusive theo parent run.created_at cho cả bốn counter. unresolved_events đếm occurrence theo run completed; pending/accepted tham gia root connectivity. waiting_cases=new|assigned. Cùng filters dùng cho listCases. Không có run-list/global unresolved endpoint.

**Xác thực:** `Authorization: Bearer <user access JWT>`.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `wid` | path | Có | [Id](#dto-id); — |
| `from` | query | Không | [UtcTime](#dto-utctime); — |
| `to` | query | Không | [UtcTime](#dto-utctime); — |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [Dashboard](#dto-dashboard); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-createworkflowinstance"></a>

### createWorkflowInstance — Tạo workflow — app server

`POST /core/v1/instances`

**Consumer:** App server. **Trạng thái:** implemented.

Không gọi từ browser. Authorization là core-app JWT; X-End-User-Authorization là original user JWT; X-Workspace-Id phải khớp body.workspace_id, creator_subject phải khớp user. Service/user đều cần membership hiện tại. Chỉ tạo document_review v1/document; case workflow sinh qua createCase. Duplicate entity409 WORKFLOW_EXISTS. Không nhận Idempotency-Key.

**Xác thực:** `Authorization: Bearer <core-app access JWT>` + `X-End-User-Authorization: Bearer <original user access JWT>`; không gửi từ FE.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `X-Workspace-Id` | header | Có | [Id](#dto-id); — |

**Body:** [WorkflowCreate](#dto-workflowcreate), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:WorkflowCreate -->
```json
{
  "definition_key": "document_review",
  "definition_version": 1,
  "entity_ref": {
    "type": "document",
    "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  },
  "workspace_id": "10000000-0000-4000-8000-000000000015",
  "creator_subject": "example-user-sub"
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 201 | [WorkflowInstance](#dto-workflowinstance); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-transitionworkflowinstance"></a>

### transitionWorkflowInstance — Chuyển workflow — app server

`POST /core/v1/instances/{id}/transitions`

**Consumer:** App server. **Trạng thái:** implemented.

Chỉ app server, hai JWT + workspace header. expected_version lấy WorkflowInstance.version; case dùng shared guards/history/run lock. Document submit cần operator/reviewer; approve/revise cần reviewer, evidence_refs phải[], không gửi owner_subject. Idempotency-Key không hỗ trợ400; timeout đọc state hiện tại trước retry.

**Xác thực:** `Authorization: Bearer <core-app access JWT>` + `X-End-User-Authorization: Bearer <original user access JWT>`; không gửi từ FE.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `X-Workspace-Id` | header | Có | [Id](#dto-id); — |
| `id` | path | Có | [Id](#dto-id); — |

**Body:** [WorkflowTransition](#dto-workflowtransition), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:WorkflowTransition -->
```json
{
  "action": "submit",
  "expected_version": 1,
  "reason": "Tài liệu đã sẵn sàng để duyệt",
  "evidence_refs": []
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [WorkflowInstance](#dto-workflowinstance); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-getworkflowinstance"></a>

### getWorkflowInstance — Đọc workflow — app server

`GET /core/v1/instances/{id}`

**Consumer:** App server. **Trạng thái:** implemented.

Chỉ app server, hai JWT và workspace header; user cần role đọc, case cần full source grants. Lấy id từ case.workflow_instance_id hoặc response createWorkflowInstance. Service không tự thay quyền user.

**Xác thực:** `Authorization: Bearer <core-app access JWT>` + `X-End-User-Authorization: Bearer <original user access JWT>`; không gửi từ FE.

| Tham số | Vị trí | Bắt buộc | Kiểu / giới hạn |
|---|---|---|---|
| `X-Workspace-Id` | header | Có | [Id](#dto-id); — |
| `id` | path | Có | [Id](#dto-id); — |

**Body:** không gửi request body.

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [WorkflowInstance](#dto-workflowinstance); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-scorepairs"></a>

### scorePairs — Scorer nội bộ — planned

`POST /internal/v1/score-pairs`

**Consumer:** Scorer nội bộ. **Trạng thái:** planned.

CHƯA IMPLEMENT trên API Node/Oracle; không thiết kế FE gọi endpoint này. Internal contract nhận≤100 numeric feature pairs và secret riêng. Cấu hình timeout/score không tạo ra một scorer đã chạy. Score không được coi là xác suất hiệu chuẩn.

**Xác thực:** Service secret nội bộ riêng; endpoint planned.

Không có path/query parameters.

**Body:** [ScoreRequest](#dto-scorerequest), bắt buộc, field ngoài schema bị từ chối. Ví dụ:

<!-- schema:ScoreRequest -->
```json
{
  "schema_version": "1",
  "pairs": [
    {
      "pair_id": "pair-demo-001",
      "features": {
        "delta_seconds": 1,
        "shared_id_count": 1,
        "text_similarity": 0.4,
        "transition_allowed": true,
        "conflicting_id": false
      }
    }
  ]
}
```

| HTTP | Schema / ý nghĩa response |
|---|---|
| 200 | [ScoreResponse](#dto-scoreresponse); xem ví dụ đầy đủ ở mục DTO |
| 400 | [Error](#dto-error) — Malformed request or cursor/filter mismatch |
| 401 | [Error](#dto-error) — Invalid/expired token |
| 403 | [Error](#dto-error) — Action forbidden on visible resource |
| 404 | [Error](#dto-error) — Not found or outside source/workspace scope |
| 409 | [Error](#dto-error) — Version/content conflict or RUN_NOT_READY |
| 413 | [Error](#dto-error) — Body exceeds 1 MiB; no records written |
| 415 | [Error](#dto-error) — Unsupported content type/encoding |
| 422 | [Error](#dto-error) — Schema/guard/window/cycle failure |
| 429 | [Error](#dto-error) — Rate limited |
| 503 | [Error](#dto-error) — Core/scorer unavailable |

<a id="op-getliveness"></a>

### getLiveness

`GET /health/live` — public, không cần token. Không nhận body/query.

200 `{"status":"ok"}` chỉ chứng minh HTTP process sống.

<a id="op-getreadiness"></a>

### getReadiness

`GET /health/ready` — public, không cần token. Không nhận body/query.

200 `{"status":"ready"}` khi DB/migrations khớp source;503 [Error](#dto-error) với `CORE_NOT_READY` nếu chưa sẵn sàng. Không chứng minh Keycloak/model/FE đã sẵn sàng.

## D. Từ điển DTO và response examples

`Có` trong cột bắt buộc nghĩa field phải có, kể cả khi giá trị cho phép null. Khi request/response dùng cùng tên field, ý nghĩa theo DTO chứa nó. Mọi object closed trừ payload/payload_redacted và những object cho phép mở trong schema. Field nested và điều kiện chéo xem JSON Schema gốc; validation schema chưa thay guard runtime.

<a id="dto-id"></a>

### Id

Kiểu: string. format uuid.

<!-- schema:Id -->
```json
"11111111-1111-4111-8111-111111111111"
```

<a id="dto-utctime"></a>

### UtcTime

Kiểu: string. format date-time; pattern `Z$`.

<!-- schema:UtcTime -->
```json
"2026-10-26T06:00:00.000Z"
```

<a id="dto-subject"></a>

### Subject

Kiểu: string. minLength `1`; maxLength `255`.

<!-- schema:Subject -->
```json
"example-user-sub"
```

<a id="dto-reason"></a>

### Reason

Kiểu: string. minLength `1`; maxLength `1000`; pattern `\S`.

<!-- schema:Reason -->
```json
"Đã đối chiếu thông tin trong hai event"
```

<a id="dto-role"></a>

### Role

Kiểu: string. enum: `viewer`, `operator`, `reviewer`, `admin`, `ingest_service`.

<!-- schema:Role -->
```json
"operator"
```

<a id="dto-casestate"></a>

### CaseState

Kiểu: string. enum: `new`, `assigned`, `investigating`, `awaiting_verification`, `closed`.

<!-- schema:CaseState -->
```json
"new"
```

<a id="dto-caseaction"></a>

### CaseAction

Kiểu: string. enum: `assign`, `start`, `request_verification`, `verify_close`, `verification_failed`, `reopen`.

<!-- schema:CaseAction -->
```json
"assign"
```

<a id="dto-error"></a>

### Error

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `error` | Có | object | không nhận field ngoài schema; Lỗi chuẩn hoặc lỗi run tùy DTO |
| `request_id` | Có | string | minLength `1`; maxLength `200`; Mã request để truy vết hỗ trợ |

<!-- schema:Error -->
```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Workflow version has changed"
  },
  "request_id": "example-request-id"
}
```

<a id="dto-membership"></a>

### Membership

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `workspace_id` | Có | [Id](#dto-id) | —; Workspace UUID |
| `roles` | Có | array<[Role](#dto-role)> | uniqueItems; Role theo workspace, không tự chứa grants |
| `group_ids` | Có | array<[Id](#dto-id)> | uniqueItems; Các group trong workspace |

<!-- schema:Membership -->
```json
{
  "workspace_id": "10000000-0000-4000-8000-000000000015",
  "roles": [
    "operator"
  ],
  "group_ids": []
}
```

<a id="dto-me"></a>

### Me

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `subject` | Có | [Subject](#dto-subject) | —; Identity subject đã xác minh |
| `memberships` | Có | array<[Membership](#dto-membership)> | —; Theo schema |

<!-- schema:Me -->
```json
{
  "subject": "example-user-sub",
  "memberships": [
    {
      "workspace_id": "10000000-0000-4000-8000-000000000015",
      "roles": [
        "operator"
      ],
      "group_ids": []
    }
  ]
}
```

<a id="dto-source"></a>

### Source

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `id` | Có | [Id](#dto-id) | —; ID resource do backend sinh |
| `workspace_id` | Có | [Id](#dto-id) | —; Workspace UUID |
| `name` | Có | string | minLength `1`; maxLength `200`; Tên hiển thị |
| `service` | Có | string | minLength `1`; maxLength `100`; Tên service chuẩn hóa |
| `parser_version` | Có | string | minLength `1`; maxLength `100`; Version parser phía source/backend |

<!-- schema:Source -->
```json
{
  "id": "30000000-0000-4000-8000-000000000015",
  "workspace_id": "10000000-0000-4000-8000-000000000015",
  "name": "intake",
  "service": "intake",
  "parser_version": "intake-v1"
}
```

<a id="dto-knowledgearticle"></a>

### KnowledgeArticle

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `id` | Có | [Id](#dto-id) | —; ID resource do backend sinh |
| `workspace_id` | Có | [Id](#dto-id) | —; Workspace UUID |
| `title` | Có | string | minLength `1`; maxLength `300`; Tiêu đề không trắng |
| `body` | Có | string | minLength `1`; maxLength `100000`; Theo schema |
| `version` | Có | integer | min `1`; Version của resource hiện tại; xem quy tắc từng API |
| `author_subject` | Có | [Subject](#dto-subject) | —; Theo schema |
| `source_ref` | Có | string | format uri; URI trỏ nguồn tri thức |
| `created_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm tạo UTC |

<!-- schema:KnowledgeArticle -->
```json
{
  "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "workspace_id": "10000000-0000-4000-8000-000000000015",
  "title": "Quy trình cấp tài khoản",
  "body": "Đối chiếu nguồn tiếp nhận, tạo tài khoản và cấp phát.",
  "version": 1,
  "author_subject": "example-user-sub",
  "source_ref": "urn:traceweaver:knowledge:account-procedure",
  "created_at": "2026-10-26T06:00:00.000Z"
}
```

<a id="dto-identifier"></a>

### Identifier

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `namespace` | Có | string | minLength `1`; maxLength `100`; Namespace identifier phân biệt hoa/thường |
| `value` | Có | string | minLength `1`; maxLength `500`; Giá trị identifier nguyên nghĩa |

<!-- schema:Identifier -->
```json
{
  "namespace": "request",
  "value": "request-demo-001"
}
```

<a id="dto-eventinput"></a>

### EventInput

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `source_event_id` | Có | string | minLength `1`; maxLength `200`; ID gốc từ producer, dedup trong source |
| `occurred_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm sự kiện UTC; giữ precision đã nhận |
| `service` | Có | string | minLength `1`; maxLength `100`; Tên service chuẩn hóa |
| `action` | Có | string | minLength `1`; maxLength `200`; Action chuẩn hóa hoặc action workflow tùy DTO |
| `outcome` | Có | string | enum: `success`, `failed`, `unknown`; Kết quả quan sát success/failed/unknown |
| `identifiers` | Có | array<[Identifier](#dto-identifier)> | —; Namespace/value có ý nghĩa; không chứa secrets |
| `message` | Có | string | minLength `0`; maxLength `4096`; Thông điệp đã redacted khi trả Event |
| `payload` | Có | object | —; Input producer, chưa phải Event response |

<!-- schema:EventInput -->
```json
{
  "source_event_id": "intake-demo-001",
  "occurred_at": "2026-10-26T06:00:00.000Z",
  "service": "intake",
  "action": "request.accepted",
  "outcome": "success",
  "identifiers": [
    {
      "namespace": "request",
      "value": "request-demo-001"
    }
  ],
  "message": "Đã tiếp nhận yêu cầu",
  "payload": {
    "request_type": "account"
  }
}
```

<a id="dto-provenance"></a>

### Provenance

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `batch_id` | Có | [Id](#dto-id) | —; ID batch đã ingest |
| `locator` | Có | string | minLength `1`; maxLength `500`; Vị trí bản ghi trong nguồn/batch |
| `sha256_redacted` | Có | string | pattern `^[a-f0-9]{64}$`; SHA-256 canonical redacted content; ví dụ hash minh họa |

<!-- schema:Provenance -->
```json
{
  "batch_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "locator": "events[1]",
  "sha256_redacted": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

<a id="dto-event"></a>

### Event

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `event_id` | Có | [Id](#dto-id) | —; UUID event dùng cho root/manual/evidence |
| `source_id` | Có | [Id](#dto-id) | —; UUID nguồn |
| `source_event_id` | Có | string | minLength `1`; maxLength `200`; ID gốc từ producer, dedup trong source |
| `occurred_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm sự kiện UTC; giữ precision đã nhận |
| `received_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm backend nhận |
| `service` | Có | string | minLength `1`; maxLength `100`; Tên service chuẩn hóa |
| `action` | Có | string | minLength `1`; maxLength `200`; Action chuẩn hóa hoặc action workflow tùy DTO |
| `outcome` | Có | string | enum: `success`, `failed`, `unknown`; Kết quả quan sát success/failed/unknown |
| `identifiers` | Có | array<[Identifier](#dto-identifier)> | —; Namespace/value có ý nghĩa; không chứa secrets |
| `message` | Có | string | minLength `0`; maxLength `4096`; Thông điệp đã redacted khi trả Event |
| `payload_redacted` | Có | object | —; Payload đã redacted trong Event response |
| `parser_version` | Có | string | minLength `1`; maxLength `100`; Version parser phía source/backend |
| `provenance` | Có | [Provenance](#dto-provenance) | —; Dấu vết nguồn và hash |

<!-- schema:Event -->
```json
{
  "event_id": "11111111-1111-4111-8111-111111111111",
  "source_id": "30000000-0000-4000-8000-000000000015",
  "source_event_id": "intake-demo-001",
  "occurred_at": "2026-10-26T06:00:00.000Z",
  "service": "intake",
  "action": "request.accepted",
  "outcome": "success",
  "identifiers": [
    {
      "namespace": "request",
      "value": "request-demo-001"
    }
  ],
  "message": "Đã tiếp nhận yêu cầu",
  "received_at": "2026-10-26T06:00:01.000Z",
  "payload_redacted": {
    "request_type": "account"
  },
  "parser_version": "intake-v1",
  "provenance": {
    "batch_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "locator": "events[1]",
    "sha256_redacted": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

<a id="dto-batchrequest"></a>

### BatchRequest

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `events` | Có | array<JSON> | minItems `1`; maxItems `500`; Theo schema |

Envelope events không validate mỗi phần tử bằng schema tại đây; runtime validate từng EventInput riêng, do đó một record hỏng không làm cả envelope bị422.

<!-- schema:BatchRequest -->
```json
{
  "events": [
    {
      "source_event_id": "intake-demo-001",
      "occurred_at": "2026-10-26T06:00:00.000Z",
      "service": "intake",
      "action": "request.accepted",
      "outcome": "success",
      "identifiers": [
        {
          "namespace": "request",
          "value": "request-demo-001"
        }
      ],
      "message": "Đã tiếp nhận yêu cầu",
      "payload": {
        "request_type": "account"
      }
    }
  ]
}
```

<a id="dto-batchresultitem"></a>

### BatchResultItem

Kiểu: object / object. —.

Union: accepted/duplicate có client_index,status,event_id; rejected có client_index,status,code, không có event_id. client_index là0-based; không suy từ thứ tự kết quả.

<!-- schema:BatchResultItem -->
```json
{
  "client_index": 0,
  "status": "accepted",
  "event_id": "11111111-1111-4111-8111-111111111111"
}
```

<a id="dto-batchresult"></a>

### BatchResult

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `batch_id` | Có | [Id](#dto-id) | —; ID batch đã ingest |
| `accepted` | Có | integer | min `0`; Số record accepted |
| `duplicate` | Có | integer | min `0`; Số record duplicate |
| `rejected` | Có | integer | min `0`; Số record rejected |
| `results` | Có | array<[BatchResultItem](#dto-batchresultitem)> | minItems `1`; maxItems `500`; Kết quả từng record, không coi cả200 là accepted |

<!-- schema:BatchResult -->
```json
{
  "batch_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "accepted": 1,
  "duplicate": 0,
  "rejected": 0,
  "results": [
    {
      "client_index": 0,
      "status": "accepted",
      "event_id": "11111111-1111-4111-8111-111111111111"
    }
  ]
}
```

<a id="dto-window"></a>

### Window

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `from` | Có | [UtcTime](#dto-utctime) | —; UTC inclusive lower bound theo API |
| `to` | Có | [UtcTime](#dto-utctime) | —; UTC inclusive upper bound theo API |

<!-- schema:Window -->
```json
{
  "from": "2026-10-26T05:59:00Z",
  "to": "2026-10-26T06:01:00Z"
}
```

<a id="dto-runcreate"></a>

### RunCreate

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `root_event_id` | Có | [Id](#dto-id) | —; Event gốc trong scope/window |
| `source_ids` | Có | array<[Id](#dto-id)> | minItems `1`; uniqueItems; Toàn bộ source scope yêu cầu |
| `window` | Có | [Window](#dto-window) | —; Khoảng thời gian inclusive |
| `mode` | Có | string | enum: `rule_only`, `hybrid`; Chế độ người dùng yêu cầu |

<!-- schema:RunCreate -->
```json
{
  "root_event_id": "11111111-1111-4111-8111-111111111111",
  "source_ids": [
    "30000000-0000-4000-8000-000000000015",
    "30000000-0000-4000-8000-000000000016"
  ],
  "window": {
    "from": "2026-10-26T05:59:00Z",
    "to": "2026-10-26T06:01:00Z"
  },
  "mode": "rule_only"
}
```

<a id="dto-run"></a>

### Run

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `id` | Có | [Id](#dto-id) | —; ID resource do backend sinh |
| `status` | Có | string | enum: `queued`, `running`, `completed`, `failed`; Trạng thái run hoặc record batch |
| `mode` | Có | string | enum: `rule_only`, `hybrid`; Chế độ người dùng yêu cầu |
| `root_event_id` | Có | [Id](#dto-id) | —; Event gốc trong scope/window |
| `input_snapshot_id` | Có | [Id](#dto-id) | —; ID immutable input snapshot |
| `rule_version` | Có | string | minLength `1`; maxLength `100`; Version policy đã pin |
| `model_version` | Có | string / null | —; Version model; không bảo đảm model đã deploy |
| `created_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm tạo UTC |
| `completed_at` | Có | [UtcTime](#dto-utctime) / null | —; Thời điểm run hoàn tất hoặc null |
| `degraded` | Có | boolean | —; Kết quả bị giảm phương pháp so với yêu cầu |
| `degraded_reason` | Có | string / null | —; Mã nguyên nhân degraded hoặc null |
| `effective_method` | Có | string | enum: `rule_only`, `hybrid`; Phương pháp thực sự đã dùng |
| `error` | Có | object / null | —; Lỗi chuẩn hoặc lỗi run tùy DTO |

<!-- schema:Run -->
```json
{
  "id": "55555555-5555-4555-8555-555555555555",
  "status": "completed",
  "mode": "rule_only",
  "root_event_id": "11111111-1111-4111-8111-111111111111",
  "input_snapshot_id": "44444444-4444-4444-8444-444444444444",
  "rule_version": "sandbox-rules-1",
  "model_version": null,
  "created_at": "2026-10-26T06:00:00.000Z",
  "completed_at": "2026-10-26T06:00:01.000Z",
  "degraded": false,
  "degraded_reason": null,
  "effective_method": "rule_only",
  "error": null
}
```

<a id="dto-linkevidence"></a>

### LinkEvidence

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `reason_code` | Có | string | minLength `1`; maxLength `100`; Mã bằng chứng; dùng cùng field/observed_values |
| `event_ids` | Có | array<[Id](#dto-id)> | minItems `1`; uniqueItems; Event refs, cần đúng snapshot khi gắn case |
| `field` | Có | string | minLength `1`; maxLength `200`; Tên field làm bằng chứng |
| `observed_values` | Có | array<string / number / boolean / null> | —; Giá trị quan sát đã redacted |

<!-- schema:LinkEvidence -->
```json
{
  "reason_code": "SHARED_STRONG_ID",
  "event_ids": [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222"
  ],
  "field": "identifiers.request",
  "observed_values": [
    "request-demo-001"
  ]
}
```

<a id="dto-link"></a>

### Link

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `id` | Có | [Id](#dto-id) | —; ID resource do backend sinh |
| `from_event_id` | Có | [Id](#dto-id) | —; Event nguồn của cạnh có hướng |
| `to_event_id` | Có | [Id](#dto-id) | —; Event đích của cạnh có hướng |
| `method` | Có | string | enum: `rule`, `model`, `manual`; Nguồn đề xuất rule/model/manual |
| `score` | Có | number / null | —; Điểm hoặc null; null không phải0 |
| `evidence` | Có | array<[LinkEvidence](#dto-linkevidence)> | minItems `1`; Bằng chứng link hoặc case theo DTO |
| `review_state` | Có | string | enum: `pending`, `accepted`, `rejected`; Trạng thái duyệt link |
| `version` | Có | integer | min `1`; Version của resource hiện tại; xem quy tắc từng API |

<!-- schema:Link -->
```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "from_event_id": "11111111-1111-4111-8111-111111111111",
  "to_event_id": "22222222-2222-4222-8222-222222222222",
  "method": "rule",
  "score": null,
  "evidence": [
    {
      "reason_code": "SHARED_STRONG_ID",
      "event_ids": [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222"
      ],
      "field": "identifiers.request",
      "observed_values": [
        "request-demo-001"
      ]
    }
  ],
  "review_state": "pending",
  "version": 1
}
```

<a id="dto-missingstep"></a>

### MissingStep

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `step` | Có | string | minLength `1`; maxLength `100`; Tên bước kỳ vọng |
| `process_template_version` | Có | string | minLength `1`; maxLength `100`; Version template của missing step |
| `label` | Có | string | const "chưa có bằng chứng"; Nhãn bắt buộc chưa có bằng chứng |

<!-- schema:MissingStep -->
```json
{
  "step": "provision",
  "process_template_version": "sandbox-process-1",
  "label": "chưa có bằng chứng"
}
```

<a id="dto-graph"></a>

### Graph

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `run_id` | Có | [Id](#dto-id) | —; Run gắn với artifact |
| `nodes` | Có | array<[Event](#dto-event)> | —; Theo schema |
| `links` | Có | array<[Link](#dto-link)> | —; Theo schema |
| `unresolved_event_ids` | Có | array<[Id](#dto-id)> | uniqueItems; Node IDs chưa nối root component |
| `missing_expected_steps` | Có | array<[MissingStep](#dto-missingstep)> | —; Bước chưa có bằng chứng, không phải kết luận failure |
| `version` | Có | integer | min `1`; Version của resource hiện tại; xem quy tắc từng API |

Ví dụ hai events intake/account, một proposal pending, chưa có evidence cho provision; Graph.version1. Review sample ở DTO Review minh họa thời điểm sau đó, không phải graph đã được refetch.

<!-- schema:Graph -->
```json
{
  "run_id": "55555555-5555-4555-8555-555555555555",
  "nodes": [
    {
      "event_id": "11111111-1111-4111-8111-111111111111",
      "source_id": "30000000-0000-4000-8000-000000000015",
      "source_event_id": "intake-demo-001",
      "occurred_at": "2026-10-26T06:00:00.000Z",
      "service": "intake",
      "action": "request.accepted",
      "outcome": "success",
      "identifiers": [
        {
          "namespace": "request",
          "value": "request-demo-001"
        }
      ],
      "message": "Đã tiếp nhận yêu cầu",
      "received_at": "2026-10-26T06:00:01.000Z",
      "payload_redacted": {
        "request_type": "account"
      },
      "parser_version": "intake-v1",
      "provenance": {
        "batch_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "locator": "events[1]",
        "sha256_redacted": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    },
    {
      "event_id": "22222222-2222-4222-8222-222222222222",
      "source_id": "30000000-0000-4000-8000-000000000016",
      "source_event_id": "account-demo-001",
      "occurred_at": "2026-10-26T06:00:01.000Z",
      "service": "account",
      "action": "account.created",
      "outcome": "success",
      "identifiers": [
        {
          "namespace": "request",
          "value": "request-demo-001"
        }
      ],
      "message": "Đã tạo tài khoản",
      "received_at": "2026-10-26T06:00:01.000Z",
      "payload_redacted": {
        "request_type": "account"
      },
      "parser_version": "account-v1",
      "provenance": {
        "batch_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "locator": "events[1]",
        "sha256_redacted": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    }
  ],
  "links": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "from_event_id": "11111111-1111-4111-8111-111111111111",
      "to_event_id": "22222222-2222-4222-8222-222222222222",
      "method": "rule",
      "score": null,
      "evidence": [
        {
          "reason_code": "SHARED_STRONG_ID",
          "event_ids": [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222"
          ],
          "field": "identifiers.request",
          "observed_values": [
            "request-demo-001"
          ]
        }
      ],
      "review_state": "pending",
      "version": 1
    }
  ],
  "unresolved_event_ids": [],
  "missing_expected_steps": [
    {
      "step": "provision",
      "process_template_version": "sandbox-process-1",
      "label": "chưa có bằng chứng"
    }
  ],
  "version": 1
}
```

<a id="dto-reviewcreate"></a>

### ReviewCreate

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `decision` | Có | string | enum: `accepted`, `rejected`; Quyết định accepted/rejected |
| `reason` | Có | [Reason](#dto-reason) | —; Lý do không trắng; được redact/revalidate |
| `expected_version` | Có | integer | min `1`; Version hiện tại trước thao tác |

<!-- schema:ReviewCreate -->
```json
{
  "decision": "accepted",
  "reason": "Đã đối chiếu request identifier",
  "expected_version": 1
}
```

<a id="dto-review"></a>

### Review

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `id` | Có | [Id](#dto-id) | —; ID resource do backend sinh |
| `link_id` | Có | [Id](#dto-id) | —; Theo schema |
| `decision` | Có | string | enum: `accepted`, `rejected`; Quyết định accepted/rejected |
| `reason` | Có | [Reason](#dto-reason) | —; Lý do không trắng; được redact/revalidate |
| `actor_subject` | Có | [Subject](#dto-subject) | —; Subject người thực hiện |
| `created_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm tạo UTC |
| `link_version` | Có | integer | min `1`; Version link sau review |

<!-- schema:Review -->
```json
{
  "id": "77777777-7777-4777-8777-777777777777",
  "link_id": "66666666-6666-4666-8666-666666666666",
  "decision": "accepted",
  "reason": "Đã đối chiếu request identifier",
  "actor_subject": "example-user-sub",
  "created_at": "2026-10-26T06:00:01.000Z",
  "link_version": 2
}
```

<a id="dto-manuallinkcreate"></a>

### ManualLinkCreate

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `from_event_id` | Có | [Id](#dto-id) | —; Event nguồn của cạnh có hướng |
| `to_event_id` | Có | [Id](#dto-id) | —; Event đích của cạnh có hướng |
| `reason` | Có | [Reason](#dto-reason) | —; Lý do không trắng; được redact/revalidate |

<!-- schema:ManualLinkCreate -->
```json
{
  "from_event_id": "11111111-1111-4111-8111-111111111111",
  "to_event_id": "22222222-2222-4222-8222-222222222222",
  "reason": "Đề xuất dựa trên bằng chứng đã kiểm tra"
}
```

<a id="dto-casecreate"></a>

### CaseCreate

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `run_id` | Có | [Id](#dto-id) | —; Run gắn với artifact |
| `title` | Có | string | minLength `1`; maxLength `300`; Tiêu đề không trắng |

<!-- schema:CaseCreate -->
```json
{
  "run_id": "55555555-5555-4555-8555-555555555555",
  "title": "Điều tra yêu cầu cấp tài khoản"
}
```

<a id="dto-case"></a>

### Case

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `id` | Có | [Id](#dto-id) | —; ID resource do backend sinh |
| `workspace_id` | Có | [Id](#dto-id) | —; Workspace UUID |
| `run_id` | Có | [Id](#dto-id) | —; Run gắn với artifact |
| `workflow_instance_id` | Có | [Id](#dto-id) | —; Workflow instance tương ứng case |
| `title` | Có | string | minLength `1`; maxLength `300`; Tiêu đề không trắng |
| `creator_subject` | Có | [Subject](#dto-subject) | —; Subject tạo resource |
| `owner_id` | Có | [Subject](#dto-subject) / null | —; Identity subject owner trong Case |
| `state` | Có | [CaseState](#dto-casestate) | —; Trạng thái workflow hiện tại |
| `version` | Có | integer | min `1`; Version của resource hiện tại; xem quy tắc từng API |
| `created_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm tạo UTC |
| `updated_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm transition mới nhất của Case |

<!-- schema:Case -->
```json
{
  "id": "88888888-8888-4888-8888-888888888888",
  "workspace_id": "10000000-0000-4000-8000-000000000015",
  "run_id": "55555555-5555-4555-8555-555555555555",
  "workflow_instance_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "title": "Điều tra yêu cầu cấp tài khoản",
  "creator_subject": "example-user-sub",
  "owner_id": null,
  "state": "new",
  "version": 1,
  "created_at": "2026-10-26T06:00:00.000Z",
  "updated_at": "2026-10-26T06:00:00.000Z"
}
```

<a id="dto-evidencecreate"></a>

### EvidenceCreate

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `kind` | Có | string | enum: `events`, `note`; Loại evidence events/note |
| `event_ids` | Có | array<[Id](#dto-id)> | uniqueItems; Event refs, cần đúng snapshot khi gắn case |
| `note` | Có | string | minLength `0`; maxLength `10000`; Ghi chú đã redacted |

Luôn gửi đủ kind,event_ids,note. kind=events cần ít nhất1event; kind=note cần note không trắng. Runtime refs≤1000 và đúng snapshot.

<!-- schema:EvidenceCreate -->
```json
{
  "kind": "note",
  "event_ids": [],
  "note": "Đã đối chiếu thông tin; cần reviewer xác minh"
}
```

<a id="dto-evidence"></a>

### Evidence

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `id` | Có | [Id](#dto-id) | —; ID resource do backend sinh |
| `case_id` | Có | [Id](#dto-id) | —; Case chứa evidence |
| `kind` | Có | string | enum: `events`, `note`; Loại evidence events/note |
| `event_ids` | Có | array<[Id](#dto-id)> | uniqueItems; Event refs, cần đúng snapshot khi gắn case |
| `note` | Có | string | minLength `0`; maxLength `10000`; Ghi chú đã redacted |
| `creator_subject` | Có | [Subject](#dto-subject) | —; Subject tạo resource |
| `created_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm tạo UTC |

<!-- schema:Evidence -->
```json
{
  "id": "99999999-9999-4999-8999-999999999999",
  "case_id": "88888888-8888-4888-8888-888888888888",
  "kind": "note",
  "event_ids": [],
  "note": "Đã đối chiếu thông tin; cần reviewer xác minh",
  "creator_subject": "example-user-sub",
  "created_at": "2026-10-26T06:00:01.000Z"
}
```

<a id="dto-casetransition"></a>

### CaseTransition

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `action` | Có | [CaseAction](#dto-caseaction) | —; Action chuẩn hóa hoặc action workflow tùy DTO |
| `expected_version` | Có | integer | min `1`; Version hiện tại trước thao tác |
| `reason` | Có | [Reason](#dto-reason) | —; Lý do không trắng; được redact/revalidate |
| `owner_id` | Không | [Subject](#dto-subject) | —; Identity subject owner trong Case |

owner_id bắt buộc khi action=assign, runtime từ chối owner_id ở action khác. expected_version lấy Case.version.

<!-- schema:CaseTransition -->
```json
{
  "action": "assign",
  "expected_version": 1,
  "reason": "Nhận xử lý yêu cầu",
  "owner_id": "example-user-sub"
}
```

<a id="dto-workflowhistory"></a>

### WorkflowHistory

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `action` | Có | string | minLength `1`; maxLength `100`; Action chuẩn hóa hoặc action workflow tùy DTO |
| `from_state` | Có | string / null | —; Trạng thái trước hoặc null khi create |
| `to_state` | Có | string | minLength `1`; maxLength `100`; Trạng thái sau |
| `actor_subject` | Có | [Subject](#dto-subject) | —; Subject người thực hiện |
| `reason` | Có | [Reason](#dto-reason) | —; Lý do không trắng; được redact/revalidate |
| `version` | Có | integer | min `1`; Version của resource hiện tại; xem quy tắc từng API |
| `occurred_at` | Có | [UtcTime](#dto-utctime) | —; Thời điểm sự kiện UTC; giữ precision đã nhận |
| `evidence_refs` | Có | array<[Id](#dto-id)> | uniqueItems; Các evidence IDs trong history/core |

<!-- schema:WorkflowHistory -->
```json
{
  "action": "create",
  "from_state": null,
  "to_state": "new",
  "actor_subject": "example-user-sub",
  "reason": "Case created",
  "version": 1,
  "occurred_at": "2026-10-26T06:00:00.000Z",
  "evidence_refs": []
}
```

<a id="dto-casedetail"></a>

### CaseDetail

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `case` | Có | [Case](#dto-case) | —; Theo schema |
| `history` | Có | array<[WorkflowHistory](#dto-workflowhistory)> | —; Lịch sử bất biến |
| `evidence` | Có | array<[Evidence](#dto-evidence)> | —; Bằng chứng link hoặc case theo DTO |

<!-- schema:CaseDetail -->
```json
{
  "case": {
    "id": "88888888-8888-4888-8888-888888888888",
    "workspace_id": "10000000-0000-4000-8000-000000000015",
    "run_id": "55555555-5555-4555-8555-555555555555",
    "workflow_instance_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "title": "Điều tra yêu cầu cấp tài khoản",
    "creator_subject": "example-user-sub",
    "owner_id": null,
    "state": "new",
    "version": 1,
    "created_at": "2026-10-26T06:00:00.000Z",
    "updated_at": "2026-10-26T06:00:00.000Z"
  },
  "history": [
    {
      "action": "create",
      "from_state": null,
      "to_state": "new",
      "actor_subject": "example-user-sub",
      "reason": "Case created",
      "version": 1,
      "occurred_at": "2026-10-26T06:00:00.000Z",
      "evidence_refs": []
    }
  ],
  "evidence": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "case_id": "88888888-8888-4888-8888-888888888888",
      "kind": "note",
      "event_ids": [],
      "note": "Đã đối chiếu thông tin; cần reviewer xác minh",
      "creator_subject": "example-user-sub",
      "created_at": "2026-10-26T06:00:01.000Z"
    }
  ]
}
```

<a id="dto-dashboardfilters"></a>

### DashboardFilters

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `from` | Không | [UtcTime](#dto-utctime) | —; UTC inclusive lower bound theo API |
| `to` | Không | [UtcTime](#dto-utctime) | —; UTC inclusive upper bound theo API |

<!-- schema:DashboardFilters -->
```json
{
  "from": "2026-10-26T00:00:00Z",
  "to": "2026-10-26T23:59:59Z"
}
```

<a id="dto-dashboard"></a>

### Dashboard

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `runs` | Có | integer | min `0`; Số run nhìn thấy được |
| `degraded_runs` | Có | integer | min `0`; Số run degraded |
| `unresolved_events` | Có | integer | min `0`; Occurrences unresolved cộng theo run |
| `waiting_cases` | Có | integer | min `0`; Số case new/assigned |
| `filters` | Có | [DashboardFilters](#dto-dashboardfilters) | —; Time filters được áp dụng/echo |

<!-- schema:Dashboard -->
```json
{
  "runs": 1,
  "degraded_runs": 0,
  "unresolved_events": 0,
  "waiting_cases": 1,
  "filters": {
    "from": "2026-10-26T00:00:00Z",
    "to": "2026-10-26T23:59:59Z"
  }
}
```

<a id="dto-entityref"></a>

### EntityRef

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `type` | Có | string | minLength `1`; maxLength `100`; Loại entity; core create hiện document |
| `id` | Có | [Id](#dto-id) | —; ID resource do backend sinh |

<!-- schema:EntityRef -->
```json
{
  "type": "document",
  "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
}
```

<a id="dto-workflowcreate"></a>

### WorkflowCreate

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `definition_key` | Có | string | minLength `1`; maxLength `100`; Server workflow definition |
| `definition_version` | Có | integer | min `1`; Version definition được hỗ trợ |
| `entity_ref` | Có | [EntityRef](#dto-entityref) | —; Loại/ID entity gắn workflow |
| `workspace_id` | Có | [Id](#dto-id) | —; Workspace UUID |
| `creator_subject` | Có | [Subject](#dto-subject) | —; Subject tạo resource |

<!-- schema:WorkflowCreate -->
```json
{
  "definition_key": "document_review",
  "definition_version": 1,
  "entity_ref": {
    "type": "document",
    "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  },
  "workspace_id": "10000000-0000-4000-8000-000000000015",
  "creator_subject": "example-user-sub"
}
```

<a id="dto-workflowtransition"></a>

### WorkflowTransition

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `action` | Có | string | minLength `1`; maxLength `100`; Action chuẩn hóa hoặc action workflow tùy DTO |
| `expected_version` | Có | integer | min `1`; Version hiện tại trước thao tác |
| `reason` | Có | [Reason](#dto-reason) | —; Lý do không trắng; được redact/revalidate |
| `owner_subject` | Không | [Subject](#dto-subject) | —; Subject owner trong core WorkflowInstance |
| `evidence_refs` | Có | array<[Id](#dto-id)> | uniqueItems; Các evidence IDs trong history/core |

Core: evidence_refs bắt buộc. document_review chỉ nhận[] và không có owner_subject; case_handling áp shared case guards.

<!-- schema:WorkflowTransition -->
```json
{
  "action": "submit",
  "expected_version": 1,
  "reason": "Tài liệu đã sẵn sàng để duyệt",
  "evidence_refs": []
}
```

<a id="dto-workflowinstance"></a>

### WorkflowInstance

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `id` | Có | [Id](#dto-id) | —; ID resource do backend sinh |
| `definition_key` | Có | string | minLength `1`; maxLength `100`; Server workflow definition |
| `definition_version` | Có | integer | min `1`; Version definition được hỗ trợ |
| `entity_ref` | Có | [EntityRef](#dto-entityref) | —; Loại/ID entity gắn workflow |
| `workspace_id` | Có | [Id](#dto-id) | —; Workspace UUID |
| `state` | Có | string | minLength `1`; maxLength `100`; Trạng thái workflow hiện tại |
| `owner_subject` | Có | [Subject](#dto-subject) / null | —; Subject owner trong core WorkflowInstance |
| `version` | Có | integer | min `1`; Version của resource hiện tại; xem quy tắc từng API |
| `history` | Có | array<[WorkflowHistory](#dto-workflowhistory)> | —; Lịch sử bất biến |

<!-- schema:WorkflowInstance -->
```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "definition_key": "document_review",
  "definition_version": 1,
  "entity_ref": {
    "type": "document",
    "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  },
  "workspace_id": "10000000-0000-4000-8000-000000000015",
  "state": "draft",
  "owner_subject": null,
  "version": 1,
  "history": [
    {
      "action": "create",
      "from_state": null,
      "to_state": "draft",
      "actor_subject": "example-user-sub",
      "reason": "Case created",
      "version": 1,
      "occurred_at": "2026-10-26T06:00:00.000Z",
      "evidence_refs": []
    }
  ]
}
```

<a id="dto-pairfeatures"></a>

### PairFeatures

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `delta_seconds` | Có | number | —; Khoảng cách thời gian hai events |
| `shared_id_count` | Có | integer | min `0`; Số strong IDs chung |
| `text_similarity` | Có | number | min `0`; max `1`; Feature similarity trong[0,1] |
| `transition_allowed` | Có | boolean | —; Transition có được policy cho phép |
| `conflicting_id` | Có | boolean | —; Có xung đột ID mạnh |

<!-- schema:PairFeatures -->
```json
{
  "delta_seconds": 1,
  "shared_id_count": 1,
  "text_similarity": 0.4,
  "transition_allowed": true,
  "conflicting_id": false
}
```

<a id="dto-scorerequest"></a>

### ScoreRequest

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `schema_version` | Có | string | const "1"; Version contract features |
| `pairs` | Có | array<object> | minItems `1`; maxItems `100`; Các cặp numeric features nội bộ |

<!-- schema:ScoreRequest -->
```json
{
  "schema_version": "1",
  "pairs": [
    {
      "pair_id": "pair-demo-001",
      "features": {
        "delta_seconds": 1,
        "shared_id_count": 1,
        "text_similarity": 0.4,
        "transition_allowed": true,
        "conflicting_id": false
      }
    }
  ]
}
```

<a id="dto-scoreresponse"></a>

### ScoreResponse

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `model_version` | Có | string | minLength `1`; maxLength `100`; Version model; không bảo đảm model đã deploy |
| `feature_schema_version` | Có | string | const "1"; Version feature schema trả về |
| `predictions` | Có | array<object> | minItems `1`; maxItems `100`; Kết quả scorer planned |

Ví dụ contract planned, không phải điểm do deployment hiện tại tính.

<!-- schema:ScoreResponse -->
```json
{
  "model_version": "example-model-not-deployed",
  "feature_schema_version": "1",
  "predictions": [
    {
      "pair_id": "pair-demo-001",
      "score": 0.7
    }
  ]
}
```

<a id="dto-sourcespage"></a>

### SourcesPage

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `items` | Có | array<[Source](#dto-source)> | —; Các resource thuộc trang này |
| `next_cursor` | Có | string / null | —; Opaque cursor hoặc null khi hết trang |

<!-- schema:SourcesPage -->
```json
{
  "items": [
    {
      "id": "30000000-0000-4000-8000-000000000015",
      "workspace_id": "10000000-0000-4000-8000-000000000015",
      "name": "intake",
      "service": "intake",
      "parser_version": "intake-v1"
    }
  ],
  "next_cursor": null
}
```

<a id="dto-knowledgepage"></a>

### KnowledgePage

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `items` | Có | array<[KnowledgeArticle](#dto-knowledgearticle)> | —; Các resource thuộc trang này |
| `next_cursor` | Có | string / null | —; Opaque cursor hoặc null khi hết trang |

<!-- schema:KnowledgePage -->
```json
{
  "items": [
    {
      "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "workspace_id": "10000000-0000-4000-8000-000000000015",
      "title": "Quy trình cấp tài khoản",
      "body": "Đối chiếu nguồn tiếp nhận, tạo tài khoản và cấp phát.",
      "version": 1,
      "author_subject": "example-user-sub",
      "source_ref": "urn:traceweaver:knowledge:account-procedure",
      "created_at": "2026-10-26T06:00:00.000Z"
    }
  ],
  "next_cursor": null
}
```

<a id="dto-eventspage"></a>

### EventsPage

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `items` | Có | array<[Event](#dto-event)> | —; Các resource thuộc trang này |
| `next_cursor` | Có | string / null | —; Opaque cursor hoặc null khi hết trang |

<!-- schema:EventsPage -->
```json
{
  "items": [
    {
      "event_id": "11111111-1111-4111-8111-111111111111",
      "source_id": "30000000-0000-4000-8000-000000000015",
      "source_event_id": "intake-demo-001",
      "occurred_at": "2026-10-26T06:00:00.000Z",
      "service": "intake",
      "action": "request.accepted",
      "outcome": "success",
      "identifiers": [
        {
          "namespace": "request",
          "value": "request-demo-001"
        }
      ],
      "message": "Đã tiếp nhận yêu cầu",
      "received_at": "2026-10-26T06:00:01.000Z",
      "payload_redacted": {
        "request_type": "account"
      },
      "parser_version": "intake-v1",
      "provenance": {
        "batch_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "locator": "events[1]",
        "sha256_redacted": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    }
  ],
  "next_cursor": null
}
```

<a id="dto-casespage"></a>

### CasesPage

| Field | Bắt buộc | Kiểu | Giới hạn / ý nghĩa |
|---|---|---|---|
| `items` | Có | array<[Case](#dto-case)> | —; Các resource thuộc trang này |
| `next_cursor` | Có | string / null | —; Opaque cursor hoặc null khi hết trang |

<!-- schema:CasesPage -->
```json
{
  "items": [
    {
      "id": "88888888-8888-4888-8888-888888888888",
      "workspace_id": "10000000-0000-4000-8000-000000000015",
      "run_id": "55555555-5555-4555-8555-555555555555",
      "workflow_instance_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "title": "Điều tra yêu cầu cấp tài khoản",
      "creator_subject": "example-user-sub",
      "owner_id": null,
      "state": "new",
      "version": 1,
      "created_at": "2026-10-26T06:00:00.000Z",
      "updated_at": "2026-10-26T06:00:00.000Z"
    }
  ],
  "next_cursor": null
}
```

## E. Tài liệu bổ sung

[FE flows, auth, CORS và retry](frontend.md), [Identity](../../backend/IDENTITY.md), [Events](../../backend/EVENTS.md), [Ingestion](../../backend/INGESTION.md), [Reconstruction](../../backend/RECONSTRUCTION.md), [Cases](../../backend/CASES.md), [Dashboard](../../backend/DASHBOARD.md), [Core workflow](../../backend/WORKFLOW.md).

Reference được biên soạn từ source OpenAPI/schema tại mốc nêu trên; khi thay contract cần cập nhật reference, flows và kiểm lại JSON examples. Không dùng mô tả mốc lịch sử trong tài liệu backend để suy ra mọi capability đã có ở production.
