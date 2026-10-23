# Reconstruction runs and headless rules

BE-17 bổ sung candidate generation và rule baseline trong `src/core/reconstruction/`. BE-18 bổ sung run persistence/snapshot, idempotency/audit; BE-19 bổ sung review/manual links. Backend hiện **11/21 implemented**, còn 10 planned.

## API run và graph

| Method/path dưới `/api/v1/workspaces/{wid}` | Quyền và hành vi |
|---|---|
| `POST /runs` | Operator/reviewer và read grants cho mọi nguồn yêu cầu; trả 202 Run và Location |
| `GET /runs/{rid}` | Reader role và current read grants cho toàn bộ scope run; trả Run |
| `GET /runs/{rid}/graph` | Cùng quyền đọc run; completed mới trả Graph, trạng thái khác trả 409 RUN_NOT_READY |

Bearer JWT từ user client như [Identity](IDENTITY.md); ingest client không dùng được. Viewer không tạo run; admin cần thêm role operator/reviewer để tạo và vẫn cần grants. ID ngoài workspace/scope, root ngoài cửa sổ hoặc không tồn tại trả 404. Thu hồi membership, direct grant hoặc group membership chặn toàn run/graph cũ, kể cả nguồn được chọn nhưng không có event.

Ví dụ body cho Swagger (thay UUID bằng event/nguồn thực đã được cấp quyền):

```json
{
  "root_event_id": "11111111-1111-4111-8111-111111111111",
  "source_ids": ["22222222-2222-4222-8222-222222222222"],
  "window": { "from": "2026-10-22T00:00:00Z", "to": "2026-10-22T00:10:00Z" },
  "mode": "rule_only"
}
```

Body dùng RunCreate schema đóng. Cửa sổ tối đa 1 giờ, tối đa 1.000 events trước lọc action/candidate; vượt trả 422 WINDOW_TOO_LARGE và yêu cầu thu hẹp scope/window. Source UUIDs được lowercase/sort như một tập; timestamp string giữ nguyên. Không nhận actor/policy/score từ client. Chỉ nhận Content-Type application/json, body tối đa 1 MiB; query bổ sung bị từ chối.

Thêm `Idempotency-Key` khi cần retry an toàn: 1–200 ký tự ASCII hiển thị, không có khoảng trắng. Cùng actor/workspace/route/key và input đã chuẩn hóa trong 24 giờ trả đúng response đã commit, không tạo run/audit mới. Đổi input cùng key trả 409; đảo thứ tự sources hoặc thứ tự JSON object keys không đổi request hash. Không key hoặc key hết hạn tạo run mới. Chỉ hash của key được lưu. Retry vẫn kiểm quyền hiện tại, không dùng cached response để vượt qua revocation.

Bản đầu thực thi rule có giới hạn trong cùng transaction tạo run, trả `status=completed` cùng 202 và URL poll. Không có worker/in-memory job; lỗi hạ tầng trả 503 đã sanitize và rollback, không để lại run dở hoặc key đã chiếm. `queued/running/failed` vẫn là trạng thái hợp lệ của contract để mở rộng sau này. Chưa có scorer: mode `hybrid` luôn hoàn tất với `degraded=true`, `degraded_reason=ai_unavailable`, `effective_method=rule_only`, `model_version=null`; mode yêu cầu giữ nguyên. Đây không phải kết quả ML.

Policy API được pin tại `src/core/reconstruction/policy.js`: `sandbox-rules-1`, strong namespaces request/account/job, clock skew 5s, max gap 1h, chuyển `intake/request.accepted` → `account/account.created` → `provision/provision.completed` hoặc `provision/provision.failed`. Fan-in/out mặc định false theo từng transition. Action chưa hỗ trợ giữ unresolved; chưa có parser raw hoặc tự đọc attempt từ payload. Kịch bản và producer cần dùng action map này, hoặc đổi policy/version có kiểm thử khi bổ sung action mới.

Graph nodes là **toàn bộ snapshot**, gồm cả event chưa nối được; links là đề xuất trong thành phần nối với root, có UUID riêng, pending và score null. `unresolved_event_ids` luôn trỏ đến node trong snapshot. Bước kỳ vọng intake/account/provision được so với bằng chứng trong thành phần root, version `sandbox-process-1`; bước thiếu mang nhãn “chưa có bằng chứng”. Provision failed vẫn là event đã quan sát được, không bị diễn giải thành hoàn tất cấp phát thành công.

Migration 005 lưu run, requested source IDs (kể cả nguồn rỗng), snapshot event IDs, policy JSON và kết quả graph/links. Events vốn append-only nên snapshot dùng refs, không sao chép payload. Tập event lấy bằng một SQL statement; transaction đang mở rồi commit hoặc event mới đến sau không vào run cũ. Bounds phần lẻ được ceil ở đầu và floor ở cuối đến độ chính xác PostgreSQL để tránh lọt event ngoài cửa sổ. FK giữ workspace/source/root/link endpoints nhất quán; run/scope/snapshot/links có trigger immutable. Tạo run, snapshot, links, idempotency và audit cùng commit/rollback. Review ghi bảng lịch sử riêng, không sửa snapshot hoặc bằng chứng link.

## Review và liên kết thủ công

Hai API dùng JWT user client, active membership, role operator/reviewer và current read grant cho **mọi nguồn run**, kể cả nguồn rỗng. Viewer/admin cần role bổ sung để sửa; subject lấy từ JWT, không nhận qua body/header tùy ý. Chỉ run completed được sửa (khác trả409).

- `POST /api/v1/workspaces/{wid}/runs/{rid}/links/{lid}/reviews`: body `{ "decision": "accepted", "reason": "Đã đối chiếu bằng chứng", "expected_version": 1 }`, trả201 Review với `link_version=2`. Decision chỉ accepted/rejected. Version stale trả409 `VERSION_CONFLICT`; dùng graph mới nhất để quyết định lại. Mọi review, kể cả quyết định giống trước, thêm lịch sử và tăng version.
- `POST /api/v1/workspaces/{wid}/runs/{rid}/links`: body `{ "from_event_id": "<UUID>", "to_event_id": "<UUID>", "reason": "Đã quan sát liên hệ" }`, trả201 Link `method=manual`, `score=null`, `review_state=pending`, `version=1`. Lý do trở thành evidence `MANUAL_REASON`; đây là giải thích của người dùng, không phải bằng chứng rule/model tự sinh.

Schema đóng, reason không trắng 1–1000 ký tự; UUID canonical lowercase. Text có NUL/lone surrogate bị từ chối; các mẫu token/password/Bearer được redacted trước khi lưu hoặc trả. Content-Type application/json, tối đa1MiB, query lạ bị từ chối. Không có idempotency cho hai thao tác này: retry review version cũ nhận409, retry manual pair nhận409 `LINK_EXISTS`.

Hai đầu manual phải thuộc snapshot của đúng run/workspace; thiếu hoặc ngoài scope trả404 để không lộ dữ liệu. Self-link/cycle trả422; chu trình tính cả pending và accepted, bỏ rejected. Khi chấp nhận lại link rejected, kiểm chu trình lại. Pair đã tồn tại luôn409, kể cả rejected; muốn đổi quyết định dùng review version hiện tại, muốn sửa cặp thì bác bỏ cặp cũ rồi thêm cặp khác. Không có heuristic thời gian/action áp cho manual và không tự coi manual là accepted.

Migration006 thêm `core.link_reviews`, composite FK tới đúng link/run/workspace, unique link/version và trigger chặn UPDATE/DELETE/TRUNCATE. Manual proposals append vào `run_links` bất biến. Mỗi writer khóa row run trước khi đọc version/graph và ghi, nên review đồng thời không lost update, manual cạnh ngược không cùng commit được. Quyền được kiểm lại trước commit; link/review/audit cùng transaction, audit lỗi rollback và HTTP trả503 đã sanitize.

GET graph chiếu review mới nhất từ lịch sử, giữ nguyên evidence/score/method/ID. Một SQL statement chụp nodes, links và graph version, tránh trộn hai revision. `Graph.version = 1 + số manual proposals + số reviews`; `Link.version = 1 + số reviews của link`. Các link rejected vẫn hiển thị cùng trạng thái. Unresolved IDs và missing steps được tính lại từ thành phần root qua pending/accepted; đây là connectivity của graph đang xem, không sửa baseline/snapshot.

Case/workflow hiện chưa có persistence/API runtime. **Closed-case evidence guard chưa được nghiệm thu và phải tích hợp trước khi bật case endpoints**: closure/reopen và review/manual phải dùng cùng khóa run, guard đọc trạng thái workflow có thẩm quyền, không tạo cột case state cạnh tranh. Reviews không tự trở thành nhãn training; chưa có API lịch sử review riêng.

## Gọi lõi

```js
import { createRuleEngine } from './src/core/reconstruction/rules.js';

const reconstruct = createRuleEngine({
  version: 'example-rules-1',
  strong_namespaces: ['request', 'account', 'job'],
  clock_skew_ms: 5000,
  transitions: [{
    id: 'intake-account',
    from: { service: 'intake', action: 'request.accepted' },
    to: { service: 'account', action: 'account.created' },
    max_gap_ms: 60000,
    // allow_fan_in / allow_fan_out default false.
  }],
});

const result = reconstruct({ events, root_event_id, source_ids, window: { from, to } });
```

Tên action và khoảng thời gian trên là **ví dụ**, không phải policy production đã chốt. Policy là cấu hình tin cậy phía server, không nhận trực tiếp từ request của người dùng. Thay action, namespace, khoảng thời gian hoặc fan-in/out phải đổi version. Engine chụp bản sao policy khi khởi tạo; sửa object bên ngoài không đổi luật đang chạy.

`events` phải là Event DTO chuẩn đã redacted theo [schema chung](contracts/schemas/domain.schema.json). `source_ids` phải là tập nguồn yêu cầu đã được đối chiếu với membership/role/current read grants của actor trong workspace. Lõi không có subject/workspace/DB để tự xác thực; caller phải lấy events từ đúng workspace, chụp snapshot nhất quán và kiểm lại quyền khi đọc artifact. Chỉ truyền danh sách source IDs vào lõi không chứng minh đã có ACL.

## Candidate và luật

1. Lọc source trước khi đọc các trường khác của event. Chỉ giữ event trong cửa sổ đóng `[from,to]`; root ngoài tập này trả 404. Kiểm Window/RunCreate/Event bằng schema hiện có, từ chối ID event trùng, năm 0000 và thời gian sai. Cửa sổ >1 giờ hoặc >1.000 event trong scope/window trả 422 `WINDOW_TOO_LARGE` trước lọc chuyển bước; không cắt ngầm. So sánh giữ nguyên độ chính xác phần lẻ timestamp.
2. Chỉ sinh cặp đúng service/action mà policy khai báo. Gap từ `-clock_skew_ms` tới `max_gap_ms`, hai đầu tính cả. Skew cho phép 0–5.000ms, max gap 0–3.600.000ms. Với retry cùng service/action, đích phải có thời gian lớn hơn nguồn; timestamp bằng nhau không tạo hướng tùy ý.
3. Định danh so sánh nguyên giá trị, phân biệt hoa/thường, đúng namespace. Hai phía cùng có namespace mạnh nhưng khác giá trị hoặc nhiều giá trị phân biệt trong namespace đó thì loại cặp, tăng `STRONG_ID_CONFLICT`. Giá trị chứa `[REDACTED]` không dùng để ghép. Namespace chỉ có một phía không phải xung đột. Không tự chuẩn hóa/cắt ID.
4. Candidate không có ID mạnh chung vẫn được giữ cho bước scorer sau này; baseline abstain với `NO_SHARED_STRONG_ID`. Nội dung message, actor, payload, source_event_id, outcome và trường giống oracle không được dùng để quyết định cạnh. Outcome failed vẫn là bằng chứng của một bước thất bại, không bị đổi thành success.
5. Baseline chỉ giữ cặp có ID mạnh chung. Theo mỗi transition, nhiều predecessor cho một đích hoặc nhiều successor cho một nguồn đều abstain `AMBIGUOUS_MATCH`, trừ khi policy đã khai báo `allow_fan_in`/`allow_fan_out`. Không chọn cặp gần nhất theo thời gian và không dùng UUID để phá hòa. Khai báo fan-in/out cho phép mọi cặp đủ bằng chứng của transition đó; chỉ dùng khi nghiệp vụ đã xác nhận cardinality này.
6. Loại toàn bộ cạnh trong từng thành phần có chu trình bằng `CYCLE`. Chọn thành phần còn kết nối với root theo cả hai hướng để root ở giữa/cuối hành trình vẫn truy vết ngược được. Mọi cạnh vẫn giữ hướng gốc.

Retry không bị dedup theo request ID; mỗi event giữ event_id riêng. Hai attempt cùng bước với thứ tự thời gian rõ có thể tạo cạnh. Nhiều attempt không có dấu hiệu nhân quả đủ phân biệt sẽ unresolved; chưa có quy tắc tự suy diễn thứ tự attempt từ payload. Branch chỉ tự giữ nhiều cạnh khi policy cho phép hoặc thuộc các transition khác nhau.

## Output nội bộ và giới hạn

`createCandidateGenerator(policy)` ở `candidates.js` trả `rule_version`, root, danh sách event IDs trong scope/window, `candidates` và `rejected_counts`. Candidate có transition, from/to, `has_strong_id` và evidence. Không trả message, payload hoặc metadata oracle.

`createRuleEngine(policy)` ở `rules.js` trả root, `rule_version`, `event_ids` thuộc thành phần root, `links`, `unresolved_event_ids`, `abstentions` và số cặp xung đột. `unresolved_event_ids` là mọi input event trong scope/window chưa nối được vào root, gồm cả thành phần độc lập; không khẳng định chúng cùng hành trình với root. `abstentions` ghi các cặp chưa tự đề xuất được, kể cả ngoài thành phần root.

Link proposal có `method=rule`, `score=null`, `review_state=pending`, `version=1`. Khi gọi lõi trực tiếp chưa có `id`; repository run cấp UUID riêng và liên kết run để trả Link public hoàn chỉnh. Evidence theo LinkEvidence schema, gồm event refs, service/action quan sát được, timestamp gốc và ID chung đã redacted. Adapter API tính `missing_expected_steps` theo template đã pin; lõi tổng quát không tự suy diễn template.

Lõi không đọc file, gọi mạng, ghi DB hoặc gọi model. Tests dùng observable synthetic nhỏ với expected edges khai báo trong test; chưa phải dataset/evaluator hoặc benchmark feasibility AI. Chưa đo p95/precision/recall trên dữ liệu đại diện và chưa chứng minh oracle mount isolation của deployment. Không đánh dấu gate toàn dự án đạt từ các unit tests này.

## Kiểm tra

```powershell
node --test backend/tests/backend/reconstruction.test.js
npm.cmd test
npm.cmd run test:db
npm.cmd run test:identity
```

Unit tests kiểm namespace/conflict, partial IDs, actor/time hard negatives, redaction sentinel, scope/window/root/limit, exact fractional time/skew, ambiguity, retry/branch, root ở giữa hành trình, evidence theo Link schema và loại cycle độc lập thứ tự input. Unit/contract không cần DB. DB/identity tests cần PostgreSQL; identity dùng Postman JWKS simulation hiện có, backend/JOSE/HTTP/DB chạy thật. Kiểm snapshot late commit, concurrency/expiry/idempotency, revoke toàn artifact, FK/immutability và rollback audit. Không cần dependency mới.

Bước kế tiếp: case/workflow và closed-case evidence guard. Giữ scorer/model, raw simulator parsers và feasibility benchmark là phần việc riêng. API mới kiểm trong process test/smoke; Docker API image chưa rebuild trong BE-19. Trước chạy bản mới bằng Docker, build lại image theo [hướng dẫn Docker](DOCKER.md).
