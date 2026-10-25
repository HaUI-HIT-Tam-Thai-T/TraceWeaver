# 02 — Bàn giao và tích hợp BE / FE / AI

Phạm vi TraceWeaver do dự án chọn; đối chiếu yêu cầu BTC ở [01](01-DOI-CHIEU-DE-THI.md). Tài liệu này để các thành viên tự làm phần của mình. Người dùng hiện phụ trách BE; không coi việc có docs là FE/AI đã được triển khai.

## 1. Nguồn chung và tình trạng chạy

- [INSTALL](../INSTALL.md): lệnh Node/npm/PostgreSQL/Compose đã có. Không chia sẻ .env/token/private key; mỗi máy tạo secrets riêng.
- [OpenAPI](../backend/contracts/openapi.json), [schema](../backend/contracts/schemas/domain.schema.json), [fixtures](../backend/contracts/fixtures/valid.json): DTO/enum/error/limits dùng chung. Fixtures là map theo tên schema, không phải response đã lấy từ app.
- [Identity BE](../backend/IDENTITY.md): issuer/audience/azp, Bearer access token, quyền DB và CURSOR_SECRET. Chưa có demo user hoặc Keycloak chạy thật; membership/grants không tự sinh khi login.
- [frontend](../frontend/README.md), [ai](../ai/README.md), [simulator](../simulator/README.md) mới là skeleton; chưa có lệnh build/run cho những module đó. Không chạy lệnh tưởng tượng hoặc coi chúng là đã tích hợp.

| API | Hiện trạng | FE/AI dùng thế nào |
|---|---|---|
| GET /health/live, /health/ready | Đã chạy; ready kiểm DB/migration | Kiểm backend, không thay việc login hoặc kiểm IdP |
| GET /api/v1/me | Implemented, JWT/JWKS + DB | Lấy subject, memberships, roles/group_ids theo workspace |
| GET /api/v1/workspaces/{wid}/sources | Implemented, direct/group read grants | Nguồn được phép; admin không mặc định có mọi nguồn |
| GET /api/v1/workspaces/{wid}/knowledge | Implemented, latest article version | Workspace knowledge và q/limit/cursor |
| Events/ingest/runs/graph/reviews/cases/dashboard | Planned | Có thể làm giao diện với fixtures theo contract, đánh dấu mock rõ; chưa gọi như API thật |
| /core/v1/instances và transitions | Implemented BE-22, service nội bộ | App JWT riêng + original user JWT được verify độc lập, current DB membership/role/source scope; hai definitions chạy qua API, dùng chung case guards/run lock. Cần provision core client/subject; xem backend/WORKFLOW.md; không gọi trực tiếp từ browser |
| POST /internal/v1/score-pairs | Planned, service nội bộ | AI hiện thực response contract; BE tích hợp sau, không expose secret ra FE |

Mỗi lần đổi schema/field/enum/status phải cập nhật consumer và fixtures trong cùng thay đổi. Chỉ chuyển operation sang implemented khi handler/quyền/tests thực sự có.

## 2. Phần BE cần tiếp tục

1. Ingest ba parser định trước, redaction, batch validation, duplicate/conflict, provenance và event search/cursor.
2. Workflow core dùng chung, definition/version, guard/owner/history/audit transaction; chứng minh reuse bằng definition thứ hai là cách dự án chọn.
3. Run snapshot/job, rule baseline/candidate filtering theo quyền, graph/evidence và unresolved.
4. Scorer adapter với timeout/schema/version/exact pair IDs; degraded rule-only có lý do, không giả kết quả AI.
5. Review append-only/version conflict, case/evidence/verification/reopen, dashboard đúng scope.
6. Identity thật/SSO integration cùng FE, test quyền trên mọi artifact, source build/backup/restore và tài liệu vận hành.

BE lọc quyền trước candidate/scorer và kiểm lại artifact khi grant bị thu hồi. AI chỉ trả score, FE chỉ hiển thị/hỏi thao tác; hai bên không tự ghi DB hoặc đổi workflow state.

## 3. Phần FE cần làm

| Gói | Kết quả cần bàn giao | Phụ thuộc |
|---|---|---|
| FE-1 | Khởi tạo React/routing/config HTTP; README/manifest/lock/lệnh chạy | Chốt workspace/toolchain, không thêm secret browser |
| FE-2 | Login Code + PKCE với IdP; workspace/sources/knowledge | Issuer/client/audience/token thật, ba API đọc đã có |
| FE-3 | Explorer và xem provenance, chọn root; graph/timeline có bảng thay thế | Events/runs contract; fixtures trước API thật |
| FE-4 | Review/case board/detail, owner/history/evidence, action hợp lệ | BE workflow/review/case APIs |
| FE-5 | Dashboard drill-down, kiểm keyboard/mobile/errors, tích hợp E2E | Counts/filter/quyền thật từ BE |

Không chỉ dùng màu: event outcome/review/degraded cần text/icon. Loading/empty/queued/running/failed/unknown là các trạng thái khác nhau. Không vẽ link AI thành quan hệ nhân quả chắc chắn hoặc coi run completed là yêu cầu nghiệp vụ thành công.

401 xử lý phiên/token; 403 không cho action; 404 không đoán tài nguyên có tồn tại; 409 tải thay đổi để người dùng xem trước khi gửi lại; 429 tôn trọng Retry-After. Khi mất quyền phải bỏ cache payload/artifact liên quan; không giữ dữ liệu nguồn nhạy cảm trong localStorage. 503 của Identity/core không được hiển thị như AI degraded: degraded nghiệp vụ chỉ do run response xác nhận.

Bàn giao FE: source + lock, env.example không secret, exact commands, ảnh/flow thật, case empty/error/permission/409, E2E evidence và license inventory của deps mới. Không chỉ nộp ảnh/mock như sản phẩm đã chạy.

## 4. Phần AI cần làm

| Gói | Kết quả cần bàn giao |
|---|---|
| AI-1 | Cùng simulator/BE định nghĩa directed expected edges, split policy, candidate/rule baseline và evaluator trước model |
| AI-2 | Pin Python/deps/license; feature schema/extractor và model prototype trên observable, không oracle |
| AI-3 | Scorer service theo contract, kiểm schema/version/score hữu hạn, không DB access |
| AI-4 | Baseline/model trên split khóa, metrics/coverage/ablation, model card/checksum và hướng dẫn tái tạo |

Schema request hiện là numeric features, không phải raw log text:

```json
{"schema_version":"1","pairs":[{"pair_id":"p1","features":{"delta_seconds":2,"shared_id_count":0,"text_similarity":0.63,"transition_allowed":true,"conflicting_id":false}}]}
```

Response gồm model_version, feature_schema_version=1, predictions chứa đúng pair_id và score hữu hạn [0,1]; tối đa100 cặp. Sai feature/schema ->422 cả batch; model chưa ready ->503. BE kiểm không thiếu/thừa/trùng pair_id và xử lý fallback. Score chưa được gọi là xác suất đã hiệu chuẩn.

AI và BE cần chốt ai tính TF-IDF/text_similarity và cách chia sẻ feature/model version trước khi code tích hợp; không fit vocabulary/scaler trên test hoặc tự đổi API sang raw text. Logistic regression + TF-IDF là phương án dự án, không phải model BTC bắt buộc.

Bàn giao AI: source/deps lock, feature schema/version, model artifact do pipeline tạo/checksum, dataset manifest/hash/splits, thresholds/margin chọn trên validation, metrics thật/giới hạn/RAM/latency, model/data/library license. Không gửi pickle/joblib nguồn không tin cậy hoặc oracle vào runtime.

## 5. Phần simulator/dữ liệu cần làm

Tạo intake/account/provision, fault nghiệp vụ khác corruption quan sát. Có ca success/failure, same actor gần thời gian, partial IDs, ambiguous không phân biệt, late log, duplicate batch, retry mới, ID conflict, malformed/secret mẫu. Cần một phiên live từ dịch vụ mẫu và fixture replay rõ nhãn; không cấp VM/tài nguyên thật. Người phụ trách thực tế cần đội xác nhận, không mặc định người dùng BE phải làm toàn bộ generator/training.

Observable dùng app/demo; oracle chứa membership+directed edges cho evaluator riêng. Xem [dữ liệu/kiểm thử](03-DU-LIEU-KIEM-THU-MINH-CHUNG.md). Oracle không mount vào API/scorer, không mã hóa trong ID/path/features.

## 6. Thứ tự tích hợp thực tế

BE/FE trước hết kiểm token thật → me → workspace → sources/knowledge. Sau đó observable → ingest → explorer → rule run. Khi baseline/evaluator có bằng chứng mới nối scorer, rồi review → case → verification → dashboard. Cuối cùng chạy toàn luồng/máy mới/offline demo, tổng hợp [hồ sơ](04-DEMO-VA-HO-SO-NOP.md). License/secret/docs cập nhật mỗi thay đổi, không dồn hết cuối kỳ.
