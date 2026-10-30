# Handoff FE — Hoàn thiện luồng demo sau audit

> **Tài liệu lưu trữ:** checklist audit ngày 30/10/2026, không phải danh sách thiếu sót hiện tại đã được tái kiểm. Xem [tích hợp](../integration/README.md) và [hiện trạng](../overview/status.md).

Cập nhật30/10/2026, đối chiếu FE `origin/ThienBao/feature/app-shell-ui` commit `d90addc`.
Không thay đổi phần tìm/chọn tài khoản theo username, hiển thị tên hoặc đánh dấu service account
(phần2 đã được người dùng loại khỏi phạm vi). Không thêm AI hoặc chức năng xóa dữ liệu.

## 1. Phân biệt phần đã có và phần cần bổ sung

FE đã có tab **Kết quả tái dựng**, timeline, sự kiện/log gốc và các liên kết từ run đã lưu.
Ảnh người dùng cung cấp ngày30/10 đang hiển thị phần này cho hồ sơ sandbox đã đóng.
Nút **Tải lại kết quả tái dựng** đọc lại kết quả phân tích; không thực thi lại nghiệp vụ.
Chữ `[Sandbox]` trong message log là nguồn dữ liệu, không chứng minh FE đã tích hợp simulator commands.

| Đã có | Cần bổ sung |
|---|---|
| Đọc run/graph, timeline và log gốc | Đọc điều kiện sandbox hiện tại gắn đúng hồ sơ |
| Duyệt liên kết, bằng chứng ghi chú/snapshot | Sửa RAM/image/tài khoản mô phỏng và chạy lại nghiệp vụ |
| Workflow chờ xác minh/đóng/mở lại | Xem execution history, delivery và lưu/đọc proof kiểm chứng nguồn |
| Mục Việc tiếp theo theo trạng thái case | Hướng dẫn bước tiếp theo theo lỗi simulator/proof còn thiếu |

Hồ sơ đã đóng trên server có thể do UAT bằng API, không phải bằng thao tác trên FE. Không cần làm lại
tab tái dựng hiện có; thêm panel **Kiểm chứng nghiệp vụ mô phỏng** trong chi tiết hồ sơ.

## 2. Ưu tiên P1 — simulator và kiểm chứng nguồn

Contract chi tiết, body, error codes và retry: [FE_SANDBOX_HANDOFF](../integration/sandbox.md).
Prefix các API bên dưới là `/api/v1/workspaces/{wid}/cases/{cid}`.

| API | Dùng cho |
|---|---|
| GET `/sandbox` | Case binding, điều kiện hiện tại, kết quả/lý do, attempts, environment, delivery |
| POST `/sandbox/commands` | capacity/image/account/provision |
| GET `/verifications` | Lịch sử proof đã lưu |
| POST `/verifications`, body `{}` | Reviewer kiểm tra nguồn và lưu proof mới |
| POST `/transitions` | Workflow hiện có, gồm request_verification/verify_close/reopen |

### Quyền và giao diện

- Viewer đọc được khi có quyền nguồn; không sửa hoặc chạy lại.
- Admin sửa capacity/image/account; operator hoặc reviewer chạy provision.
- Reviewer lưu proof khi case awaiting_verification và đóng/mở theo workflow.
- Không đặt toàn bộ panel sau `canWrite`: admin đơn thuần cần thấy phần sửa.
- Phải ghi rõ đây là **mô phỏng**, không có VM/registry/mạng thật; bật tài khoản mô phỏng khác SSO.
- Case đã closed: xem lịch sử, không gửi command; reviewer reopen trước nếu cần thực hiện lại.

### Luồng phải hoàn thành

1. Đọc binding/conditions từ BE; không tự ghép request theo chuỗi ID hoặc tiêu đề case.
2. Hiện RAM/image/account, lỗi hiện tại và checks/blockers của lần chạy gần nhất.
3. Admin sửa điều kiện. Sửa thành công chỉ có nghĩa đã đổi trạng thái nguồn, chưa phải nghiệp vụ đạt.
4. Operator/reviewer chủ động chạy lại. Hiện từng attempt trước–sau, không ghi đè snapshot cũ.
5. Phân biệt execution passed, log delivered và proof reviewer passed còn hiệu lực.
6. Reviewer lưu proof rồi dùng workflow đóng hồ sơ. HTTP201 lưu proof không đồng nghĩa result=passed.
7. BE quyết định đủ điều kiện đóng; ghi chú hoặc state tự đặt ở FE không thay proof.

### Version, retry và trường hợp đặc biệt

- Commands lấy expected_case_version từ envelope, expected_version từ observation.source_version.
  Không dùng version của run/link/admin, không tự cộng version hoặc gửi result/passed/request_id.
- Capacity là **tổng RAM**, không phải lượng cộng thêm; resource IDs lấy từ conditions.
- Mỗi ý định provision mới có operation_id mới; timeout giữ ID/body cũ, GET đối chiếu trước retry.
- Sửa capacity/image/account timeout: GET đối chiếu, không tự gửi lệnh mới.
- POST proof timeout: GET history đối chiếu, không tự POST lặp; API không bảo đảm idempotency proof.
- Có thể poll GET delivery có giới hạn, dừng khi đổi case/workspace/logout. Không poll POST.
- Thay đổi nguồn có thể làm attempt/proof cũ hết hiệu lực; reopen cần kiểm chứng lại.
- Case ngoài sandbox vẫn dùng policy đóng cũ. API sandbox không khả dụng phải báo lỗi module, không
  tự suy ra workspace không cần proof và không bỏ guard. Giữ phần điều tra hiện có dùng được.

## 3. Ưu tiên P2 — phục hồi lỗi tạo tài khoản

Đã tái hiện trên controller hiện tại:

1. POST account bị422 ACCOUNT_POLICY_REJECTED hoặc409 ACCOUNT_OWNERSHIP_CONFLICT.
2. account.status=error nhưng vẫn giữ key; form khóa username/password/roles.
3. resetAccount không xóa key chưa completed; sửa thành viên cũng bị chặn bởi blockedByAccount.

File cần xem:
[controller](../../frontend/src/features/workspace-admin/controller.ts),
[AdminForms](../../frontend/src/features/workspace-admin/components/AdminForms.tsx),
[WorkspaceAdminView](../../frontend/src/features/workspace-admin/components/WorkspaceAdminView.tsx).

### Ràng buộc BE hiện tại — không tự giả định đã có API mới

BE hiện chỉ lưu operation pending/completed. Lỗi provider4xx có thể xảy ra sau reserve, nên GET vẫn
pending. Không có operation failed/cancel/reset endpoint. Fingerprint có username/password/roles,
không chứa expected_version; sửa password nhưng giữ key cũ sẽ IDEMPOTENCY_CONFLICT.

FE không được chỉ xóa key và tạo intent mới cho mọi lỗi, vì account có thể đã được tạo trong các
trường hợp kết quả chưa rõ. Để cho phép sửa và gửi lại an toàn ngay trên form, cần phối hợp BE chốt
ngữ nghĩa lỗi đã kết thúc/chưa tạo account và cách bắt đầu intent thay thế; đây là phụ thuộc chưa có
contract mới. Không tự thêm field/status/API giả ở FE.

Trong lúc giữ contract hiện tại:

- Pending/network/timeout/5xx: giữ intent; GET operation và chỉ retry cùng nội dung/key khi phù hợp.
- Disabled trước reserve: không tạo pending giả; báo chưa cấu hình, không tự retry.
- Policy/ownership rejection: giải thích rõ lỗi và giới hạn phục hồi; không báo thành công hoặc yêu cầu
  retry vô hạn cùng input lỗi. Không dùng reload trang như bằng chứng intent cũ đã hủy.
- Xem lại việc khóa toàn bộ sửa thành viên vì một intent account lỗi; thao tác độc lập có thể được
  tách khóa nếu vẫn bảo đảm CAS và xử lý refresh version đúng. Không replay mutation ngầm.

Contract quản trị nền: [FE_WORKSPACE_ADMIN_HANDOFF](../integration/workspace-admin.md).

## 4. UX và tiêu chí nghiệm thu

- Giữ generic Việc tiếp theo đã có, bổ sung trạng thái sandbox: sửa điều kiện/chạy lại/chờ log/lưu proof.
- Sau completed account, có đường đi rõ sang tab thành viên/cấp nguồn; không mở rộng tìm theo username.
- Giữ nháp khi đóng/mở panel, tab hoặc focus lại nếu quyền không đổi; purge khi đổi scope/mất quyền.
- Bố cục tác vụ thu gọn dưới1536px là chủ ý, chưa phải bug đã xác nhận. Kiểm laptop1366/1440px,
  mobile390px, zoom200%, Tab/Escape, focus quay lại nút mở, không overflow toàn trang.
- Không làm lại sidebar, timeline, graph hoặc workflow đã hoạt động chỉ để tích hợp phần mới.

| UAT | Kết quả cần thấy |
|---|---|
| RAM + image + account cùng lỗi | Sửa từng điều kiện, chạy lại lần lượt RAM -> image -> account -> passed |
| Sửa nhầm image/account | BE từ chối; không đổi nhãn thành đạt |
| Passed nhưng delivery pending | Hiện chờ log; chưa gợi ý đóng ngay |
| Proof failed/inconclusive hoặc stale | Hiện đúng kết quả, không coi HTTP201 là đạt |
| Reviewer đóng rồi reopen | Lịch sử giữ nguyên, phải chạy/lưu kiểm chứng lại khi BE yêu cầu |
| Hai tab, timeout, double click | CAS/chống trùng đúng, không tự tăng version hoặc tạo execution mới |
| Actor/workspace/case đổi khi request đang chạy | Response cũ không khôi phục dữ liệu của scope cũ |
| Account policy/ownership rejection | Không mắc kẹt trong vòng retry; ghi rõ phụ thuộc BE nếu chưa có recovery contract |
| Case ngoài sandbox | Luồng cũ không bị ép dùng proof mô phỏng |

Case đã kiểm API thật để xem lịch sử: `5115dbaf-7190-493c-8cb6-12bfa467816d` trong workspace
`10000000-0000-4000-8000-000000000016`. Case này đã closed, không sửa/xóa/reset để chuẩn bị demo mới.
Dữ liệu cho lượt lỗi mới do BE/operator chuẩn bị theo handoff sandbox, không cần scenario designer.

Recheck local:233/233 tests FE, lint và TypeScript app/node đạt; probe riêng tái hiện hai lỗi account
nêu trên. Suite đạt không chứng minh đã có integration simulator. Chưa nghiệm thu browser UI/mobile
trong lượt recheck. Khi bàn giao kết quả FE, ghi rõ commit, test và bằng chứng tương tác với BE thật;
phân biệt source, server và giao diện.
