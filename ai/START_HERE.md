# Bước 1: duyệt 24 cặp sự kiện mẫu

Đây là bộ ví dụ để chốt bài toán với backend, chưa phải dataset train/test.
Chỉ dùng Python standard library, không cần cài dependency.

Chạy từ root repository:

```powershell
python -m ai.training.prepare_samples
python -m unittest discover -s ai/tests -p "test_*.py" -v
```

Output local nằm trong `.local/ai-bootstrap/` (đã được gitignore):

| File | Dùng để làm gì |
|---|---|
| `observable.json` | 24 cặp raw events synthetic theo field của EventInput |
| `score-request.json` | Request 24 cặp, chỉ có ID và năm feature theo ScoreRequest |
| `review.json` | Tên tình huống, nhãn đề xuất và chỗ ghi nhãn đã duyệt |
| `manifest.json` | Version, nguồn và checksum các file lúc sinh |

Chỉ `score-request.json` được gửi scorer. Không gửi review/manifest/metadata của
tình huống. Không mount folder offline này vào runtime; copy riêng request khi
cần smoke test. Manifest ghi hash ban đầu; review thay đổi sau khi duyệt là bình thường.
Generator từ chối ghi đè output đã tồn tại để giữ công việc review.

## Việc bạn làm ngay

1. Mở `.local/ai-bootstrap/review.json` cùng `observable.json`.
2. Chốt với backend: nhãn 1 là **cạnh trực tiếp A→B**, hay chỉ cùng hành trình?
   Bộ ví dụ đang đề xuất cạnh trực tiếp; đây chưa phải quyết định nghiệp vụ.
3. Đọc các ca khó trước: p-13 (account mâu thuẫn), p-18 (chỉ chung user),
   p-20 (bỏ bước), p-21 (timestamp ngược), p-22 (account failed), p-24 (unknown).
4. Sau khi thống nhất, điền `label: 1` hoặc `label: 0`, `reviewer` và `reason`.
   Giữ `null` nếu chưa đủ thông tin; không biến `null` thành nhãn âm.
5. Sau đó mới mở rộng dữ liệu, làm baseline và train model đầu tiên.

Baseline/API demo đã có thể chạy độc lập với việc duyệt nhãn; xem [RUN.md](RUN.md).
Chúng không tự duyệt các ví dụ. Sau khi cài dependency theo RUN.md, kiểm trạng
thái nhãn bằng lệnh chỉ đọc:

```powershell
.\.venv\Scripts\python.exe -m ai.training.dataset --request .local/ai-bootstrap/score-request.json --review .local/ai-bootstrap/review.json
```

24 nhãn null sẽ trả `reviewed: 0`, `skipped_unlabeled: 24`. Thêm
`--require-trainable` thì lệnh từ chối cho qua khi chưa có nhãn hoặc chỉ có một
lớp. Cần `reviewer` và `reason` cho mỗi nhãn đã duyệt; nhãn boolean, float hoặc
string không được tự chuyển thành 0/1. Đây là kiểm tra điều kiện tối thiểu, chưa
chứng minh dữ liệu đủ để chia train/validation/test.

Có 8 nhãn dương đề xuất, 8 nhãn âm đề xuất và 8 ca chưa quyết định. Cả 24 nhãn
thực tế đều để `null`; không dùng `suggested_label` làm ground truth tự động.
Không dùng 24 ví dụ này để tuyên bố precision/recall hoặc khả năng tổng quát hóa.

## Quy ước feature đang đề xuất

| Feature | Cách tính trong bộ ví dụ |
|---|---|
| `delta_seconds` | `B.occurred_at - A.occurred_at`, giữ dấu; không dùng thứ tự nhận log |
| `shared_id_count` | Số cặp `(namespace,value)` chung, loại trùng |
| `text_similarity` | Jaccard tập từ sau NFKC + casefold; text rỗng trả 0 |
| `transition_allowed` | Intake/request.received→Account/account.created hoặc Account/account.created→Provision/environment.provisioned |
| `conflicting_id` | Cùng namespace request_id/account_id, hai phía đều có giá trị và không có giá trị chung |

Template và quy tắc mâu thuẫn chỉ là đề xuất cho dữ liệu bootstrap. Chưa có
process template chuẩn trong repo. `transition_allowed` hiện chỉ xét loại bước;
chưa gộp điều kiện outcome hoặc timestamp. Backend cần chốt các semantics này.
User_id chung không đủ chứng minh cùng request; không tự xem user_id là ID đơn
trị của hành trình. Similarity từ vựng ở đây chưa phải embedding/model ngữ nghĩa.

Không có feature nào đọc nhãn, tên tình huống, pair_id hay oracle. Hàm này chưa
là parser/validator cho input production. Backend vẫn phải redact, kiểm quyền
và validate schema trước khi dùng dữ liệu thật.

## License và phạm vi

Code mới dùng Apache-2.0 và có SPDX header theo CONTRIBUTING. Samples là synthetic
do code của dự án tạo; chưa thêm dependency, pretrained model hoặc dữ liệu bên ngoài.
Không commit output local hoặc đáp án review. Xem [LICENSE](../LICENSE),
[AI contract](../backend/contracts/README.md) và [kế hoạch](PLAN.md).
