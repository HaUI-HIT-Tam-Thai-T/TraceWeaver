# Chạy bản AI baseline đầu tiên

Bản này giúp thử luồng gửi feature → nhận điểm qua HTTP. Baseline dùng các luật
được viết rõ trong code; chưa có bước model học từ dữ liệu. Nó không tự gán nhãn
cho 24 ví dụ và không quyết định thay người review.

## 1. Chuẩn bị một lần

Chạy từ root repository, Python 3.10 (đã kiểm trên Windows với 3.10.11):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r ai/requirements.txt
```

Nếu đã có `.venv` tương ứng, bỏ qua bước tạo môi trường. Không cần activate
PowerShell script; dùng thẳng executable như trên. Requirements đã pin direct
và transitive dependencies. Không cần DB, Node packages, GPU hoặc model tải ngoài.

## 2. Xem demo ngay bằng một lệnh

```powershell
.\.venv\Scripts\python.exe -m ai.scripts.smoke
```

Lệnh khởi động scorer tạm trên loopback, tạo credential ngẫu nhiên trong bộ nhớ,
gửi 24 cặp synthetic và tự dừng tiến trình. Nó không đọc đáp án review.

Ví dụ output đã kiểm:

```text
Baseline HTTP smoke passed: 24 pairs; method=rule.
Example scores (heuristics, not measured probabilities): {"p-01": 0.665833, "p-09": 0.05, "p-17": 0.465833}
```

p-01 có chung ID và bước hợp lệ; p-09 có request_id mâu thuẫn; p-17 thiếu ID.
Các điểm chỉ minh họa mức ưu tiên theo luật, không phải tỷ lệ đúng đã đo. Đặc
biệt, điểm của p-17 không biến nhãn null của nó thành 0 hoặc 1.

## 3. Chạy API để backend gọi

Trong một cửa sổ PowerShell tại root:

```powershell
$env:APP_ENV = 'development'
$env:SCORER_MODE = 'baseline'
$env:SCORER_SERVICE_SECRET = .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
.\.venv\Scripts\python.exe -m ai.app
```

Mặc định bind `127.0.0.1:8000`. Dùng `SCORER_HOST`/`SCORER_PORT` nếu cần đổi.
Caller gửi cùng credential trong `Authorization: Bearer ...`; không đưa nó vào
frontend hoặc commit. API không tự load file `.env`; ví dụ trên thiết lập biến
môi trường cho cửa sổ PowerShell hiện tại.

| Endpoint | Hành vi |
|---|---|
| `GET /health/live` | 200, tiến trình hoạt động |
| `GET /health/ready` | 200 khi scorer đã sẵn sàng, 503 nếu chưa |
| `POST /internal/v1/score-pairs` | Bearer credential bắt buộc; nhận ScoreRequest, trả ScoreResponse |

Giới hạn: 1–100 cặp, body ≤1 MiB, UTF-8 JSON, pair_id không trùng, không nhận
field ngoài schema, không ép string/bool thành số. Auth sai/thiếu trả 401; JSON
lỗi trả 400; body quá lớn 413; media/encoding không hỗ trợ 415; schema lỗi 422;
scorer/output không khả dụng 503. Lỗi có request_id tương ứng X-Request-ID và
không echo input. JSON key trùng hoặc NaN/Infinity cũng bị chặn.

Success giữ đúng tập pair_id và score hữu hạn [0,1]. Trong baseline mode:

```json
{
  "model_version": "baseline-rule-v1",
  "feature_schema_version": "1",
  "predictions": [{"pair_id": "example", "score": 0.6}]
}
```

Score ở ví dụ JSON chỉ minh họa cấu trúc. Header `X-Scorer-Method: rule` phân biệt
baseline. Backend cần giữ method=rule và không ghi nhận đây là model/hybrid đã
huấn luyện. Các API reconstruction, caller, fallback và audit của backend vẫn
chưa được tích hợp trong thay đổi này.

Nếu không bật `SCORER_MODE=baseline`, service mặc định `model`: liveness 200 nhưng
readiness/scoring 503 vì chưa có trained artifact. Model mode hiện chưa có loader;
`MODEL_PATH`/`MODEL_SHA256` dành cho bước triển khai model sau. Baseline bị chặn
khi APP_ENV=production. Bộ source runtime chỉ import `ai/app`, không đọc oracle,
review hoặc dữ liệu từ `ai/training`.

## 4. Luật baseline đang dùng

- Có ID mâu thuẫn: 0.05.
- Transition không hợp lệ theo feature caller gửi: 0.10.
- Timestamp ngược: 0.25, cần review clock skew.
- Các cặp còn lại: 0.25 + 0.20 nếu có ID chung + 0.10 nếu có ít nhất hai ID
  chung + 0.20 × text similarity + 0.15 × độ gần thời gian trong một giờ.

Điểm tối đa 0.9. Đây là trọng số khởi đầu, chưa tối ưu trên nhãn đã duyệt.
shared_id_count chưa phân biệt user_id với request_id, và năm feature chưa chứa
outcome; do đó không được mặc định tự accept chỉ dựa vào điểm cao. Baseline không
đọc nội dung log để tự phát hiện những thông tin không có trong feature.

## 5. Test và license

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s ai/tests -p "test_*.py" -v
.\.venv\Scripts\python.exe -m ai.scripts.dependency_inventory --check
.\.venv\Scripts\python.exe -m pip check
```

Tests khởi động HTTP thật trên loopback và tự đóng. JSON validation tham chiếu
trực tiếp schema chung tại backend/contracts, không copy DTO sang một schema khác.
CI AI có cấu hình Windows/Linux; kết quả local không thay thế kết quả CI thực tế.

Khi cố ý thay dependency, cập nhật requirements.in + requirements.txt rồi chạy:

```powershell
.\.venv\Scripts\python.exe -m ai.scripts.dependency_inventory
```

Lệnh cập nhật [DEPENDENCIES.md](DEPENDENCIES.md) và notices từ đúng packages đã
cài trong môi trường riêng. Không thay license của thư viện thành Apache-2.0.

## 6. Bước tiếp theo

Chốt semantics nhãn/cách tính feature với backend, duyệt dữ liệu, rồi mở rộng
generator và chia tập theo hành trình. Sau đó mới train, đánh giá model và thêm
loader có checksum. Kiểm `null` được bỏ qua, label=0 được giữ và cần cả hai lớp
đã có trong `ai/training/dataset.py`; không suy ground truth từ suggested_label.
