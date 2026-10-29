# AI runtime bàn giao BE — model sandbox v2 đã train

**Model đã được huấn luyện trên dữ liệu synthetic và có sẵn trong gói này.**
BE không cần train lại để kiểm API. ZIP gồm weights/scaler/manifest, source API,
schema dùng chung, dependencies pin, mẫu HTTP và feature fixture. Gói không có
dataset/oracle training, service secret hoặc phụ thuộc vào thư mục `.local` cũ.

| Thành phần | Phiên bản / đường dẫn trong ZIP |
|---|---|
| Model | `logistic-regression-sandbox-features-2-experiment-1` |
| Artifact | `model/model_sandbox_v2.json`, kèm `model/manifest.json` |
| Policy | `sandbox-rules-1` |
| Feature | `sandbox-observable-features-2` |
| API schema | `1`, giữ 5 feature |
| Công thức text | Jaccard token sau redaction, NFKC và Unicode casefold; không TF-IDF |
| Fixture | 42 golden case, checker Python/Node trong `features/` |
| Mẫu HTTP | 23 cặp feature, response kỳ vọng trong `samples/` |

Đây là model thử nghiệm, chưa được chọn làm artifact mặc định của repo. Bootstrap
`logistic-regression-v1` trong `ai/artifacts` của repo cũng đã train, nhưng dùng
semantics cũ; không dùng bootstrap để xác nhận kết quả feature v2.

## 1. Kiểm model/API sau khi giải nén

Cài Python 3.10 và dùng Node 24 theo cấu hình dự án. Mở terminal tại thư mục
`ai-be-runtime-v2` vừa giải nén, nơi có `run_scorer.py`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r ai/requirements.txt
.\.venv\Scripts\python.exe run_scorer.py --check --report verification.json
```

Trên Linux, thay `.\.venv\Scripts\python.exe` bằng `.venv/bin/python`.
Không cần DB, FE, GPU, model tải ngoài hoặc lệnh training. Cài dependencies lần
đầu cần mạng hoặc cache/wheelhouse; chưa chứng minh cài mới hoàn toàn offline.

`--check` kiểm hash các file, nạp đúng model, khởi động API tạm trên loopback,
gửi 23 cặp thật, đối chiếu score offline, gọi thêm probe Node nếu có Node, rồi
kiểm Python reference với 42 fixture. Cổng chọn tự động; script tự dừng API.

Kết quả cần thấy: `status=passed`, `checked_pairs=23`, `matches_offline_scores=true`,
đúng model version ở bảng trên và `node_http.status=passed` khi có Node. Nếu máy
không có Node, mục đó ghi `not_run_node_unavailable`; chưa coi là đã kiểm Node.

## 2. Bật service để BE gọi thử

Trong PowerShell tại thư mục gói, sinh credential cục bộ trong bộ nhớ:

```powershell
$env:SCORER_SERVICE_SECRET = .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
$env:SCORER_INTERNAL_URL = 'http://127.0.0.1:8000'
.\.venv\Scripts\python.exe run_scorer.py --serve --port 8000
```

Giữ terminal chạy; Ctrl+C để dừng. Launcher chọn trực tiếp model v2 trong gói,
không phụ thuộc `MODEL_PATH` hoặc mặc định bootstrap trong máy. Script không tự
load `.env`; credential phải có ít nhất 32 ký tự không có khoảng trắng.

Backend/probe phải nhận cùng giá trị `SCORER_SERVICE_SECRET` từ ignored env/secret
store hoặc môi trường tiến trình. Không gửi giá trị qua Git, frontend hay log.
Khi thử probe ở terminal khác, tự cấu hình cùng hai biến môi trường trên máy.

```powershell
node check_http.cjs
```

Probe Node dùng builtin fetch, gửi `samples/score-request.json`, kiểm đúng pair ID,
schema, model version, finite score và score mẫu. Nó không phải HTTP adapter đã
gắn vào reconstruction backend. URL probe chỉ nhận loopback HTTP để thử local;
deployment container cần cấu hình mạng nội bộ riêng.

## 3. Contract BE cần gọi

- `GET /health/live`: 200 khi tiến trình chạy.
- `GET /health/ready`: 200 khi loader sẵn sàng; 503 nếu model thiếu/hỏng/sai cấu trúc.
- `POST /internal/v1/score-pairs`: `Authorization: Bearer <service secret>` và
  `Content-Type: application/json`; đúng schema `1`, tối đa 100 cặp/call.
- Response có `model_version`, `feature_schema_version`, `predictions` chứa đúng
  `pair_id` và score hữu hạn `[0,1]`. Header thành công: `X-Scorer-Method: model`.
- Auth sai 401, JSON sai 400, schema sai 422, scorer không sẵn sàng 503.

BE tính feature từ event đã normalize/redact và có quyền truy cập; giữ mapping
pair ID → event IDs. Không gửi label/oracle hay user token vào scorer.

## 4. Đối chiếu extractor Node

```powershell
.\.venv\Scripts\python.exe features/check_features.py
node features/check_features.cjs <duong-dan-module-extractor-Node>
```

BE cung cấp `extractPairFeatures(left, right)` trả đúng 5 feature. Quy tắc và
tolerance trong `features/README.md`; có case Unicode, ID bị che, namespace và
biên microsecond. Pass probe Node HTTP không có nghĩa extractor Node đã pass.

## 5. Những gì đã có và giới hạn

- Đã train model, có checksum artifact/dataset/evaluation và source tái tạo trong repo.
  `model/evaluation.json` là báo cáo synthetic, không chứa oracle runtime.
- Test synthetic 288 cặp: F1 model `0.8421`, bằng luật hai cờ trên suite này.
  Các template vẫn lặp giữa split; chưa chứng minh chất lượng dữ liệu thật.
- Trọng số `text_similarity` hiện bằng 0 do feature hằng trên training synthetic;
  thay message có thể đổi feature nhưng không đổi score của model này.
- Shared count vẫn đếm mọi ID, không phân biệt user/strong ID; outcome và ambiguity
  không nằm trong 5 feature. Score cao vẫn có thể là unresolved.
- Threshold `0.20` chỉ dùng đánh giá offline, không dùng để tự nối cạnh.

BE vẫn phải giữ ACL, transition/time/strong-ID conflict, outcome, ambiguity,
cardinality/cycle; thiếu bằng chứng giữ unresolved. Score không ghi đè guard,
không chọn attempt mơ hồ, không tự xác nhận cạnh. Đề xuất cần review_state=pending.

Tích hợp reconstruction còn cần adapter thật, deadline tổng 5000ms cho mọi batch,
fallback rule-only toàn run, model version/degraded/audit đúng thực tế. Gói này
chứng minh scorer portable chạy được; không chứng nhận BE đã tích hợp hoặc SSO/DB.

## 6. Nguồn gói, tính toàn vẹn và license

Từ repo có model v2 đã xuất, chạy `python -m ai.scripts.export_runtime_handoff`.
Gói được sinh tại `.local/ai-be-runtime-v2/`, ZIP `.local/AI_BE_RUNTIME_V2.zip`.
Nếu clone mới, làm mục 7/7a trong `ai/RUN.md` để tái tạo model trước khi đóng gói.
Mỗi lần xuất chọn thư mục rỗng; không ghi đè gói đã có. Các artifact/gói sinh ra
giữ trong `.local`; source exporter và tài liệu này được quản lý trong Git.

`bundle-manifest.json` ghi hash các file và revision/dirty state lúc đóng gói.
Hash giúp phát hiện file thay đổi, không thay chữ ký/xác thực nguồn gửi. Bản gói
được tạo từ working tree chưa commit sẽ có `source_revision.dirty=true`.

Code/model synthetic của dự án theo Apache-2.0; giữ `LICENSE`, `NOTICE`,
`ai/DEPENDENCIES.md` và `ai/THIRD_PARTY_NOTICES.txt`. Dependency giữ license riêng.
