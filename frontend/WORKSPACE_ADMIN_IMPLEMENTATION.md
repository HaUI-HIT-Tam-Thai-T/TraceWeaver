# Bàn giao quản trị workspace — 30/10/2026

## Chức năng đã triển khai

- `/workspace-admin`: hai tab Thành viên và quyền / Tạo tài khoản; deep link `?tab=accounts`.
- Sidebar và route chỉ mở khi membership của workspace hiện tại trong `/me` có role admin.
  `canAdmin` tách khỏi quyền đọc/xử lý/xác minh; reviewer đơn thuần không được quản trị.
- Bảng subject rút gọn/copy/full value, active/revoked, roles và direct read. Không suy username/email.
  Phân trang 50 dòng theo next_after, phát hiện version thay đổi hoặc thành viên lặp giữa các trang.
- Thêm human subject đã có SSO; sửa roles/active; xác nhận trước khi thu hồi membership.
- Cấp/thu hồi direct read chỉ trong danh sách nguồn caller hiện đọc được; xác nhận khi thu hồi.
  Thu hồi direct read không thu hồi group grants; thu hồi membership không xóa/khóa SSO.
- Tạo human SSO account với mật khẩu tạm, role hợp lệ và một Idempotency-Key cho một intent.
  Pending/timeout được đối chiếu GET operation; nút thử hoàn tất giữ cùng key/nội dung,
  chỉ dùng version mới sau khi người dùng chủ động xác nhận. Không polling/retry POST/PUT ngầm.
- Completed mới hiện thành công; xóa mật khẩu form và đọc lại danh sách. Tài khoản mới chưa có source grants.
- Error mapping theo handoff: version/member/idempotency/ownership conflict, admin cuối cùng,
  service được bảo vệ, chính sách account và provider không khả dụng/disabled.
- Logout, đổi tài khoản/workspace/phạm vi nguồn hoặc quyền bị từ chối: hủy request, purge state;
  response muộn không phục hồi danh sách/operation. Tự sửa quyền của mình sẽ xác minh lại `/me` và nguồn.

## Contract đã đối chiếu

Đã fetch bản đọc riêng vào `frontend/node_modules/.tmp/dev-contract-review.git`, không pull/merge
working tree hoặc sửa backend/root. Remote dev vẫn ở ba0445a; commit **4cdd022** tìm được qua nhánh BE.
Đọc OpenAPI, WORKSPACE_ADMIN.md, admin.validation.js, admin.route.js, admin.service.js và admin-repository.js
tại đúng commit này trước khi viết service. Tài liệu handoff người dùng ngày 30/10 ghi bản này đã rollout;
đợt FE này chưa xác minh lại deployment thật.

OpenAPI mô tả response quản trị là object chung. Schema FE strict dùng hình dạng trả thực tế của repository:

- GET members: workspace_id/version/items/next_after; item subject/active/roles/direct_source_ids.
- POST member: subject/active/roles/version.
- PUT member: subject/active/roles/**expected_version**/version (BE echo trường này).
- PUT source: subject/source_id/enabled/version.
- POST account completed: state/subject/username/roles/active/version.
- GET provisioning: pending chỉ có state/username/current_version; completed có thêm current_version.

Không chấp nhận marker, password, client token hoặc field ngoài response contract.
Version admin tách riêng version case/run/link. Kiểm echo của mutation; completed replay không bắt
version phải trùng version quản trị hiện tại. Luôn đọc GET members để biết version mới.

## Cách dùng

1. Đăng nhập tài khoản có role admin và chọn workspace. Mở Quản trị workspace.
2. Thêm subject đã có SSO hoặc chọn một dòng để sửa roles, membership và direct read.
3. Sau khi dữ liệu thay đổi, đọc danh sách mới rồi bấm Dùng phiên bản quản trị mới trước khi gửi tiếp.
4. Tab Tạo tài khoản: nhập username chữ thường 3–64 ký tự, mật khẩu tạm 12–128 ký tự và roles.
5. Nếu pending/chưa rõ: Kiểm tra trạng thái; khi cần, thử hoàn tất bằng cùng mã thao tác.
   Không bắt đầu intent khác cho cùng username. Provider disabled không được hiển thị thành pending giả.
6. Completed: bàn giao bằng kênh vận hành phù hợp; người dùng đổi mật khẩu/bổ sung profile qua Keycloak.
   Quay về tab Thành viên và quyền để cấp nguồn theo nhu cầu.

Mật khẩu chỉ ở bộ nhớ form; controller snapshot không giữ password. Không dùng local/sessionStorage,
URL, log, analytics hoặc secret dịch vụ. Đóng/reload/rời trang, đổi scope hoặc xác minh lại quyền
có thể làm mất form/intent: kiểm tra theo vận hành, không tự tạo key khác để thử cùng account.
Giữ nguyên ranh giới purge của workspace provider hiện có; không giữ payload cũ khi xác minh quyền.

## File thêm/sửa

- src/features/workspace-admin/schemas.ts
- src/features/workspace-admin/services.ts
- src/features/workspace-admin/controller.ts
- src/features/workspace-admin/presentation.ts
- src/features/workspace-admin/components/AdminForms.tsx
- src/features/workspace-admin/components/WorkspaceAdminView.tsx
- src/pages/WorkspaceAdminPage.tsx
- src/routes/WorkspaceAdminAccess.tsx
- src/routes/AppRoutes.tsx
- src/components/layout/AppSidebar.tsx
- src/constants/routes.ts
- src/constants/pageTitles.ts
- src/features/workspace/state/state.ts
- tests/workspace.test.mjs
- tests/admin-fixtures.mjs
- tests/workspace-admin.test.mjs
- tests/workspace-admin-ui.test.mjs
- tests/fixtures/workspace-admin.html
- tests/fixtures/workspace-admin.tsx
- WORKSPACE_ADMIN_IMPLEMENTATION.md

## Kiểm tra và giới hạn nghiệm thu

- Tests: schema/service cho sáu API, strict DTO/UTF-16, encode subject, echo/version, operation không khớp;
  phân trang/version conflict, timeout, pending/completed/replay, provider disabled, ownership conflict,
  tự thu hồi quyền, double submit, abort và response muộn sau đổi actor/workspace/access/source scope.
- UI SSR: admin-only sidebar/route, reviewer không có admin bị chặn, admin không tự có quyền reviewer,
  escape HTML, bảng không caption, nút copy, password input, pending khác completed.
- Có fixture local dùng controller/components thật và service mô phỏng, không gọi SSO/API thật.
  Fixture HTTP 200. Công cụ trình duyệt timeout khi mở/đọc tab, kể cả khi thử tab mới;
  chưa kiểm tra tương tác desktop/mobile, bàn phím, clipboard hoặc reload bằng trình duyệt.
- Chưa UAT HTTPS/Keycloak thật: required actions lần đầu, CORS PUT, tạo account/cấp/revoke grants
  và hai phiên trình duyệt thật. Không thay đổi account/hồ sơ mẫu hoặc tạo dữ liệu trên UAT.
- Không sửa backend/root/CI/hạ tầng, không thêm dependency, không đưa credentials người dùng vào code.
- Không triển khai simulator, workspace CRUD, realm/group management, reset mật khẩu hoặc xóa account.

## Kết quả chạy lệnh

- `npm run lint`: đạt, không cảnh báo; không đổi cấu hình để che lỗi.
- `node node_modules/typescript/bin/tsc -p tsconfig.app.json --incremental false`: đạt.
- `node node_modules/typescript/bin/tsc -p tsconfig.node.json --incremental false`: đạt.
- `npm run build`: đạt; public env lấy từ `.env.example` trong tiến trình, không ghi `.env`.
  Log: `node_modules/.tmp/workspace-admin-build.log`.
- Toàn bộ `npm test` tuần tự: lượt đầu 228/228 đạt (44,5 giây), sau điều chỉnh cuối
  228/228 đạt (34,7 giây), không fail/cancel/skip. Logs:
  `node_modules/.tmp/workspace-admin-suite-1.log`, `workspace-admin-suite-final.log`.
- `git diff --check`: đạt. Git chỉ cảnh báo LF/CRLF theo cấu hình sẵn có.

SSR/fixture không thay nghiệm thu hệ thống thật. Chưa commit/push/deploy.
