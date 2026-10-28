# Handoff FE — dữ liệu dễ đọc và người nhận hồ sơ

Ngày 29/10/2026. Bổ sung cho [handoff tổng](FRONTEND_HANDOFF.md) và [API reference](FRONTEND_API_REFERENCE.md). Contract chuẩn: [OpenAPI](../backend/contracts/openapi.json), [schema](../backend/contracts/schemas/domain.schema.json).

## Trạng thái tích hợp

| Hạng mục | Trạng thái |
|---|---|
| 4 bài Knowledge, tên 3 nguồn | Đã nạp DB local và Oracle; seed lại không tạo trùng |
| `workspace_name` trong `/me` | Đã sửa source và kiểm thử; cần triển khai/restart BE mới |
| API người nhận theo hồ sơ | Đã sửa source và kiểm thử; cần triển khai/restart BE mới |
| FE | Chưa sửa trong lượt này |

Không có migration hoặc dependency mới. Server đang chạy bản trước thay đổi API này; không coi endpoint mới đã live. Sau rollout, đối chiếu Swagger của môi trường đích. Dữ liệu Knowledge/tên nguồn dùng được qua API hiện tại.

## 1. Tên workspace

`GET /api/v1/me`, Bearer access token hiện tại:

```json
{
  "subject": "example-user-subject",
  "memberships": [{
    "workspace_id": "10000000-0000-4000-8000-000000000015",
    "workspace_name": "TraceWeaver Demo",
    "roles": ["operator"],
    "group_ids": []
  }]
}
```

Dropdown dùng `workspace_id` làm value, `workspace_name ?? workspace_id` làm label để tương thích server cũ. Tên lấy từ DB của membership còn hiệu lực; không lấy role hay tên workspace từ claim do FE tự truyền. Không dùng tên làm khóa. Khi đổi workspace, xóa cache nguồn, Knowledge, hồ sơ và người nhận của workspace trước.

## 2. Tên nguồn cho bảng sự kiện

`GET /api/v1/workspaces/{wid}/sources?limit=100` giữ nguyên response `{items, next_cursor}`. Đọc hết các trang được phép rồi map `source.id → source.name`.

| service | name sau seed |
|---|---|
| `intake` | Tiếp nhận yêu cầu |
| `account` | Quản lý tài khoản |
| `provision` | Cấp phát môi trường |

Hiển thị tên nguồn tại cột Nguồn; service có thể là dòng phụ. UUID để trong chi tiết/copy. Nếu không tìm thấy nguồn trong cache quyền hiện tại, hiển thị “Nguồn không khả dụng”; không suy đoán danh tính nguồn bị ẩn. Không đổi `source_id`, `service`, `parser_version` hay mã action. Seed chỉ thay tên kỹ thuật mặc định, giữ tên đã được tùy chỉnh.

## 3. Knowledge

`GET /api/v1/workspaces/{wid}/knowledge?limit=50`; tìm bằng `q`, phân trang qua `next_cursor`. Response không đổi; mỗi item có `id`, `workspace_id`, `title`, `body`, `version`, `author_subject`, `source_ref`, `created_at`.

Đã nạp 4 bài: đọc hành trình cấp môi trường; xử lý liên kết chưa xác định; giao và xác minh hồ sơ; đọc kết quả AI và bằng chứng. Mỗi bài version 1, nguồn `repo:backend/...`, tác giả `readable-demo-seed`. Đây là hướng dẫn sản phẩm, không phải dữ liệu train hay bằng chứng tự động kết luận hồ sơ.

Hiển thị title/body/version/nguồn và thời gian; body là văn bản, không render như HTML chưa sanitize. `repo:` là tham chiếu tài liệu trong repo, không phải URL HTTP để mở trực tiếp. Giữ riêng trạng thái loading, lỗi quyền/lỗi server, và danh sách thực sự rỗng. API trả version mới nhất của từng bài.

## 4. Danh sách người nhận theo hồ sơ

```http
GET /api/v1/workspaces/{wid}/cases/{cid}/assignees
Authorization: Bearer <access_token>
```

Không có query parameter, body hoặc phân trang. Trả toàn bộ người đủ điều kiện, sắp xếp theo `subject`:

```json
{"items": [{"subject": "example-user-subject", "roles": ["operator"]}]}
```

BE chưa lưu tên hiển thị/email người dùng. FE dùng `subject` làm value và label hiện tại, có thể kèm nhãn role; không giả định subject là username hoặc UUID. Response không có `display_name`.

Caller phải là operator/reviewer, membership còn hiệu lực và đọc được toàn bộ nguồn của run. Candidate cũng phải thỏa các điều kiện đó; grant trực tiếp hoặc qua group đều được xét. Admin đơn thuần và viewer không đủ điều kiện. Endpoint chỉ báo điều kiện người nhận, không khẳng định action `assign` đang hợp lệ ở mọi state.

Chỉ mở UI giao khi hồ sơ ở state `new`. Nạp lại danh sách khi mở dropdown, không dùng chung giữa các hồ sơ; xóa cache sau 401/403/404 và khi đổi workspace. Gửi `subject` đã chọn qua API transition hiện có:

```http
POST /api/v1/workspaces/{wid}/cases/{cid}/transitions
Content-Type: application/json
Authorization: Bearer <access_token>
```

```json
{"action":"assign","owner_id":"example-user-subject","expected_version":1,"reason":"Phân công xử lý hồ sơ"}
```

`expected_version` phải lấy từ hồ sơ hiện tại. Thành công trả Case mới; cập nhật state/owner/version từ response.

| HTTP | FE xử lý |
|---|---|
| 400 | Kiểm tra ID/query/body; endpoint assignees không nhận query |
| 401 | Xử lý phiên đăng nhập/token hết hạn |
| 403 | Caller thiếu role thực hiện; ẩn/khóa chức năng và báo rõ |
| 404 | Hồ sơ không tồn tại hoặc không còn trong phạm vi; không suy đoán nguyên nhân |
| 409 khi transition | Đọc lại hồ sơ vì state/version có thể đã đổi |
| 422 khi transition | Guard không đạt, kể cả người nhận vừa mất quyền; tải lại hồ sơ và người nhận |
| 503 | Báo tạm thời không khả dụng, cho phép thử lại thao tác đọc |

BE vẫn kiểm role, nguồn, membership, state, version và audit khi thực hiện. Danh sách vừa đọc không bảo đảm quyền ở thời điểm submit.

## 5. Những việc FE tự trình bày

- Một thời gian UTC+7 ở bảng; ISO gốc trong chi tiết/tooltip.
- Nhãn tiếng Việt cho action/outcome, giữ mã gốc khi xem chi tiết; outcome là kết quả từng event.
- Message đọc được, UUID không chiếm cột chính; dùng dữ liệu LAB demo hiện có thay vì mặc định chọn FE-DEMO cũ.
- Smoke test operator thấy bài/tên nguồn/người nhận; viewer đọc bài/nguồn nhưng không gọi assignees; giao thành công cập nhật version; mất quyền không tiếp tục dùng dữ liệu cache.

## Vận hành BE

```sh
node --env-file-if-exists=.env backend/scripts/seed-readable-demo.js
node --env-file-if-exists=.env backend/scripts/seed-readable-demo.js --apply --workspace=10000000-0000-4000-8000-000000000015
```

Lệnh đầu dry-run. Lệnh sau chỉ append bài version 1 chưa có và đổi tên nguồn mặc định trong workspace đích; giữ nguyên bài đã có, sự kiện, run, case, grants và tên tùy chỉnh. Chạy lại trả 0 bài/0 tên nguồn thay đổi.

Chưa làm: lọc namespace/mã yêu cầu chính xác, lý do unresolved có cấu trúc, thao tác được phép kèm lý do chặn, và đồng bộ tên người dùng từ IdP.
