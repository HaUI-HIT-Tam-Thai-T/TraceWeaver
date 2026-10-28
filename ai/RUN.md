# Chạy và kiểm thử AI scorer

Repository có hai luồng riêng: API demo bootstrap dùng baseline hoặc model JSON
đã train, và pipeline offline theo `sandbox-rules-1` với feature v2. Pipeline mới
chưa thay artifact API đang nạp. Scorer trả điểm, không tự tạo/xác nhận cạnh hoặc
gán nhãn cho các ví dụ review.

Đọc [README.md](README.md) để xem phạm vi, [REPORT.md](REPORT.md) để xem kết quả và
[FEATURE_HANDOFF.md](FEATURE_HANDOFF.md) để đối chiếu feature với BE.

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

Chạy thử model bootstrap đã train:

```powershell
.\.venv\Scripts\python.exe -m ai.scripts.smoke_model
```

Lệnh khởi động service ở chế độ `model`, kiểm tra toàn vẹn SHA256 của file artifact `ai/artifacts/model_v1.json`, gửi 24 cặp mẫu, rồi benchmark loopback cho batch 24 và 100. Mỗi batch warm-up 3 request và đo 20 request sau khi đọc hết response body; script in p95, min và max của lần chạy hiện tại.

Chạy thử baseline bootstrap theo luật heuristic:

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

## 3. Tái tạo artifact bootstrap (tùy chọn)

Các lệnh sau sinh lại dataset bootstrap rồi train và **ghi đè** model/manifest
trong `ai/artifacts`. Không cần chạy chúng chỉ để xem smoke demo.

```powershell
# 1. Sinh 120 hành trình (713 cặp), chia tập Train/Validation/Test theo journey_id
.\.venv\Scripts\python.exe -m ai.training.generate_dataset

# 2. Huấn luyện Logistic Regression và xuất artifact + SHA256 checksum
.\.venv\Scripts\python.exe -m ai.training.train
```

Model artifact được lưu tại `ai/artifacts/model_v1.json` và manifest tại `ai/artifacts/manifest.json`. Nếu đặt `SCORER_MODEL_PATH` ở thư mục khác, cần đặt `manifest.json` tương ứng cùng thư mục với model.

## 4. Chạy API bootstrap

Trong một cửa sổ PowerShell tại root:

Chạy ở chế độ model (mặc định):

```powershell
$env:APP_ENV = 'development'
$env:SCORER_MODE = 'model'
$env:SCORER_SERVICE_SECRET = .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
$env:SCORER_MODEL_PATH = 'ai/artifacts/model_v1.json'
.\.venv\Scripts\python.exe -m ai.app
```

Hoặc chạy baseline bootstrap trong development/test:

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
| `GET /health/ready` | 200 khi scorer đã sẵn sàng (model hợp lệ hoặc baseline), 503 nếu hỏng/thiếu |
| `POST /internal/v1/score-pairs` | Bearer credential bắt buộc; nhận ScoreRequest, trả ScoreResponse |

Giới hạn: 1–100 cặp, body ≤1 MiB, UTF-8 JSON, pair_id không trùng, không nhận
field ngoài schema, không ép string/bool thành số. Auth sai/thiếu trả 401; JSON
lỗi trả 400; body quá lớn 413; media/encoding không hỗ trợ 415; schema lỗi 422;
scorer/output không khả dụng 503. Lỗi có request_id tương ứng X-Request-ID và
không echo input. JSON key trùng hoặc NaN/Infinity cũng bị chặn.

Khi chạy `model`, response trả `model_version: "logistic-regression-v1"` và header `X-Scorer-Method: model`.
Nếu file model bị thiếu, bị sửa đổi hoặc hash SHA256 không khớp với manifest, API sẽ tự động chuyển sang trạng thái 503 `SCORER_UNAVAILABLE` để bảo vệ an toàn (không âm thầm trả baseline giả dạng model).

## 5. Luật baseline đang dùng

- Có ID mâu thuẫn: 0.05.
- Transition không hợp lệ theo feature caller gửi: 0.10.
- Timestamp ngược: 0.25, cần review clock skew.
- Các cặp còn lại: 0.25 + 0.20 nếu có ID chung + 0.10 nếu có ít nhất hai ID
  chung + 0.20 × text similarity + 0.15 × độ gần thời gian trong một giờ.

Điểm tối đa 0.9. Đây là mốc so sánh bootstrap; chưa phải fallback backend đã tuân
thủ policy mới. Shared count không phân biệt user với strong ID, năm feature chưa
chứa outcome/ambiguity; không tự accept chỉ vì score cao. Baseline bị chặn trong
`APP_ENV=production`.

## 6. Test và license

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s ai/tests -p "test_*.py" -v
.\.venv\Scripts\python.exe -m ai.scripts.dependency_inventory --check
.\.venv\Scripts\python.exe -m pip check
```

Tests khởi động HTTP thật trên loopback và tự đóng. Test checker Node chạy khi có
Node khả dụng; CI cài Node 24.14.1 để kiểm tra phần này. CI Windows/Linux còn chạy
cả hai smoke và tái tạo bundle handoff. Kết quả local không thay thế CI trên remote.

Khi chủ động đổi dependency, cập nhật cả requirements.in và requirements.txt, sau
đó chạy `python -m ai.scripts.dependency_inventory` trong môi trường riêng khớp
requirements. Danh mục và notices ghi license riêng của từng thư viện.

## 7. Đánh giá offline theo policy sandbox-rules-1

Đây là pipeline thử nghiệm dùng policy team đã chốt ngày 27/10/2026. Chạy từ root:

```powershell
.\.venv\Scripts\python.exe -m ai.training.sandbox_dataset
.\.venv\Scripts\python.exe -m ai.training.evaluate_sandbox
```

Lệnh đầu sinh dataset feature v2 trong `.local/ai-sandbox-rules-1-features-2`, gồm 120 nhóm scenario,
1920 cặp có nhãn oracle và 840 ca unresolved tách riêng. Các nhóm không giao nhau
giữa train/validation/test. `policy_version`, `feature_version` và SHA-256 được ghi
trong manifest; oracle nằm ngoài feature model.

Lệnh sau kiểm hash/provenance, train Logistic Regression thử nghiệm và so với
baseline cũ cùng luật hai cờ trên một test set. Kết quả theo nhóm, score của ca
unresolved và tham số thí nghiệm nằm trong `.local/ai-sandbox-evaluation-features-2/evaluation.json`.
Pipeline này không ghi vào `ai/artifacts` và không thay model service đang nạp.

Đọc `ai/REPORT.md` để hiểu kết quả và giới hạn. Contract API vẫn là schema `1`;
BE đã chọn quản lý unresolved/reason, giữ 5 feature và nghĩa shared count mọi ID.
Guard và adapter runtime phía BE vẫn cần kiểm tra khi tích hợp.

## 8. Xuất bộ fixture bàn giao feature cho BE

```powershell
.\.venv\Scripts\python.exe -m ai.scripts.export_feature_handoff
.\.venv\Scripts\python.exe .local/ai-be-feature-handoff/check_features.py
```

Bundle được tạo tại `.local/ai-be-feature-handoff/`; ZIP tại
`.local/AI_BE_FEATURE_HANDOFF_V2.zip`. Gồm 42 golden fixture, Python reference,
checker Python/Node, LICENSE và manifest SHA-256. README được tái tạo từ
[FEATURE_HANDOFF.md](FEATURE_HANDOFF.md), kể cả trên checkout mới chưa có `.local`.

Feature `sandbox-observable-features-2` loại value ID chứa `[REDACTED]` khỏi evidence
và loại marker khỏi token văn bản. Dataset/report feature v1 cũ được giữ riêng.
Đây là bộ tham chiếu để BE đối chiếu, không tự thay artifact bootstrap đang serve.

## 9. Ranh giới tích hợp hiện tại

BE đã chốt quản lý unresolved/reason, guard và quyết định đề xuất pending; AI chỉ
trả score. Checkout hiện chưa có extractor/HTTP adapter BE mới. Cần đối chiếu
fixture với Node thật rồi kiểm mapping pair IDs, deadline tổng, fallback toàn run
và audit trước khi nghiệm thu luồng BE → AI. Kế hoạch cá nhân và output sinh ra
giữ trong `.local`; chỉ source, artifact bootstrap và tài liệu kỹ thuật vào Git.
