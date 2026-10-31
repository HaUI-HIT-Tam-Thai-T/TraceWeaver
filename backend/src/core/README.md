# Lõi xử lý dùng chung

Thư mục này chứa các chức năng có thể dùng mà không cần giao diện React hoặc máy chủ HTTP Express: kiểm quyền, lưu dữ liệu và chạy quy trình. Ứng dụng gọi các chức năng đó qua `index.js`; lời gọi không khởi động HTTP, nạp cấu hình máy chủ hay phụ thuộc lớp nghiệp vụ riêng của TraceWeaver.

## Trách nhiệm của các module

| Đường dẫn | Công việc |
|---|---|
| `identity/workspace-access.js` | Kiểm thành viên, vai trò và quyền nguồn hiện tại. Phần này không phụ thuộc bộ dựng hành trình. |
| `workflow/engine.js`, `workflow/store.js`, `workflow/repository.js` | Kiểm bước chuyển, lưu lịch sử và đọc/ghi quy trình dùng chung. Không phụ thuộc hồ sơ, hành trình hoặc kiểm dữ liệu riêng của hồ sơ TraceWeaver. |
| `reconstruction/run-scope.js` | Xác định phạm vi SQL của lần dựng hành trình; tách khỏi quyền nhóm làm việc dùng chung. |
| `../adapters/case-workflow.js` | Nối hồ sơ TraceWeaver với quy trình dùng chung, giữ khóa lần dựng, bằng chứng, quyền và lịch sử thao tác của hồ sơ. |
| `data/workflow-repository.js`, `data/workflow-store.js`, các phần xuất lại trong `data/run-repository.js` | Giữ các điểm gọi cũ tiếp tục hoạt động; không mở thêm API dùng chung. |

## Đăng ký quy trình từ ứng dụng khác

Ứng dụng khai báo định nghĩa quy trình tin cậy khi tạo bộ đọc/ghi dữ liệu (repository). Người gọi HTTP không gửi định nghĩa tùy ý từ trình duyệt.

```js
import { createWorkflowRepository } from './index.js';

const workflows = createWorkflowRepository(pool, {
  definitions: [{ definition: yourApprovalDefinition, entityType: 'your_entity' }],
});
```

Repository dùng bộ xử lý quy trình hiện có, kiểm vai trò và phiên bản rồi lưu lịch sử vào các bảng quy trình chung. Nếu nghiệp vụ có người phụ trách, bằng chứng, dữ kiện hoặc điều kiện riêng, ứng dụng cần lớp kết nối phía máy chủ (adapter) với `authorizeRead`, `create`, `transition`. Lớp này phải kiểm quyền và lưu toàn bộ thay đổi nghiệp vụ trong cùng giao dịch: cùng thành công hoặc cùng hủy khi lỗi.

Đăng ký qua mã không tự mở loại quy trình mới trên HTTP. Cấu trúc dữ liệu công khai vẫn chỉ nhận hai quy trình đã công bố.

Quyền tạo được đặt bằng `createRoles` khi đăng ký trên máy chủ. Nếu bỏ qua, dùng các vai trò được phép chuyển bước từ trạng thái ban đầu. Khi chuyển bước, bộ xử lý đối chiếu vai trò trong định nghĩa với quyền hiện tại trong cơ sở dữ liệu. Nó không áp riêng quyền ghi của TraceWeaver cho mọi quy trình và không thêm vai trò tùy ý vào cấu trúc dữ liệu. Chính sách của tài liệu và hồ sơ hiện có được giữ nguyên.

## Dữ liệu, dựng hành trình và lịch sử

- `data/` quản lý nhóm kết nối PostgreSQL, giao dịch, script cập nhật bảng, nhận bản ghi chuẩn hóa và truy vấn theo phạm vi quyền/bộ dữ liệu của lần dựng.
- `identity/` kiểm mã truy cập có chữ ký JWT, lấy khóa kiểm chữ ký JWKS, bảo vệ mã phân trang bằng HMAC và đọc quyền thành viên/nguồn. Phần này không phụ thuộc Express.
- `reconstruction/` tìm cặp liên quan theo quy tắc có phiên bản, lưu căn cứ và lý do chưa kết luận, đồng thời chặn vòng liên kết. `data/run-repository.js` lưu đầu vào, nguồn và quy tắc tại thời điểm dựng; chống thực hiện trùng, ghi lịch sử và kiểm quyền hiện tại khi đọc hành trình/sơ đồ. Xem [hướng dẫn](../../RECONSTRUCTION.md).
- `workflow/` dùng cùng bộ xử lý cho case_handling và document_review. Mỗi lần chuyển bước kiểm phiên bản, vai trò, người phụ trách và dữ kiện cần thiết; lưu phiên bản quy trình và lịch sử không cho sửa. `data/workflow-store.js` xuất lại phần lưu trữ chung và giữ cách đọc trạng thái riêng của hồ sơ. Trạng thái/người phụ trách của hồ sơ chỉ lấy từ lịch sử. `data/case-repository.js` nối kiểm quyền, bằng chứng, chống thực hiện trùng, khóa lần dựng và ghi lịch sử. Xem [hồ sơ và quy trình](../../CASES.md).

## Gọi qua HTTP và kiểm chứng

API lõi dùng mã JWT của ứng dụng riêng, đồng thời kiểm độc lập JWT người dùng và quyền hiện tại trong cơ sở dữ liệu. Chuyển bước hồ sơ qua API vẫn dùng cùng bộ đọc/ghi dữ liệu, khóa lần dựng và điều kiện bằng chứng. Các thay đổi nghiệp vụ và lịch sử thao tác phải nằm trong cùng giao dịch.

Cấu trúc dữ liệu trao đổi dùng chung nằm tại `../../contracts/`. Xem [API quy trình](../../WORKFLOW.md) về CORE_APP_CLIENT_ID/CORE_APP_SUBJECT và tư cách thành viên của dịch vụ; [xác thực](../../IDENTITY.md), [Keycloak](../../KEYCLOAK.md) và [bản ghi](../../EVENTS.md) giải thích các phần liên quan.

Việc tổ chức lại mã nguồn không đổi định nghĩa HTTP, cấu hình hoặc cấu trúc cơ sở dữ liệu. Sửa mã trên nhánh không tự cập nhật máy chủ. Chưa nghiệm thu tích hợp máy chủ–giao diện–AI hoặc triển khai máy chủ sau lần tổ chức lại này. Kết quả theo phiên bản nằm ở [hiện trạng](../../../docs/overview/status.md); kiểm mã nguồn không thay cho xác nhận bản đang chạy hoặc chất lượng mô hình.
