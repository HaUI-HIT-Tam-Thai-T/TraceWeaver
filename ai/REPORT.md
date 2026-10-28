# Báo cáo AI Scorer — TraceWeaver

Ngày cập nhật: 28/10/2026

Model artifact: `logistic-regression-v1`

API schema: `"1"`; 5 feature; điểm trả về nằm trong `[0.0, 1.0]`.

## Trạng thái hiện tại

AI scorer là một dịch vụ FastAPI độc lập, nhận các feature do caller chuẩn bị và trả
điểm cho từng cặp sự kiện. Artifact được kiểm checksum và kiểm cấu trúc trước khi
service sẵn sàng. Đây là demo có thể chạy lại với dữ liệu synthetic, chưa phải bằng
chứng mô hình đã sẵn sàng dùng trên dữ liệu nghiệp vụ thật.

## Dataset và đánh giá

Dataset synthetic có 120 journey, chia theo `journey_id` để một journey không xuất
hiện ở nhiều split:

| Split | Journey | Pairs | Dương | Âm |
|---|---:|---:|---:|---:|
| Train | 84 | 509 | 168 | 341 |
| Validation | 18 | 101 | 36 | 65 |
| Test | 18 | 103 | 36 | 67 |
| Tổng | 120 | 713 | 240 | 473 |

Trên test split, Logistic Regression và baseline đều có F1/precision/recall `1.0`.
Kết quả này **không chứng minh model tốt hơn baseline**: toàn bộ 713 nhãn synthetic
hiện khớp đúng với luật `transition_allowed AND NOT conflicting_id`. Vì vậy, chỉ số
hiện tại chứng minh pipeline chạy đúng trên dữ liệu sinh ra, không chứng minh khả
năng xử lý tình huống nghiệp vụ chưa có trong generator.

Các negative case có trong generator gồm nhảy bước `intake → provision`, thứ tự
ngược, cùng `user_id` nhưng khác `request_id`, và `account_id` mâu thuẫn.

## Benchmark đã đo

Lệnh `python -m ai.scripts.smoke_model` khởi động scorer cục bộ, đọc hết response
body, warm-up 3 request rồi đo 20 request cho mỗi batch. p95 dùng nearest-rank từ
20 phép đo hoàn tất.

Lần chạy local ngày 27/10/2026:

| Batch | p95 | Min–max |
|---|---:|---:|
| 24 pairs | 30.26 ms | 5.09–31.31 ms |
| 100 pairs | 29.87 ms | 14.45–29.98 ms |

Đây là benchmark loopback trên máy phát triển, không phải SLO production. Cần đo lại
sau khi Node backend thực sự gọi scorer và khi môi trường deploy đã được chốt.

## Hành vi và giới hạn cần nói đúng

- Scorer chỉ trả điểm. Repository hiện chưa có Node backend caller, ngưỡng
  auto-accept, hoặc hàng chờ human review. Không được trình bày các hành vi đó như
  chức năng đã hoàn thành.
- Fixture mơ hồ hiện không tự vào vùng 0.4–0.7: `p-17 = 0.929751`,
  `p-18 = 0.966629`, `p-21 = 0.966782`, `p-22 = 0.962724`. Mô hình hiện chưa có
  chính sách riêng cho thiếu ID hay clock skew.
- Checksum SHA-256 phát hiện model/dataset không đồng bộ hoặc bị sửa mà manifest
  không được cập nhật. Nó không thay thế chữ ký số hay cơ chế kiểm soát quyền ghi
  trong deployment.
- Model phải nằm cùng `manifest.json`. Artifact sai hash, sai schema, sai thứ tự
  feature, số không hữu hạn, hoặc `std <= 0` sẽ khiến scorer không ready và API trả
  `503 SCORER_UNAVAILABLE`.

## Điều cần hoàn tất trước khi coi AI là có giá trị nghiệp vụ

Team đã xác nhận policy `sandbox-rules-1`, giữ schema 1 và 5 feature. BE quản lý
unresolved/reason; shared count vẫn tính mọi ID quan sát được, strong-ID guard
độc lập. Backend Node.js cần thực thi guard (bao gồm outcome), ambiguity, cycle,
HTTP adapter và audit; chưa có nghiệm thu tích hợp trong checkout này.

## Đánh giá offline theo sandbox-rules-1 — 28/10/2026

Đây là thí nghiệm mới, không thay `ai/artifacts/model_v1.json`. Bộ bootstrap và
service demo bên trên vẫn dùng quy ước cũ. Không được coi service hiện tại đã tuân
thủ đầy đủ policy mới chỉ vì các test offline này pass.

Module `ai.features.sandbox_policy` dùng action `request.accepted`,
`account.created`, `provision.completed`/`provision.failed`; strong namespaces
`request`, `account`, `job`; cửa sổ `[-5, 3600]` giây có dấu. Hàm tham chiếu này trả
`eligible`, `rejected` hoặc `unresolved` từ event/context, không xác nhận ground
truth và không thay guard của backend.

Dataset `sandbox-oracle-scenarios-1` gồm 120 nhóm scenario độc lập, 23 case/nhóm:

| Split | Nhóm | Cặp có nhãn oracle | Unresolved loại khỏi supervised |
|---|---:|---:|---:|
| Train | 84 | 1344 | 588 |
| Validation | 18 | 288 | 126 |
| Test | 18 | 288 | 126 |
| Tổng | 120 | 1920 | 840 |

Mỗi nhóm được giữ trọn trong một split; không dùng chung event giữa các split.
`oracle.json` xác nhận cạnh và không-cạnh riêng; label không được suy từ
`transition_allowed`. Scaler fit train, threshold chọn trên validation. Đầu vào
model chỉ có 5 feature quan sát, không chứa oracle, label, category, group ID hay
cờ ambiguity. Dataset/manifest được kiểm hash và provenance trước khi train.

Kết quả trên cùng 288 cặp test có nhãn:

| Phương pháp | Precision | Recall | F1 | F1 sau lọc policy offline |
|---|---:|---:|---:|---:|
| Logistic Regression thử nghiệm | 0.7273 | 1.0000 | 0.8421 | 0.9412 |
| Baseline heuristic hiện tại | 0.7778 | 0.8750 | 0.8235 | 0.8750 |
| Luật transition và không conflict | 0.7273 | 1.0000 | 0.8421 | 0.9412 |

Baseline trong bảng là scorer cũ làm mốc so sánh, chưa phải baseline backend tuân
policy mới. Số sau lọc policy dùng event/context đầy đủ để loại vi phạm bắt buộc;
đây là mô phỏng offline, không phải tính năng đã tích hợp vào API. Report JSON còn
có metrics riêng cho 162 cặp eligible, tránh chỉ đánh giá trên các cặp dễ loại bởi
guard.

Phân tích lỗi:

- Model có 54 false positive: 18 ca vượt skew, 18 ca quá một giờ và 18 ca oracle
  xác nhận không có cạnh dù 5 feature giống ca có cạnh. Guard offline loại 36 lỗi
  thời gian; 18 lỗi còn lại cho thấy thiếu thông tin đầu vào.
- 126 ca unresolved test gồm 72 thiếu strong ID, 18 retry mơ hồ, 18 outcome mâu
  thuẫn và 18 outcome unknown. Chúng không có metric supervised. Tất cả vẫn đạt
  hoặc vượt threshold model 0.20; score không tự biểu diễn abstain.
- Model chưa tốt hơn luật hai cờ trên suite này. Không có cơ sở để quảng bá model
  là cải thiện chất lượng liên kết chỉ từ kết quả hiện tại.

Giới hạn và quyết định giữ tương thích:

- Scenario templates lặp lại giữa các nhóm; chia nhóm ngăn dùng chung event nhưng
  không chứng minh khái quát hóa sang dữ liệu thật hoặc scenario chưa thấy.
- Ca `oracle_confirmed_non_edge` là phép thử có kiểm soát về feature trùng nhau,
  không phải quy tắc nghiệp vụ mới được team duyệt hay dữ liệu thực đã review.
- Outcome `unknown` được giữ unresolved trong thí nghiệm; BE đã xác nhận quyết định
  này trong phản hồi ngày 28/10/2026.
- `shared_id_count` vẫn đếm mọi ID chung để giữ ý nghĩa contract cũ. Strong ID chỉ
  dùng trong policy tham chiếu, chưa tự đổi feature runtime thành strong-ID count.
- API schema `1` chưa có abstain/reason; BE đã chọn quản lý unresolved và reason
  ngoài scorer. Retry ambiguity cần context nhiều candidate, outcome cần event
  gốc. Giữ nguyên 5 feature, chưa promote artifact mới vào service.
- Dedup theo `(workspace_id, source_id, source_event_id)` và conflict nội dung do
  backend ingest thực thi; bài đánh giá AI không cài đặt lại dedup.

Kết quả lịch sử của bước 5 dùng feature v1 được giữ tại `.local/ai-sandbox-rules-1/`
và `.local/ai-sandbox-evaluation/evaluation.json`. Các lệnh trong mục 7 của
`ai/RUN.md` hiện tái tạo feature v2 vào thư mục riêng như phần bên dưới.

Kiểm tra sau bước 5: 49 unit/integration tests pass, smoke baseline/model và Python
license inventory pass; checksum model demo hiện tại không thay đổi.

## Bước 6 — Feature reference và handoff

`sandbox-observable-features-2` sửa lỗi coi `[REDACTED]` là bằng chứng: value ID chứa
marker bị loại khỏi shared count, shared strong evidence và conflict; marker trong
message được thay bằng khoảng trắng trước khi tính Jaccard. Các giá trị ID thật
còn lại vẫn được giữ nguyên. Reference đồng bộ reason `OUTCOME_UNKNOWN` và
`STRONG_ID_CONFLICT` để BE tiếp nhận, không thêm field vào public DTO.

42 golden fixture độc lập phủ ID/namespace, redaction, Unicode casefold/NFKC,
Jaccard, action chuẩn, outcome tách khỏi feature và biên thời gian tới microsecond.
Bundle tại `.local/ai-be-feature-handoff/` có checker Python/Node, bản tham chiếu,
README và hash; README được tái tạo từ [FEATURE_HANDOFF.md](FEATURE_HANDOFF.md).
Chưa có kết quả đối chiếu với extractor thật của BE.

Dataset/report v2 được sinh vào `.local/ai-sandbox-rules-1-features-2/` và
`.local/ai-sandbox-evaluation-features-2/`. Pipeline offline đã chạy lại để khớp
version; giữ nguyên nhãn, oracle và scaler-fit/threshold-selection split. F1 trên
288 test pairs vẫn là model 0.8421, baseline cũ 0.8235 và luật hai cờ 0.8421.
Dataset/report feature v1 ở các đường dẫn ghi trong mục bước 5 được giữ làm lịch sử.

Demo local được cập nhật với kết quả trước/sau cho redaction. Bước 6 chưa bao gồm
Node HTTP adapter, guard runtime hay nghiệm thu đầu-cuối ở bước 7.

Kiểm tra cuối bước 6: 56 tests pass, Python reference pass 42/42 golden fixture,
demo khớp 24/24 trạng thái mong đợi; smoke baseline/model, dependency/license và
pip check pass. ZIP handoff có 8 file đã kiểm hash. Chưa chạy extractor thật của BE;
artifact model đang serve giữ nguyên checksum.
