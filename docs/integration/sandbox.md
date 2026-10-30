# Bàn giao FE — Simulator và kiểm chứng hồ sơ

Cập nhật 31/10/2026 sau triển khai BE/simulator mới. Contract giữ tương thích DTO cũ; runtime `a38c380`
đã triển khai tại `https://api.quizlearn.tech`. Xem thêm [bàn giao quản trị FE](workspace-admin.md).
Đây là phần mở rộng xử lý/kiểm chứng nghiệp vụ; AI vẫn chỉ chấm điểm liên kết sự kiện.

**Bản sửa hiệu lực kiểm chứng đã triển khai server (`a38c380`):** `source_version` vẫn là version
toàn sandbox để gửi lệnh. Tạo/sửa/chạy yêu cầu khác không tự làm mất hiệu lực một yêu cầu đã đạt.
Sửa image/account của chính yêu cầu hoặc thay tổng RAM thực sự vẫn bắt buộc chạy lại; sửa cùng giá trị
không làm mất hiệu lực. Kết quả lỗi cần chạy lại nếu RAM khả dụng đổi do yêu cầu khác giữ chỗ.
Không thêm field bắt buộc hay đổi DTO. BE/simulator đã được triển khai cùng nhau; không cần migration mới.
Các snapshot cũ đã stale vẫn giữ nguyên cho đến khi thực thi lại; không tự đổi kết quả hoặc mở lại hồ sơ.
FE branch `frontend/fix-sandbox-status` đã sửa đối chiếu proof/hướng dẫn, giữ riêng với nhánh BE;
việc push nhánh FE không đồng nghĩa giao diện production đã được triển khai.

## 0. Contract để FE triển khai ngay

Đối chiếu source BE `a38c380`: case-repository.sandbox/verify/verifications, lab-repository,
case-verification và simulator/lab-state. [OpenAPI đang phục vụ](https://api.quizlearn.tech/docs/openapi.json)
là hợp đồng schema; các mục4–5 bên dưới mô tả DTO, JSON body, replay và errors chi tiết.
Không gọi lại API chạy tái dựng để thay cho simulator. Không cần API mới cho luồng sandbox này.

### Các nguồn dữ liệu phải tách riêng

| Dữ liệu | Lấy ở đâu | Dùng làm gì |
|---|---|---|
| Case state/owner/version | GET `/api/v1/workspaces/{wid}/cases/{cid}` | Workflow và quyền đóng/mở theo trạng thái |
| Binding, conditions, latest attempt, attempts, environment, delivery | GET `.../cases/{cid}/sandbox` | Trạng thái nguồn hiện tại và lịch sử thực thi |
| Kết quả thao tác provision vừa gửi/replay | `execution` trong response POST sandbox commands | Đối chiếu đúng operation_id; có thể khác latest attempt hiện tại |
| Proof reviewer đã lưu | GET `.../cases/{cid}/verifications` | Snapshot kiểm chứng bất biến; không thay thế quan sát nguồn mới |
| Timeline/graph của run | API run/graph hiện có | Phân tích log snapshot; không tự cập nhật thành snapshot mới sau simulator rerun |

GET sandbox trả `{case_id,case_version,observation}`. POST commands trả cùng envelope; provision có
thêm `execution:{replayed,operation_id,attempt}`. Conditions là hiện tại; attempts là lịch sử.
GET verifications trả `{case_id,case_version,items}` theo thứ tự cũ đến mới; không phân trang.
POST verifications trả201 một proof, không tự đóng case. Proof observation có thể chỉ có result/reason
khi inconclusive; không bắt buộc conditions/attempts trong mọi response, không biến thiếu dữ liệu thành passed.

### Version và khóa chống trùng

| Trường gửi | Nguồn phải lấy | Phạm vi |
|---|---|---|
| Command.expected_case_version | GET sandbox.case_version | Case workflow hiện tại |
| Command.expected_version | GET sandbox.observation.source_version | Toàn sandbox workspace, không riêng request |
| Transition.expected_version | Case.version mới nhất | Giao/nhận/chờ xác minh/đóng/mở case |
| Provision.operation_id | FE sinh UUID cho một ý định chạy | Dùng lại khi retry đúng ý định; không dùng Idempotency-Key để thay trường này |
| Transition.Idempotency-Key | Cơ chế workflow hiện có | Cùng key/body khi retry trong24giờ; khác cơ chế simulator |

Commands không tăng Case.version; workflow tăng Case.version. Không tự cộng bất kỳ version nào.
Một request khác hoặc lệnh sửa cùng giá trị vẫn có thể tăng source_version để chống ghi đè,
nhưng không tự làm attempt/proof cũ stale theo bản sửa source ở trên.
Vì vậy attempt.result=failed hoặc passed trong lịch sử không quyết định observation.result hiện tại.
`inconclusive/RERUN_REQUIRED` sau thay đổi nguồn là yêu cầu thực thi mới, không phải lỗi schema FE.
FE không dùng riêng `proof.observation.source_version !== observation.source_version` để kết luận proof
hết hiệu lực. Đối chiếu case_version, checker_version, request_id, attempt.id, attempt.source_version,
environment.id, kết quả hiện tại và chuyển log; BE vẫn là nơi quyết định cuối cùng khi đóng.
Snapshot cũ đã stale theo chính sách trước không tự trở thành đạt; chạy lại để có bằng chứng mới.

### Retry bắt buộc

| Tình huống | Hành vi FE |
|---|---|
| Provision timeout/network/5xx | Giữ command/operation_id; GET sandbox đối chiếu attempts. Người dùng retry cùng operation_id, không tự tạo lần chạy mới |
| Replay provision | Xem execution.attempt của ID đó và observation hiện tại riêng; replay không tạo thêm attempt/log nguồn |
| Sửa RAM/image/account timeout | GET đối chiếu conditions/version; không tự POST lại hoặc coi timeout là failed nghiệp vụ |
| POST proof timeout | GET history; không tự POST lại vì không có bảo đảm chống trùng proof |
| 409 version conflict | Đọc lại case/sandbox, hiển thị thay đổi và yêu cầu xác nhận; không tự sửa version rồi ghi mù |
| Delivery pending | Chỉ poll GET có giới hạn; dừng khi rời scope, không poll command/proof |
| Scope đổi/logout | Abort và bỏ response cũ; abort không bảo đảm server chưa thực hiện |

Idempotency provision chỉ bảo đảm không lặp execution/log nguồn; case-bound command vẫn có thể ghi
audit thao tác khi replay. Trước mọi command, BE vẫn kiểm quyền, expected_case_version và case chưa đóng.
Không coi cùng operation_id là quyền bỏ qua các guard đó. Proof từng đạt nhưng case version đổi,
điều kiện liên quan đổi, có attempt mới, reopen hoặc delivery chưa đủ không được FE tự gắn nhãn đủ
điều kiện đóng; BE kiểm lại trong transaction. Chênh global source_version đơn thuần không đủ kết luận.

## 1. Phạm vi FE cần làm

Thêm khu vực **Kiểm chứng nghiệp vụ mô phỏng** trong chi tiết hồ sơ hiện có:

1. Đọc yêu cầu và điều kiện hiện tại từ BE.
2. Admin sửa RAM/image/tài khoản; operator hoặc reviewer chạy lại.
3. Xem lịch sử từng lần chạy, bước còn lỗi và trạng thái chuyển log.
4. Reviewer lưu kiểm chứng nguồn, xem lịch sử rồi dùng workflow đóng hồ sơ hiện có.

Không thêm AI, quản trị tài khoản/nhóm tổng quát, VM/registry/mạng thật hoặc chức năng xóa/reset.
Tài khoản được kích hoạt ở đây là **tài khoản nghiệp vụ mô phỏng**, không phải tài khoản Keycloak.
Không dùng ghi chú, state tự đặt ở FE hoặc nút xác nhận để thay kết quả thực thi của BE.

## 2. Môi trường bàn giao

| Mục | Giá trị |
|---|---|
| API origin | `https://api.quizlearn.tech` |
| API prefix | `/api/v1` |
| Swagger | [API docs](https://api.quizlearn.tech/docs/) |
| Workspace | `10000000-0000-4000-8000-000000000016` |
| Tên | `TraceWeaver Sandbox — Mô phỏng kiểm chứng` |
| Hồ sơ đã kiểm thành công | `17d4a82d-98a1-4d51-b09b-56ab3f2135d3` — đã đóng, dùng để xem lịch sử |
| Mã yêu cầu tương ứng | `REQ-20261030-103` |
| BE runtime | `traceweaver-api:be-1b6a72e`, migrations001–011, collector đã bật |

Dữ liệu cũ đã được người dùng yêu cầu thay ngày30/10. Các ID LAB-LIVE/BE51 trong tài liệu lịch sử
không còn dùng để gọi API. Bộ mới để FE chọn đúng hồ sơ:

| Request | Case ID | Trạng thái khi tạo | Tình huống |
|---|---|---|---|
| `REQ-20261030-101` | `6dfedae9-7fe7-4f7c-abb1-83424c2101b1` | investigating | Cần8GB RAM, image chưa khả dụng, tài khoản inactive |
| `REQ-20261030-102` | `f8ea7759-47db-48d0-9184-60c54c8dd69a` | new | Cần2GB RAM, image chưa khả dụng |
| `REQ-20261030-103` | `17d4a82d-98a1-4d51-b09b-56ab3f2135d3` | closed | Đã passed/delivered, có proof reviewer để xem |

Đây là snapshot bàn giao, không hardcode trạng thái/version/conditions vào ứng dụng.
101/102 có attempt failed nhưng có thể trả RERUN_REQUIRED vì sandbox dùng version chung;
đọc GET mới trước thao tác. Tổng RAM lúc tạo bộ mới là4GB, yêu cầu103 giữ2GB; đọc trạng thái thật
ở GET `/lab` thay vì dùng số này như giá trị cố định. Trạng thái có thể thay đổi khi người dùng thao tác.

Dùng SSO/PKCE hiện có. BE đã cấp quyền riêng trong workspace này cho các tài khoản operator,
reviewer, workspace-admin và viewer hiện có. Không đưa mật khẩu, access/refresh token hoặc service
credential vào tài liệu, source hay biến VITE. Credentials được xem/bàn giao riêng trên server.
Workspace/IDs trong bảng chỉ dùng để UAT; mã ứng dụng vẫn lấy workspace từ lựa chọn hiện tại.

## 3. Quyền và vị trí UI

Mọi thao tác cần active membership và quyền đọc đủ nguồn liên quan; role đơn lẻ chưa đủ.
Lấy roles từ `/api/v1/me`, không tự tin role claims trong JWT.

| Thao tác | viewer | operator | reviewer | admin đơn thuần |
|---|---|---|---|---|
| Xem sandbox/lịch sử/proof | Có | Có | Có | Có |
| Chạy lại `provision` | Không | Có | Có | Không |
| Sửa `capacity`/`image`/`account` | Không | Không | Không | Có |
| Lưu kiểm chứng nguồn | Không | Không | Có, khi awaiting_verification | Không |
| Đóng/mở lại hồ sơ | Không | Không | Theo workflow/guard | Không |

**Admin cần thấy phần sửa dù `permissions.canWrite` hiện tại là false.** Đừng đặt toàn bộ panel mới
bên trong điều kiện chỉ dành cho operator/reviewer. Có nhiều role thì hợp quyền từng thao tác.
Các thao tác trên không đổi role/password của người đăng nhập.

## 4. Endpoint cần tích hợp

Các đường dẫn dưới đây sau origin; dùng client HTTP/refresh token hiện có.
POST phải `Content-Type: application/json`; không có query/pagination cho các endpoint sandbox/proof.

| Method | Path | Thành công |
|---|---|---|
| GET | `/api/v1/workspaces/{wid}/cases/{cid}/sandbox` | 200: case binding, điều kiện, attempts, latest attempt, delivery |
| POST | `/api/v1/workspaces/{wid}/cases/{cid}/sandbox/commands` | 200: snapshot mới, thêm execution khi provision |
| GET | `/api/v1/workspaces/{wid}/cases/{cid}/verifications` | 200: `{case_id,case_version,items}` |
| POST | `/api/v1/workspaces/{wid}/cases/{cid}/verifications` | 201: proof mới; body **`{}`** |
| POST | `/api/v1/workspaces/{wid}/cases/{cid}/transitions` | 200: workflow hiện có, gồm verify_close/verification_failed/reopen |
| GET | `/api/v1/workspaces/{wid}/lab` | 200: sandbox `version`, tổng `ram`, requests và events; tùy chọn để xem dung lượng chung |

Case-bound API tự tìm request từ root event đã ingestion từ sandbox. FE không chọn request khác.
Root từ dataset sinh sẵn hoặc mã yêu cầu trùng với sandbox chưa đủ để tạo binding.

### Đọc trạng thái

Ví dụ rút gọn, số phiên bản/UUID chỉ minh họa, không copy vào request thật:

```json
{
  "case_id": "f10e80e1-7972-4b4f-856b-155c6d9f4ced",
  "case_version": 4,
  "observation": {
    "source": "lab-sandbox",
    "simulated": true,
    "checker_version": "lab-state-2",
    "source_version": 7,
    "request_id": "LAB-001",
    "result": "inconclusive",
    "reason": "NOT_EXECUTED",
    "conditions": {
      "required_ram": 4,
      "image_id": "lab-image-LAB-001",
      "account_id": "lab-account-LAB-001",
      "image_available": false,
      "account_active": false
    },
    "attempts": [],
    "attempt": null,
    "environment": null,
    "delivery": {"status": "pending", "total": 0, "delivered": 0}
  }
}
```

Ví dụ trên là yêu cầu chưa có lần chạy; khi chạy thật, `failed` có latest `attempt` và lịch sử tương ứng.
`attempt` gồm `id`, `operation_id`, `number`, `at`, `source_version`, `checker_version`, `result`,
`reason`, `blockers`, `checks`, `required_ram`, `available_ram`, image/account IDs và booleans lúc chạy.
`checks` có ba phần tử `{step,passed,reason}`, step là `ram`, `image`, `account`.
Chỉ hiển thị reason của check như lỗi khi `passed === false`; reason ở check đạt vẫn là mã điều kiện.
Đây là ba kiểm tra preflight trong mô phỏng, không phải ba lời gọi hạ tầng thật.

`attempts` giữ snapshot cũ; `conditions` là hiện tại. Đừng ghi đè lịch sử bằng trạng thái sau sửa.
`available_ram` trong attempt là số lúc chạy, không phải dung lượng trống hiện tại.
`environment` có ID, attempt ID, RAM, image/account IDs và `state: running|stopped`; trước khi cấp có thể null.
Attempts từ checker-v1 có thể thiếu field mới; cần hiển thị lịch sử an toàn, không suy thành đạt.

### Gửi lệnh từ hồ sơ

Luôn lấy `expected_case_version` từ envelope và `expected_version` từ `observation.source_version` mới nhất.
Không gửi `request_id`, `passed`, `result`, `environment`, actor hoặc subject do FE tự đặt.

```json
{"action":"capacity","ram":12,"expected_case_version":4,"expected_version":7}
```
```json
{"action":"image","image_id":"lab-image-LAB-001","available":true,"expected_case_version":4,"expected_version":8}
```
```json
{"action":"account","account_id":"lab-account-LAB-001","active":true,"expected_case_version":4,"expected_version":9}
```
```json
{"action":"provision","operation_id":"new-operation-uuid","expected_case_version":4,"expected_version":10}
```

- `ram` là **đặt tổng RAM sandbox**, không phải lượng bổ sung. RAM đang dùng/giữ chỗ phải được tính khi chọn tổng mới; BE chặn giảm dưới lượng đã cấp. Giới hạn0–1048576, số nguyên.
- Image/account IDs phải lấy đúng từ conditions, không tự ghép từ tiêu đề hồ sơ.
- Dùng UUID mới cho mỗi ý định chạy mới. Một operation ID không được dùng cho request khác.
- Response provision có thêm `execution:{replayed,operation_id,attempt}`. Khi replay, execution mô tả thao tác cũ, còn observation mô tả hiện tại; hai kết quả có thể khác nhau.
- Commands không tăng Case.version; thay đổi sandbox version. Workflow mới tăng Case.version. Không tự cộng phiên bản ở FE.
- Mọi thay đổi sandbox, kể cả yêu cầu khác hoặc lệnh sửa cùng giá trị, có thể làm execution cũ mất hiệu lực. Tải lại và chạy mới khi BE yêu cầu.
- Chạy lại môi trường đã có không cấp RAM hai lần. Rerun thất bại có thể đưa nó về stopped và vẫn giữ RAM; chưa có chức năng thu hồi/xóa.
- Case closed không cho case-bound commands. Reviewer phải reopen trước nếu cần thao tác tiếp.

### Lưu kiểm chứng và đóng

Sau `request_verification` thành công, reviewer POST `{}` vào verifications. Response201 có thể failed
hoặc inconclusive; **201 chỉ có nghĩa đã lưu proof**, không phải nghiệp vụ đạt.

```json
{
  "id": "20000000-0000-4000-8000-000000000001",
  "case_id": "f10e80e1-7972-4b4f-856b-155c6d9f4ced",
  "case_version": 4,
  "actor_subject": "reviewer-subject",
  "checked_at": "2026-10-29T15:00:00.000Z",
  "observation": {"result":"inconclusive","reason":"SOURCE_REQUEST_NOT_FOUND"}
}
```

Đây là ví dụ proof inconclusive; observation có thể chỉ có result/reason. Proof bình thường lưu snapshot
điều kiện, latest attempt và delivery; không có cả mảng lịch sử attempts. GET verifications trả items
theo thứ tự cũ đến mới; không phân trang. Lấy proof mới nhất phù hợp Case.version hiện tại để hiển thị.
Không sửa/xóa proof cũ. Lưu proof không tự chuyển trạng thái case.

Sau proof đạt, dùng `verify_close` ở endpoint transitions hiện có, với reason, expected_version là
Case.version và Idempotency-Key theo workflow hiện tại. BE kiểm lại nguồn, owner, evidence/note,
pending links, case/checker/source versions, request/attempt/environment và delivery trong giao dịch.
FE chỉ gợi ý sẵn sàng, không tự quyết định đủ điều kiện. Reopen cần proof mới cho version case mới.

## 5. Trạng thái, retry và lỗi

Hiển thị riêng ba lớp, không gộp thành một nhãn thành công:

| Lớp | Ý nghĩa |
|---|---|
| `observation.result=passed` | Lần thực thi hiện còn hiệu lực và vượt ba điều kiện mô phỏng |
| `failed` | Còn lỗi hoặc trạng thái nguồn không nhất quán; xem reason/blockers |
| `inconclusive/NOT_EXECUTED` | Chưa có lần chạy |
| `inconclusive/RERUN_REQUIRED` | Trạng thái thay đổi; cần chạy mới |
| `delivery.status=pending` | Log của latest attempt chưa xác nhận ingestion; chưa phải lỗi nghiệp vụ |
| `delivery.status=delivered` | Log latest attempt đã ingestion; chưa thay cho proof reviewer |
| Proof đạt, còn hiệu lực | Bằng chứng reviewer đã lưu; BE vẫn kiểm lại khi đóng |

Collector chạy khoảng2giây/lượt. Có thể poll **GET** khi pending, ví dụ2giây trong tối đa30giây, rồi
dừng và cho tải lại thủ công; không poll POST hoặc lưu proof liên tục. Hủy/loại bỏ response cũ khi đổi
case/workspace/tài khoản hoặc logout. Không tự động ghi proof chỉ vì vừa GET thấy passed.
Proof lưu khi delivery còn pending không tự hợp lệ sau khi log tới: reviewer cần lưu proof mới.

Timeout POST provision: giữ nguyên operation_id/nội dung, GET lại trước; nếu người dùng gửi lại thì dùng
cùng operation_id, không tự tạo UUID mới. Nếu Case.version đã đổi, xử lý409 và tải lại trước khi quyết định.
Capacity/image/account dùng version chống ghi lặp; sau timeout GET lại, không tự gửi POST mới.
POST verifications không có idempotency bảo đảm: timeout thì GET history kiểm tra, không tự POST lại.
Đóng/mở case tiếp tục dùng quy tắc Idempotency-Key hiện có. Abort FE không bảo đảm server đã hủy.

| HTTP / code | FE xử lý |
|---|---|
| 400 `INVALID_INPUT` | Sửa body/ID; không retry nguyên lỗi. ID mới kiểu credential bị chặn trước ghi dữ liệu |
| 401 | Dừng thao tác, xử lý lại phiên; bỏ dữ liệu scope cũ |
| 403 | Không đủ role; bỏ trạng thái/thao tác không còn được phép |
| 404 | Không tìm thấy hoặc ngoài scope; không suy đoán có/không tài nguyên |
| 409 `VERSION_CONFLICT`, hoặc `LAB_COMMAND_REJECTED` với message `VERSION_CONFLICT` | Đọc lại case/sandbox, yêu cầu người dùng xem thay đổi trước khi thao tác tiếp |
| 409 `INVALID_STATE` | Chưa awaiting_verification khi lưu proof; đọc lại workflow |
| 422 `SANDBOX_BINDING_REQUIRED` | Hồ sơ không gắn nguồn sandbox hợp lệ; không tự ghép theo mã chuỗi |
| 422 `CASE_CLOSED` | Reopen trước thao tác case sandbox |
| 422 `LAB_COMMAND_REJECTED` | Xem message: RESOURCE_MISMATCH, ATTEMPT_LIMIT, RAM_ALREADY_ALLOCATED, v.v. |
| 422 `VERIFICATION_REQUIRED` | Thiếu proof đạt còn hiệu lực/delivery; không tự đổi state hoặc bỏ guard |
| 422 `VERIFIER_UNAVAILABLE` | Không có bộ kiểm chứng nguồn cho workspace khi POST proof |
| 503 / network / timeout | Không coi là nghiệp vụ failed hoặc AI degraded; giữ kết quả chưa rõ, GET lại |

Mã lỗi nằm trong `error.code`, message ở `error.message`; giữ request_id của response để tra cứu.
Không diễn giải422 như bằng chứng workspace không bật sandbox: binding cũng có thể sai trong workspace đã bật.
Workspace không sandbox vẫn theo closure policy cũ; không ép mọi hồ sơ dùng panel/proof này.
Nếu GET sandbox không dùng được, báo trạng thái module; giữ nguyên phần điều tra/workflow hiện có và để BE quyết định guard.

## 6. Luồng UAT và chuẩn bị dữ liệu mới

Hồ sơ103 ở mục2 đã closed: dùng để xem lịch sử, không bấm sửa trực tiếp. Dùng101 để xử lý lỗi kết hợp,
102 để kiểm tra lỗi image; chỉ thao tác sau khi đọc case/sandbox mới. Không xóa/reset hoặc gọi lại
lab/configure (đã cấu hình sẽ409). Các JSON ở mục4 là ví dụ, phải thay bằng IDs/version từ response thật.

Để có kịch bản lỗi kép mới, BE/operator chuẩn bị qua API lab hiện có; không bắt buộc xây trang thiết kế scenario:

1. GET `/lab` để lấy version, tổng RAM và lượng đang giữ. Chọn RAM yêu cầu lớn hơn dung lượng còn trống.
2. POST `/lab/commands` action submit: `{action:"submit",request_id:"LAB-FE-<mã-mới>",ram:<số>,image_available:false,account_active:false,expected_version:<version>}`. Đây là ký pháp minh họa; gửi JSON hợp lệ và mã mới không chứa thông tin bí mật.
3. POST `/lab/commands` action provision với request_id, operation_id mới và version vừa nhận.
4. Chờ ingestion, tìm request trong Events, chọn root intake, tái dựng và tạo hồ sơ theo UI cũ.
5. Giao owner, start, lưu note/evidence, duyệt liên kết; mở panel mới.
6. Admin đặt tổng RAM đủ (tính cả tài nguyên yêu cầu khác); operator chạy lại -> còn lỗi image.
7. Admin khôi phục đúng image; operator chạy lại -> còn lỗi account.
8. Admin kích hoạt đúng account; operator chạy lại -> passed, chờ delivered.
9. Chuyển awaiting_verification, reviewer lưu proof rồi verify_close -> closed.

Mỗi phiên dùng mã mới; tối đa1000requests/20attempts mỗi request. Source RAM dùng chung nên không
giả định server hiện vẫn có tổng RAM2 hay hoàn toàn trống. Đổi nguồn có thể làm proof yêu cầu khác stale.
Run/graph cũ là snapshot: log chạy lại **không tự chèn vào graph cũ**. Hiển thị attempts mới trong panel,
tra cứu log qua Events theo mã yêu cầu (đừng giữ window cũ làm ẩn log mới). Nếu tái dựng lại thì là run mới,
không ghi đè lịch sử run/case cũ.

Checklist nghiệm thu:

- [ ] Đủ ba điều kiện và kết quả từng lần chạy, tách trạng thái hiện tại khỏi lịch sử.
- [ ] Admin đơn thuần dùng được phần sửa; operator/viewer không sửa được tài nguyên.
- [ ] Sửa chưa đủ RAM, sai resource, chỉ sửa một lỗi đều không tự thành passed.
- [ ] Double click/timeout replay không sinh thêm attempt/log ngoài ý định.
- [ ] Passed nhưng pending, proof cũ hoặc sửa sau proof đều không đóng được.
- [ ] Proof failed/inconclusive hiển thị đúng; reviewer có thể dùng verification_failed để điều tra tiếp.
- [ ] Closed khóa sửa; reopen cần verification mới. Version409, quyền403/404 và logout bỏ response/caches cũ.
- [ ] Reload giữ lịch sử từ DB; FE không khai passed, tự cộng version hoặc tự cấp tài khoản đăng nhập.

## 7. Nguồn đối chiếu và tình trạng

- [OpenAPI](../../backend/contracts/openapi.json): operation `getCaseSandbox`, `commandCaseSandbox`, `listCaseVerifications`, `verifyCaseSource`.
- [Sandbox BE](../../backend/LAB_SANDBOX.md): cơ chế, cấu hình và bằng chứng triển khai.
- [Bàn giao FE chung](frontend.md): SSO, source ACL và workflow hiện có.
- [API reference chung](api-examples.md).

BE đã qua kiểm thử local và36 kiểm tra HTTPS/Keycloak thật trên Oracle. Đây là bàn giao cho FE triển khai;
chưa xác nhận có panel simulator, browser E2E, workspace-admin hoặc tạo tài khoản mới trong ứng dụng.
