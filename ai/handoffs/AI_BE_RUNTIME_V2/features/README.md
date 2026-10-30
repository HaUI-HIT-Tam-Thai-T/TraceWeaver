# AI feature handoff — sandbox-rules-1

Bộ tham chiếu để BE tính feature bằng Node và đối chiếu với Python.

- Policy: `sandbox-rules-1`.
- Extractor: `sandbox-observable-features-2`.
- Golden fixture: `sandbox-feature-conformance-2`.
- API schema: `1`, đúng 5 feature, không thêm abstain/reason vào ScoreResponse.
- Reference đã kiểm với Python 3.10.11, Unicode 13.0.0; runtime thực tế được ghi
  trong `manifest.json`.

## Tạo và gửi bundle

Từ root repository, sau khi cài dependencies theo `ai/RUN.md`:

```powershell
.\.venv\Scripts\python.exe -m ai.scripts.export_feature_handoff
```

Gửi nguyên thư mục `.local/ai-be-feature-handoff/` hoặc ZIP
`.local/AI_BE_FEATURE_HANDOFF_V2.zip`. Bundle gồm README này, `features-v2.json`,
`manifest.json`, `reference/`, hai checker và LICENSE. Event đều synthetic.
Sửa tài liệu nguồn tại `ai/FEATURE_HANDOFF.md`; exporter tái tạo README trong bundle.

42 kết quả golden được viết độc lập với extractor. Exporter dừng nếu Python tính
khác golden; manifest ghi SHA-256 của từng file. Checker Node cần adapter thật của
BE, không chứa sẵn extractor Node và không chứng nhận tích hợp đã hoàn thành.

Hàm cần đối chiếu là `extract_policy_features` trong
`reference/ai/features/sandbox_policy.py`. `pair_features.py` đi kèm cung cấp helper
text; hàm bootstrap `extract_pair_features` trong file đó dùng quy ước cũ.

## Đầu vào và công thức

Hai EventInput phải được normalize/redact và validate trước. Parser/producer map
alias trước ingest: `request_id → request`, `account_id → account`, `job_id → job`,
`user_id → user`. Extractor không tự map alias, trim hoặc đổi hoa/thường ID.
Timestamp UTC có `Z`, tối đa 6 chữ số phần giây theo quy ước ingest BE đã gửi.

| Feature | Công thức |
|---|---|
| `delta_seconds` | `(B.occurred_at - A.occurred_at)` bằng giây, giữ dấu và microsecond |
| `shared_id_count` | Kích thước giao hai tập `(namespace, value)` còn quan sát được, tính mọi namespace và bỏ trùng |
| `text_similarity` | Jaccard tập từ sau xử lý marker, NFKC và full Unicode casefold; một phía không có từ thì bằng 0 |
| `transition_allowed` | Cặp service/action thuộc đúng ba transition bên dưới, chưa gộp time/outcome/ambiguity |
| `conflicting_id` | Trong `request`, `account`, `job`, hai phía đều có giá trị và tồn tại cặp giá trị khác nhau giữa hai phía |

```text
intake/request.accepted → account/account.created
account/account.created → provision/provision.completed
account/account.created → provision/provision.failed
```

Namespace và value so sánh chính xác, phân biệt hoa/thường. Cùng value ở hai
namespace khác nhau không phải ID chung. `user` được tính vào shared count nhưng
không phải strong ID; thiếu giá trị ở một phía không tự tạo conflict. Một strong
namespace conflict không được xóa bởi ID khác chung. Với namespace có nhiều giá
trị, BE cần đối chiếu cách reference kiểm mọi cặp giá trị trước khi nhận tương đương.
Oracle, label, tên case, payload và pair ID không được dùng làm feature.

### Marker redaction

Marker chuẩn là chuỗi chính xác `[REDACTED]`, phân biệt hoa/thường:

- Identifier có value chứa marker ở bất cứ vị trí nào bị loại toàn bộ khỏi tập ID
  quan sát được, kể cả ID bị che một phần. Áp dụng với mọi namespace.
- Tập đã lọc dùng cho shared count, shared strong evidence và conflict.
- Message được thay mỗi marker bằng một khoảng trắng trước khi tách từ; không
  ghép hai từ nằm hai bên marker.
- ID bị che so với ID thật là thiếu evidence, không phải conflict. Các ID thật
  còn lại vẫn có thể cung cấp evidence hoặc conflict.

Đây là quy tắc cụ thể của feature v2 cần BE đối chiếu/tiếp nhận. Marker khác cần
fixture và version phù hợp; không tự đoán mọi từ `redacted` hay dấu `*` là mask.

### Text similarity

1. Thay marker bằng khoảng trắng.
2. Unicode NFKC, sau đó full Unicode `casefold`.
3. Tách chuỗi liên tiếp theo Python Unicode `\w+`: chữ/số Unicode và `_`.
4. Chuyển token thành tập để bỏ lặp.
5. Nếu cả hai tập không rỗng: `|A ∩ B| / |A ∪ B|`; ngược lại trả 0.

Không fit vocabulary/IDF, không dùng TF-IDF và không làm tròn trước khi gửi scorer.
JavaScript `toLowerCase()` và `\w` mặc định không tương đương đầy đủ. Fixture có
tiếng Việt tổ hợp, full-width, `Straße`, `_`, redaction và tỷ số không nguyên.

### Thời gian và guard

Không clamp delta. Guard backend dùng biên đóng `-5 ≤ delta ≤ 3600`. Fixture có
`-5.000001`, `3600.000001`; không được làm tròn về biên. JavaScript `Date` chỉ giữ
millisecond: cần giữ microsecond khi tính delta, ví dụ trừ integer microseconds
rồi chia 1_000_000.

Outcome không nằm trong 5 feature. BE giữ guard riêng: unknown luôn review;
`request.accepted`, `account.created`, `provision.completed` cần success;
`provision.failed` cần failed. Unknown/mâu thuẫn không tự thành negative label.
Reason tham chiếu là `OUTCOME_UNKNOWN`, `OUTCOME_ACTION_MISMATCH` và
`STRONG_ID_CONFLICT`; không thêm các field này vào public DTO hiện tại.

ACL, retry/cardinality và cycle cần context BE. Không dùng score để phá
`AMBIGUOUS_MATCH`; cardinality theo transition ID, không phải tổng bậc event.
Hai outcome provision hiện là hai transition riêng. AI chỉ trả điểm tham khảo;
BE quản lý unresolved/reason, đề xuất pending và người có quyền duyệt xác nhận.

## Chạy đối chiếu trong thư mục bundle

Python reference chỉ cần standard library, không cần DB/FastAPI:

```powershell
python .\check_features.py
```

BE cung cấp hàm `extractPairFeatures(left, right)` trả đúng object 5 feature.
Checker hỗ trợ CJS export function/object và ESM named/default export, cả async:

```powershell
node .\check_features.cjs .\node_extractor.cjs
```

Checker kiểm đủ key, bool/number, integer count và số hữu hạn. Tolerance delta là
`1e-9` giây, similarity là `1e-12`. Case sai in ID và trả exit code 1. Pass fixture
là điều kiện cần; vẫn phải kiểm candidate recall, guard và HTTP end-to-end riêng.

## Tương thích và phạm vi

API schema `1` không xác nhận feature/model version tương thích. Artifact đang
serve `ai/artifacts/model_v1.json` là bootstrap cũ; bundle không promote model mới.
Kết quả thử nghiệm v2 nằm trong `.local/ai-sandbox-evaluation-features-2/`.

Model v2 cũng đã train và xuất được artifact để chạy API khi chọn cấu hình riêng.
Tài liệu repo `ai/BACKEND_RUNTIME_HANDOFF.md` mô tả gói runtime có sẵn weights,
source/deps, mẫu HTTP và bundle feature này; BE không phải train lại.
Kiểm thành công runtime/probe Node vẫn chưa xác nhận extractor Node đã tương đương.

BE cần bàn giao kết quả checker với extractor thật và version đã dùng. Khi có code
BE mới, kiểm tiếp HTTP response, mapping pair IDs, deadline tổng, fallback rule-only
toàn run và audit. Chưa có kết quả nghiệm thu luồng này trong checkout hiện tại.
