# Phản hồi BACKEND_HANDOFF — TraceWeaver Backend

## BE-27 — 28/10/2026: baseline scorer integration

AI baseline runtime imported from origin/xkhuong/feat/ai-scorer; Node adapter tested against real Python HTTP. No trained model exists. Only reviewed baseline is enabled: scores annotate guard-approved pending links; effective_method remains rule_only with ai_baseline_only. sandbox-rules-2 applies outcome guards; optional Graph.abstentions is persisted with audit. Batch <=100, total <=5s; failures discard all scores. Runtime features are independently versioned; legacy bootstrap helpers are not trained-model parity evidence. See [Scorer guide](../backend/SCORER.md).

BE-33 follow-up verified on 28/10/2026: Docker/PostgreSQL restored using existing images and volume. All 50 DB and 46 native identity/API tests pass, zero skipped, with SCORER_PYTHON enabled. The new JWT HTTP → Python baseline → PostgreSQL test proves durable scores/audit/replay, graph/review and fallback after the scorer process is stopped. Prior 82 unit/HTTP/contract and 28 Python results remain at BE-27; no model/dependency/runtime changes in this follow-up. The earlier DB connection blocker is resolved. API container still uses its previous image; tests start a separate API from current source. No production/live-Keycloak/UI E2E or trained-model readiness is claimed. Earlier status below is historical where superseded.


## Phản hồi AI_BE_CONFIRMATION — 28/10/2026

Phía BE chọn phương án MVP dưới đây để phản hồi `AI_BE_CONFIRMATION.md` ngày 28/10/2026. Đây là quyết định về hướng tích hợp phía BE, chưa phải bằng chứng hai bên đã duyệt contract mới hoặc runtime đã thực thi đầy đủ. Giữ scorer schema `1` và policy đang chạy `sandbox-rules-1`; các mục lịch sử ngày 25/10 bên dưới chỉ còn áp dụng khi không bị phần này thay thế.

### 1. BE quản lý unresolved và abstain

Đồng ý để BE giữ unresolved và reason dựa trên event/candidate context. AI chỉ trả score tham khảo cho cặp BE gửi; không mở contract AI abstain trong MVP. `score=0` và `score=0.5` đều là điểm, không mang nghĩa abstain. Score không được xóa trạng thái thiếu strong ID, outcome chưa rõ/mâu thuẫn hoặc nhiều attempt không phân biệt được.

Hiện lõi đã có `abstentions` với `NO_SHARED_STRONG_ID`, `AMBIGUOUS_MATCH`, `CYCLE`; strong conflict loại cặp và tăng `rejected_counts.STRONG_ID_CONFLICT`. Public Graph chỉ có `unresolved_event_ids`, chưa có reason cho từng event/candidate; repository chưa lưu `abstentions`. Cần bổ sung lưu/đọc reason trước khi tuyên bố hoàn tất phần trách nhiệm này. Không tự thêm field vào DTO hiện hành. Root luôn là điểm neo của thành phần graph, nên việc root không nằm trong `unresolved_event_ids` không chứng minh outcome của root hợp lệ.

### 2. Giữ 5 feature và nghĩa shared_id_count

Giữ nguyên `delta_seconds`, `shared_id_count`, `text_similarity`, `transition_allowed`, `conflicting_id` trong schema `1`. `shared_id_count` là số phần tử giao nhau của hai tập cặp `(namespace, value)` quan sát được, tính mọi namespace, kể cả `user`; cùng cặp lặp lại không được đếm nhiều lần. So sánh phân biệt hoa/thường và đúng namespace, không so value trần. Ví dụ hai event cùng `(request,R1)` và `(user,U1)` có count=2 nhưng chỉ một shared strong ID; chỉ cùng user có count=1 và BE vẫn abstain.

Không thêm `shared_strong_id_count` ngay và không đổi nghĩa field cũ thành strong count. Strong namespaces vẫn là `request`, `account`, `job`; BE kiểm shared strong ID và conflict độc lập với numeric feature. Quy tắc loại giá trị đã redacted khi tính feature phải có fixture thống nhất với extractor AI; không lấy sentinel `[REDACTED]` làm bằng chứng ghép. Hiện checkout BE chưa có feature extractor, nên đây là semantics thống nhất phía BE cho bước tích hợp, chưa phải feature runtime đã kiểm tương đương.

### 3. Trách nhiệm, namespace và cách dùng score

Đồng ý cách phân chia trong file AI:

- BE lọc quyền nguồn, chuẩn hóa event, tính feature runtime và giữ mapping `pair_id` tới event IDs. AI bàn giao công thức/extractor có version và fixture đối chiếu; đặc biệt phải chốt `text_similarity` và artifact vocabulary/IDF nếu dùng TF-IDF. Không thay công thức hoặc fit lại trên validation/test.
- Namespace chuẩn: `request`, `account`, `job`; alias `request_id → request`, `account_id → account`, `job_id → job`, `user_id → user` do parser/producer chuẩn hóa trước khi ingest. Ingest hiện nhận EventInput đã chuẩn hóa, chưa có alias mapper/raw parser; không mặc định backend hiện tự map, không đổi ID đã lưu hoặc dùng alias action ngoài policy.
- BE áp dụng ACL, transition, cửa sổ thời gian, strong conflict/shared evidence, outcome, ambiguity và cycle. AI chỉ hỗ trợ xếp hạng/đề xuất; không tự tạo hoặc xác nhận cạnh. Đề xuất do BE ghi vẫn là `review_state=pending`, người có quyền duyệt chấp nhận qua API có version/audit hiện hành. Không dùng ngưỡng synthetic `0.20` làm ngưỡng nghiệp vụ; chưa chọn threshold tự nối trong MVP.
- Khi tích hợp scorer, timeout/lỗi/malformed response phải fallback rule-only nhất quán cho toàn run, giữ degraded/reason và audit thật. Đề xuất deadline tổng 5000ms, tối đa100 pairs/call, không retry vô hạn; còn cần kiểm chứng adapter. Hiện hybrid luôn degraded `ai_unavailable`, `model_version=null`; chưa có scorer HTTP hoặc kiểm timeout/fallback từ scorer thật.

### 4. Outcome unknown và mâu thuẫn

Chọn MVP: `outcome=unknown` ở mọi action được hỗ trợ đều giữ để review và abstain, không dùng như nhãn supervised chắc chắn; label null không tự đổi thành0. Mâu thuẫn action/outcome cũng giữ event và chuyển review, không xóa event hay sửa outcome.

| Service/action | Outcome nhất quán để tiếp tục xét các guard khác |
|---|---|
| `intake/request.accepted` | `success` |
| `account/account.created` | `success` |
| `provision/provision.completed` | `success` |
| `provision/provision.failed` | `failed` |

`provision.failed/failed` là bằng chứng hợp lệ của bước thất bại, vẫn được xét cạnh từ account; không đổi thành success. Unknown dùng reason dự kiến `OUTCOME_UNKNOWN`, mâu thuẫn dùng `OUTCOME_ACTION_MISMATCH`. Đây là tên reason đề xuất cho phần thực thi, chưa có trong public contract/runtime. Không suy ra account failed rồi provision success là retry hợp lệ từ score hoặc request ID chung.

**Khoảng trống còn phải triển khai:** candidate/rule engine hiện chưa đọc outcome để chặn đề xuất. Bổ sung outcome guard, lưu reason và tests là điều kiện trước tích hợp scorer; khi thay semantics policy phải version policy/snapshot và đồng bộ fixture/evaluator, không âm thầm đổi `sandbox-rules-1` đã lưu trong run cũ. Tài liệu phản hồi này không sửa runtime hoặc chứng nhận demo/model đã tuân thủ outcome policy.

### 5. Retry, nhiều candidate và cardinality

Bằng chứng phân biệt phải quan sát được và thể hiện quan hệ giữa đúng hai attempt. `job` chung duy nhất có thể đủ khi các guard khác hợp lệ và các candidate cạnh tranh bị loại bằng bằng chứng rõ ràng, ví dụ mỗi attempt có job khác nhau và đích khai báo đúng job đó. Chỉ một candidate có job trong khi candidate khác thiếu job chưa đủ để bỏ candidate còn lại. Runtime hiện không ưu tiên cặp chỉ vì có nhiều strong IDs hơn.

Attempt ID do producer cung cấp chỉ được dùng sau khi thống nhất namespace, phạm vi duy nhất và semantics quan hệ; chưa thêm `attempt` vào strong namespaces hay suy từ số thứ tự trong payload. Không dùng nearest timestamp, thứ tự input, UUID hoặc score cao hơn để phá ambiguity. Nếu sau các guard vẫn có nhiều candidate đủ điều kiện cạnh tranh: `AMBIGUOUS_MATCH` và unresolved.

MVP giữ mặc định tối đa một cạnh đi ra trên mỗi `(from_event_id, transition_id)` và một cạnh đi vào trên mỗi `(to_event_id, transition_id)`; cạnh tranh thì abstain, không tự chọn một cạnh. `allow_fan_in`/`allow_fan_out` không bật trong sandbox policy. Đây là cardinality **theo transition ID**, không phải tổng bậc event: `account-provision-completed` và `account-provision-failed` hiện là hai transition khác nhau. Nếu muốn gộp chúng thành một slot provisioning hoặc cấm đồng thời hai outcome, cần policy mới và fixture đi kèm; chưa tuyên bố guard đó đã có. Same-service retry và skip Intake→Provision vẫn chưa được sandbox policy cho phép.

### Mẫu trả lời nhanh để gửi bên AI

```text
1. Unresolved/abstain do BE quản lý; giữ schema 1, không quy ước score 0/0.5 là abstain.
2. shared_id_count đếm tập cặp (namespace,value) chung ở mọi namespace;
   giữ 5 feature, chưa thêm shared_strong_id_count; strong-ID guard ở BE.
3. BE chuẩn hóa/tính feature/áp guard/audit; AI bàn giao công thức và fixture,
   chỉ hỗ trợ xếp hạng/đề xuất, không tự nối/xác nhận; chưa duyệt threshold 0.20.
   Parser/producer map request_id→request, account_id→account, job_id→job,
   user_id→user trước ingest; backend hiện chưa có alias mapper/extractor.
4. Outcome unknown luôn abstain/review ở các action hỗ trợ; mâu thuẫn cũng review.
   Outcome guard và lưu/trả reason còn phải triển khai/version trước tích hợp.
5. Dùng job chung phân biệt duy nhất sau mọi guard; attempt ID cần thống nhất riêng.
   Không đủ bằng chứng: AMBIGUOUS_MATCH, kể cả candidate có score cao hơn.
   Một incoming và một outgoing/event/transition_id; không bật fan-in/fan-out.
   Hai outcome provision là hai transition riêng; chưa có guard một slot gộp.
```

Giữ nguyên label là cạnh trực tiếp có ground truth, đúng hướng, không skip-edge; cửa sổ delta đóng `[-5,3600]` giây; strong conflict không bị score ghi đè. Dedup theo `(workspace_id,source_id,source_event_id)`, không theo request ID. BE chưa nhận/kiểm dữ liệu, test hoặc kết quả offline được AI nhắc trong file; cần bàn giao artifact và fixture trước khi xác nhận tính tương đương runtime. Các quyết định trên không đồng nghĩa đã gửi phản hồi cho bên AI hoặc triển khai lên server.

## Lịch sử phản hồi BACKEND_HANDOFF — 25/10/2026

Ngày 25/10/2026, cập nhật sau sửa audit. [Hiện trạng backend](CURRENT_STATUS.md). Các mục “đề xuất” dưới đây chưa thay thế quyết định nghiệp vụ hoặc policy/version đang chạy.

## Phần có thể xác nhận

**Label 1 là cạnh có hướng trực tiếp A → B theo oracle**, không phải cứ cùng journey là positive. Định nghĩa này đã có trong tài liệu AI/evaluation. Oracle cần lưu cả journey membership và directed expected edges; retries/branches chỉ positive theo cạnh thực tế đã khai báo.

Backend hiện dùng policy `sandbox-rules-1`:

```text
intake / request.accepted → account / account.created
account / account.created → provision / provision.completed
account / account.created → provision / provision.failed
```

Handoff đang dùng `request.received` và `environment.provisioned`; hai tên này chưa được policy hiện tại hỗ trợ. Cần thống nhất producer/simulator/backend/AI trước khi duyệt mẫu. Default policy **không có cạnh Intake → Provision**, cũng chưa khai báo same-service retry. Thiếu Account phải giữ “chưa có bằng chứng”, không tự gán positive cho skip-edge. Nếu mở rộng transition/retry/branch phải version policy và cập nhật fixtures/evaluator cùng nhau.

| Tình huống | Hành vi backend hiện tại |
|---|---|
| Cùng request ID | Chỉ là bằng chứng mạnh nếu nằm cùng namespace `request`, transition/time hợp lệ và không xung đột strong ID khác; không tự động đảm bảo positive |
| Cùng user nhưng request khác | User không nằm trong strong namespaces. Nếu hai bên có request khác nhau thì strong conflict, loại cặp |
| Cùng request nhưng account khác | Namespace `account` là strong; nếu hai bên cùng có account và khác nhau thì loại cặp. Chưa hỗ trợ diễn giải account replacement thành ngoại lệ |
| Một event thiếu ID | Candidate vẫn có thể được sinh khi transition/time đúng và không conflict; rule abstain nếu không có shared strong ID. AI chỉ nên chấm khi có tín hiệu observable đủ phân biệt, mơ hồ thì unresolved |
| B sớm hơn A | Clock skew policy cho phép tối đa 5000ms. Delta giữ dấu `B.occurred_at - A.occurred_at`; quá mức thì không sinh candidate |
| Log đến trễ | Dùng occurred_at cho thời gian nghiệp vụ; received_at chỉ phản ánh nhận log. Run cũ giữ snapshot, tạo run mới để đưa event mới vào |
| Account failed, Provision success / outcome unknown | Code hiện không lọc outcome độc lập, chỉ so service/action/time/IDs. Đây chưa phải xác nhận nghiệp vụ rằng các cặp này luôn hợp lệ; cần duyệt mẫu/retry semantics trước khi gán label |

Strong namespaces hiện tại là `request`, `account`, `job`, so khớp đúng namespace và value. Tên `request_id/account_id/user_id` cần map sang Identifier DTO `{namespace,value}` theo convention dùng chung; không so value trần giữa các namespace.

## API scorer

Payload request/response trong handoff **khớp schema v1** đang có: tối đa100 pairs, 5 features, model_version/feature_schema_version và score hữu hạn trong [0,1]. AI chỉ trả score, không truy cập DB hoặc tự sửa graph/workflow. Score chưa được coi là xác suất hiệu chuẩn.

Repo backend hiện chưa gọi scorer HTTP. Hybrid đang trả `degraded=true`, `degraded_reason=ai_unavailable`, `effective_method=rule_only`, `model_version=null`. Source runtime baseline AI chưa được bàn giao vào `ai/` của checkout này và cổng local8000 chưa truy cập được ở lượt audit. Cần cung cấp source/deps pin, tests và exact startup command để xác minh baseline mô tả trong handoff; không cần gửi service secret qua tài liệu.

## Đề xuất cần hai bên chốt trước tích hợp

1. Backend chọn candidates sau ACL/redaction, tính numeric features và giữ mapping pair_id → event IDs. Chỉ dùng observable, không đưa oracle/user token/raw secrets vào service AI.
2. `delta_seconds` giữ dấu; `shared_id_count` cần chốt cách đếm namespace/ID equality và chỉ tính loại nào. `transition_allowed`/`conflicting_id` phản ánh cùng version policy; với candidates đã lọc theo policy hiện tại chúng sẽ thường là true/false cố định. Không đổi ý nghĩa feature để model có tín hiệu giả.
3. Chốt cách tính `text_similarity`. Nếu TF-IDF fit tại AI/training thì phải bàn giao vocabulary/IDF/version hoặc shared extractor có kết quả tương đương cho Node. Schema hiện chỉ truyền scalar, không truyền raw text; backend chưa có extractor này. Không fit trên validation/test hay thay bằng công thức khác khi inference.
4. Chọn threshold/margin trên validation; backend giữ cycle/ambiguity/branch guards. Model score không được ghi đè hard conflict hoặc source ACL. Candidate recall phải đo trước model recall.
5. Đề xuất timeout tổng scorer stage 5000ms theo template hiện có, có AbortSignal, không retry vô hạn. Có thể chia ≤100 pairs/call nhưng phải cùng deadline tổng; lỗi một batch thì fallback rule-only nhất quán cho run, không trộn scores từ model/schema khác nhau.
6. Backend phải kiểm exact pair_id set (không thiếu/thừa/trùng), model/schema compatibility, score hữu hạn/range và JSON/status. Timeout/malformed/unready phải degraded với reason/version thật, không giả là ML thành công. Đây là việc cần hiện thực/test, hiện chưa có adapter.
7. SCORER_SERVICE_SECRET là secret nội bộ riêng, sinh local, nằm trong ignored env/secret store, không vào browser/Git/log. Baseline local có thể dùng loopback; khi Compose thì dùng hostname service nội bộ và không publish AI ra public. Chốt lệnh chạy Node/Python và health/readiness trước demo.

24 mẫu cần có positive direct edges, same-journey nonedges, request conflict, namespace collision, missing IDs, hard negatives cùng user/gần thời gian, skew hai phía, outcome/retry không rõ và ambiguous. Mỗi mẫu ghi reason và policy/schema version. Chốt label/feature semantics trước train; split theo journey/session/template trước sinh pairs, oracle tách khỏi runtime.

Backend đã sửa redaction overflow, microsecond precision/dedup, exact time filters, pool checkout và malformed query; request nén415 và dependencies được vá. Timestamp ingest chỉ nhận instant biểu diễn chính xác tới microsecond, nonzero digits vượt6 bị reject per record; legacy millisecond hashes giữ tương thích. Dữ liệu cũ không được tự sửa/khôi phục. Source mới cần restart/rebuild container trước tích hợp. Các quyết định feature/outcome/retry nêu trên vẫn cần hai bên chốt; không tự train trên nhãn chưa thống nhất.
