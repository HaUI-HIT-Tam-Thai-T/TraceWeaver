# Phân cấp nút và kiểm tra quyền khi quay lại tab

## Button

- Primary: nền xanh đậm, hành động chính như tìm kiếm, áp dụng, tạo, lưu và gửi đề xuất.
- Secondary: nền xanh nhạt, viền nhẹ; hành động hỗ trợ như chọn người, tải dữ liệu để đối chiếu, phân trang và kiểm tra trạng thái.
- Tertiary: nền trong suốt, viền trung tính; làm mới danh sách/tổng quan/chi tiết, mở tác vụ, sửa thành viên và tải thêm thành viên.
- Ghost: không viền, nền trong suốt; sao chép, hủy và thao tác nhẹ. Nút bằng chứng tiếp tục giữ kiểu chữ đậm/đổi màu khi hover theo yêu cầu trước.
- Danger: nền đỏ cho hành động có tính chất nguy hiểm. Form thu hồi membership và nút thu hồi direct read dùng variant này; giữ bước xác nhận và version hiện có. Đây là tính chất hành động, không phải một mức ưu tiên thứ năm.

Secondary/tertiary/ghost không chuyển thành nền xanh đậm như primary khi hover. Giữ trạng thái disabled, focus và loading; Button mặc định `type="button"`, form gửi dữ liệu dùng `type="submit"` rõ ràng.

## Nguyên nhân đổi tab trông như refresh

`WorkspaceProvider` trước đây gọi `refreshAccess()` mỗi lần window nhận focus. Controller xóa workspace hiện tại trước khi gọi `/me`; các feature thấy mất scope nên xóa dữ liệu và tải lại khi scope trở về. Đây là việc reset trạng thái ứng dụng, không phải lệnh reload tài liệu HTML.

Focus hiện gọi `revalidateAccess()`:

1. Kiểm tra `/me` và toàn bộ các trang nguồn đọc được bằng GET, không polling hoặc retry ghi.
2. Khi dữ liệu giống nhau, giữ nguyên snapshot và identity của scope; không phát trạng thái loading và không làm các feature mất nháp.
3. Khi membership hoặc nguồn đổi, chuyển về luồng làm mới quyền đầy đủ, purge scope cũ. Lỗi xác minh cũng gỡ dữ liệu chưa được xác minh; 401 yêu cầu đăng nhập lại.
4. Kiểm tra đồng thời được gộp. Logout, đổi workspace hoặc refresh chủ động hủy kiểm tra cũ; generation chặn response muộn.

Nút làm mới chủ động và bước xác minh lại quyền sau thay đổi của chính người dùng vẫn dùng `refreshAccess()` như trước.

## File thay đổi

- `src/components/ui/Button.tsx`, `src/components/ui/primitives/button.tsx`
- `src/features/workspace/state/controller.ts`, `WorkspaceProvider.tsx`
- `src/features/workspace-admin/components/AdminForms.tsx`, `WorkspaceAdminView.tsx`
- `src/features/cases/components/CaseRunPanel.tsx`
- `src/features/events/components/EventsExplorer.tsx`
- `src/features/knowledge/components/KnowledgeView.tsx`
- `src/pages/CaseDetailPage.tsx`, `CasesPage.tsx`, `DashboardPage.tsx`
- `tests/workspace.test.mjs`

Không thêm dependency, không sửa backend hay root repository.

## Kiểm tra

`npm test`: 233/233 đạt. Lint, TypeScript strict app/config, production build với public env hợp lệ và `git diff --check` đều đạt.

Test controller xác minh quyền không đổi giữ nguyên tham chiếu snapshot, gộp focus trùng, đọc đủ trang nguồn, phát hiện đổi role/thu hồi nguồn, fail closed với 401/403/404/503 và chặn response muộn sau logout/refresh/đổi workspace. Chưa kiểm chứng bằng tương tác trình duyệt hoặc API/SSO thật; công cụ trình duyệt ở đợt trước bị timeout localhost.
