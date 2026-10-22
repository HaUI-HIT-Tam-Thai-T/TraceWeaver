# Headless reconstruction rules

BE-17 bổ sung candidate generation và rule baseline trong `src/core/reconstruction/`. Đây là lõi gọi trực tiếp bằng JavaScript; API vẫn **6/21 implemented**. `POST runs`, polling/graph, snapshot PostgreSQL, idempotency và audit của run chưa triển khai.

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

Link proposal có `method=rule`, `score=null`, `review_state=pending`, `version=1`. Đây chưa phải Link public hoàn chỉnh: adapter persistence sẽ cấp `id` và liên kết run; không dùng event ID hoặc policy ID làm link UUID. Evidence theo LinkEvidence schema, gồm event refs, service/action quan sát được, timestamp gốc và ID chung đã redacted. Thiếu bước không suy diễn thành kết quả nghiệp vụ; `missing_expected_steps` cần definition/pipeline ở bước sau.

Lõi không đọc file, gọi mạng, ghi DB hoặc gọi model. Tests dùng observable synthetic nhỏ với expected edges khai báo trong test; chưa phải dataset/evaluator hoặc benchmark feasibility AI. Chưa đo p95/precision/recall trên dữ liệu đại diện và chưa chứng minh oracle mount isolation của deployment. Không đánh dấu gate toàn dự án đạt từ các unit tests này.

## Kiểm tra

```powershell
node --test backend/tests/backend/reconstruction.test.js
npm.cmd test
```

Tests kiểm namespace/conflict, partial IDs, actor/time hard negatives, redaction sentinel, scope/window/root/limit, exact fractional time/skew, ambiguity, retry/branch, root ở giữa hành trình, evidence theo Link schema và loại cycle độc lập thứ tự input. Không cần database, Keycloak, Docker hoặc dependency mới.

Bước kế tiếp: policy nghiệp vụ cụ thể, migration/repository snapshot cho run, quyền operator/reviewer và thu hồi grants trên toàn artifact, atomic audit/idempotency, sau đó createRun/getRun/getGraph. Giữ scorer/model và raw simulator parsers là phần việc riêng.
