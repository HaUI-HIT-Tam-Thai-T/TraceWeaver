# Phản hồi BACKEND_HANDOFF — TraceWeaver Backend

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
