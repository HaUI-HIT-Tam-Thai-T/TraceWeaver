# 03 — Dữ liệu, kiểm thử và bằng chứng

HaUI mục7 yêu cầu tests lõi và dữ liệu mẫu; mục8 yêu cầu origin/quyền dùng/provenance và snapshot khi nguồn ngoài không ổn định. Các case/mục tiêu chi tiết dưới đây là cách TraceWeaver nghiệm thu, không phải danh sách test hay ngưỡng đo do BTC đặt ra.

## Dữ liệu phải bàn giao

Dataset synthetic cần manifest: dataset_id/version, generator commit, nguồn/quyền sử dụng/license, parser versions, created_at UTC, counts, checksums, observable paths, split policy và nơi giữ oracle riêng. Không đưa PII/token/password thật vào dataset; dùng danh tính .test. Dữ liệu CampusDesk cũ không phải training/demo TraceWeaver.

Oracle gồm journey membership và directed expected edges, kể cả retry/branch. Observable không chứa hidden journey/scenario/split/seed target. Split theo run/journey/template trước khi sinh cặp, không random split từng cặp khiến cùng journey lọt train/test. Fit feature/vocabulary/scaler trên train; chọn thresholds/margin trên validation; giữ test khóa cho checkpoint đã chọn.

Tập demo và evaluator phải có intact/partial IDs/late/duplicate/retry/failure/ambiguous; có hard negatives cùng actor/gần thời gian. Trường hợp không còn dấu hiệu phân biệt phải unresolved. Không sửa oracle theo corruption quan sát hoặc lấy review chưa kiểm nhãn làm training truth.

Snapshot offline phải có nguồn/hash/cách tái tạo và nhãn replay; startup offline sau cache khác với build từ đầu không Internet. Chưa có generator/dataset/model/evaluation thực trong repo; schema fixtures và JWKS test không thay dataset nghiệp vụ.

## Test matrix của TraceWeaver

| ID | Tình huống | Expected | Hiện trạng |
|---|---|---|---|
| T01 | Token sai/hết hạn/signature/audience/issuer/client | 401, không payload nhạy cảm | JWT/JWKS HTTP tests; local Keycloak PKCE cũng đã kiểm |
| T02 | Workspace/event/run/case nguồn khác | 404, không leak graph/count/model | BE HTTP/DB cho artifacts; scorer chưa có |
| T03 | Thu hồi grant/group/membership, mở lại dữ liệu | Chặn dữ liệu, cursor invalid; FE bỏ cache | BE HTTP/DB tests; FE cache chưa có |
| T04 | Batch lặp / cùng ID khác nội dung | Duplicate/conflict đúng, không ghi đè | DB/HTTP tests, thêm microsecond conflict/equivalent timestamp |
| T05 | Record lỗi so với envelope/body lỗi | Reject từng record; envelope sai không ghi, body lớn413 | Đã kiểm; revalidate sau redaction; request nén415/process survival |
| T06 | Run vượt window/event limit | 422, không cắt ngầm | Unit/DB/HTTP tests |
| T07 | Log đến muộn | Run cũ giữ snapshot, run mới bổ sung | DB/HTTP tests, kể cả transaction commit trễ |
| T08 | Namespace khác nhưng ID value giống | Không nối sai | Candidate/rule unit tests |
| T09 | Ambiguous không phân biệt | Unresolved, không bịa edge | Rule unit tests; chưa evaluation dataset |
| T10 | Scorer timeout/missing/extra/duplicate pair_id/NaN | Degraded rule-only, ghi version/lý do | Score schema finite checks và absent-AI degraded có; HTTP scorer adapter/failure tests chưa có |
| T11 | Hai reviewer cùng version | Một thành công, một409 | DB/HTTP concurrency tests |
| T12 | Cycle/cross-workspace link | 422/404 theo scope, không đổi graph | DB/HTTP tests |
| T13 | Workflow action/role sai | 422/403, giữ state | Engine/DB/HTTP tests |
| T14 | Ghi audit lỗi | Rollback business write/state/history | Ingest/run/review/case/core DB/HTTP tests |
| T15 | Close thiếu evidence/reason | Guard chặn | Case/core DB/HTTP tests |
| T16 | Sửa căn cứ case closed | Chặn đến khi reopen | DB/HTTP tests với run lock và concurrent graph writes |
| T17 | Core chạy ≥2 workflow definitions | Headless, dùng cùng engine | Hai definitions qua engine/DB/HTTP; regression poolMax1 |
| T18 | Runtime/feature thấy oracle | Test isolation phải phát hiện và fail | Chưa có pipeline/runtime nghiệp vụ để kiểm |
| T19 | Build/source máy mới + offline demo/backup-restore | Chạy toàn luồng, ghi môi trường/lệnh/hash | Có nền BE smoke/clone check theo nhật ký; full hệ thống chưa có |
| T20 | KB/search/dashboard drill-down | Quyền/filter nhất quán | BE HTTP/DB và exact time bounds; FE chưa có |

Test phải bổ sung cùng module, không chờ cuối kỳ. Thất bại quyền/correctness không được đổi expected để tạo CI xanh. Nếu có deviation cần ghi phạm vi/lý do và quyết định đội; không giấu chức năng chưa triển khai bằng skip.

## Lệnh và bằng chứng hiện có

```powershell
npm.cmd run check:base
npm.cmd run licenses:check
npm.cmd test
# Cần PostgreSQL local và quyền tạo DB test:
npm.cmd run test:db
# Cần thêm Postman CLI >=1.74.0:
npm.cmd run test:identity
# Cùng assertions, native JWKS HTTP + PostgreSQL, không cần Postman; CI dùng lệnh này:
npm.cmd run test:identity:native
# Sau migrate, khởi động backend tạm và tự dừng:
npm.cmd run smoke
```

Lượt sửa audit:73 tests thường,49 DB,45 identity-native pass; base/license98packages và npm audit0. Native fixture dùng HTTP thật, JOSE/Express/PostgreSQL thật và assertions gốc; không kiểm Postman lifecycle. CI PostgreSQL đã có native identity và npm audit gate; chưa xác nhận remote run. Local Keycloak có verifier riêng. Tests giữ DB riêng sau chạy. Xem [hiện trạng](CURRENT_STATUS.md); không lấy kết quả BE thay full app E2E/AI/performance.

## Mẫu ghi một lần kiểm

| Trường | Nội dung cần điền thực tế |
|---|---|
| Commit/tag, ngày | SHA nguồn đúng với lần chạy, không chỉ branch name |
| Môi trường | OS, CPU/RAM, Node/Python/DB/deps versions, cache/network state |
| Dữ liệu/model | Manifest/version/hash/split/checkpoint/threshold |
| Lệnh | Exact command, env names không giá trị secret |
| Expected/actual | Pass/fail, counts, lỗi, output/report path |
| Giới hạn | Local/mock/live nào, case chưa có, known failures |

## Đánh giá Intelligence

Báo candidate recall trước ranker, edge precision/recall, journey contamination/exact match, unresolved/coverage và latency p50/p95; denominator0 ->N/A. Baseline/model phải cùng observable/scope/split; không cải thiện precision bằng từ chối mọi ca rồi giấu coverage. Mục tiêu precision≥95% và recall hơn baseline≥5 điểm phần trăm tại precision tương đương là mục tiêu dự án còn đề xuất, không phải số liệu đạt hoặc ngưỡng BTC.

Model/dataset card cần tên/version/library/license, nguồn/quyền data, split/hash, feature schema, threshold/margin, metrics theo slice, RAM/latency/limits và checksum artifact. Nếu AI không có lợi, ghi kết quả thật và chốt giảm miền/nghiên cứu tiếp/rule-only công khai; không gọi fallback là ML đã thành công.
