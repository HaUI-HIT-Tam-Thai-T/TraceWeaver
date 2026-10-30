# Dữ liệu review và dataset AI

Repository giữ bộ review bootstrap cũ và pipeline policy mới riêng biệt. Nguồn
nhãn, feature version và mục đích của từng bộ phải được giữ rõ khi tái tạo kết quả.
Xem [RUN.md](RUN.md) để cài môi trường và [FEATURE_HANDOFF.md](FEATURE_HANDOFF.md)
để dùng extractor theo `sandbox-rules-1`.

## Bộ review bootstrap: 24 cặp

Đây là ví dụ review theo quy ước bootstrap, không phải dataset train/test hoặc
fixture policy mới. Generator chỉ dùng standard library; toàn bộ tests cần
dependencies trong `ai/requirements.txt`.

Chạy từ root repository:

```powershell
python -m ai.training.prepare_samples
.\.venv\Scripts\python.exe -m unittest discover -s ai/tests -p "test_*.py" -v
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

## Duyệt nhãn bootstrap

1. Mở `.local/ai-bootstrap/review.json` cùng `observable.json`.
2. Nhãn 1 đã được team chốt là **cạnh trực tiếp A→B có ground truth xác nhận**;
   cùng journey chưa đủ. Quyết định này không tự duyệt từng nhãn bootstrap.
3. Đọc các ca khó trước: p-13 (account mâu thuẫn), p-18 (chỉ chung user),
   p-20 (bỏ bước), p-21 (timestamp ngược), p-22 (account failed), p-24 (unknown).
4. Sau khi thống nhất, điền `label: 1` hoặc `label: 0`, `reviewer` và `reason`.
   Giữ `null` nếu chưa đủ thông tin; không biến `null` thành nhãn âm.
5. Không tự chuyển nhãn đề xuất thành ground truth hoặc tự đổi action/namespace
   của sample cũ sang policy mới. Pipeline policy v2 bên dưới dùng dataset riêng.

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

## Quy ước bootstrap cũ

| Feature | Cách tính trong bộ ví dụ |
|---|---|
| `delta_seconds` | `B.occurred_at - A.occurred_at`, giữ dấu; không dùng thứ tự nhận log |
| `shared_id_count` | Số cặp `(namespace,value)` chung, loại trùng |
| `text_similarity` | Jaccard tập từ sau NFKC + casefold; text rỗng trả 0 |
| `transition_allowed` | Intake/request.received→Account/account.created hoặc Account/account.created→Provision/environment.provisioned |
| `conflicting_id` | Cùng namespace request_id/account_id, hai phía đều có giá trị và không có giá trị chung |

Bảng này mô tả `bootstrap-features-1`, được giữ để tái tạo model demo cũ. Policy
mới đã chốt `request.accepted`, `provision.completed`/`provision.failed`, namespace
`request`, `account`, `job` và các guard riêng. Dùng [FEATURE_HANDOFF.md](FEATURE_HANDOFF.md)
cho extractor v2. ID user chung không đủ chứng minh cạnh; similarity từ vựng chưa
phải embedding/model ngữ nghĩa.

Không có feature nào đọc nhãn, tên tình huống, pair_id hay oracle. Hàm này chưa
là parser/validator cho input production. Backend vẫn phải redact, kiểm quyền
và validate schema trước khi dùng dữ liệu thật.

## Dataset và fixture mới

| Bộ dữ liệu | Mục đích |
|---|---|
| `.local/ai-dataset/` | 713 cặp synthetic bootstrap để tái tạo artifact `ai/artifacts/` |
| `.local/ai-sandbox-rules-1-features-2/` | 120 nhóm scenario, 1920 nhãn oracle và 840 unresolved tách riêng cho đánh giá offline policy mới |
| `.local/ai-be-feature-handoff/features-v2.json` | 42 golden fixture để đối chiếu feature Node/Python, không phải tập đánh giá chất lượng model |

Các lệnh tạo từng bộ có trong [RUN.md](RUN.md). Scaler chỉ fit train, threshold
chọn validation; test dùng đánh giá. Nhãn null không đi vào supervised training,
oracle nằm ngoài feature. Chia nhóm tránh trùng event nhưng scenario templates vẫn
lặp lại giữa các nhóm; kết quả synthetic không chứng minh tổng quát hóa thực tế.

Model thử nghiệm hiện chưa tốt hơn luật hai cờ; xem [REPORT.md](REPORT.md). Không
coi việc pass fixture hoặc F1 trên synthetic là nghiệm thu backend đã tích hợp.

## License và phạm vi

Code mới dùng Apache-2.0 và có SPDX header theo CONTRIBUTING. Samples là synthetic
do code của dự án tạo; chưa thêm dependency, pretrained model hoặc dữ liệu bên ngoài.
Không commit output local hoặc đáp án review. Xem [LICENSE](../LICENSE) và
[AI contract](../backend/contracts/README.md).
