# Điều chỉnh layout theo design.md

## Kết quả

- Sidebar desktop thu gọn còn 64px, giữ các liên kết bằng icon, tên truy cập và tooltip hover/focus. Menu mobile tiếp tục dùng Sheet.
- Header gom vai trò vào popover có nhãn tiếng Việt, giảm chiều cao trên mobile; quyền vẫn lấy từ membership hiện tại.
- Chi tiết hồ sơ có tổng quan trên toàn chiều rộng. Tác vụ hồ sơ có nút mở/thu gọn, giữ form được mount để bảo toàn nháp. Chỉ chia hai cột từ 1536px; tab tái dựng dùng toàn chiều rộng.
- Quản trị workspace chuyển thêm/sửa thành viên và quyền nguồn sang Sheet bên phải. Panel có vùng cuộn, trả focus về nút mở và giữ nháp thành viên trong trang; đổi thành viên bỏ nháp của thành viên trước. Phiên bản cũ vẫn cần người dùng xác nhận phiên bản mới. Form mật khẩu tiếp tục nằm riêng trong tab tạo tài khoản và giữ cơ chế xóa theo scope hiện có.
- Bộ lọc Events/Cases gọn hơn, thu gọn thời gian trên mobile nhưng vẫn giữ input; lỗi thời gian mở phần lọc. Số dòng mỗi trang nằm ở khu phân trang. Đổi số dòng giữ các trường lọc chưa gửi và vẫn áp dụng bộ lọc đang dùng qua controller hiện có.
- Giảm khoảng cách và lớp khung trong các vùng vừa sửa. Giữ tiêu đề bảng căn giữa, không khôi phục caption hiển thị, khung “Đang áp dụng” hay metadata trong ô hồ sơ.

## File thay đổi trong đợt layout

- `src/components/layout/{AppHeader,AppLayout,AppSidebar}.tsx`
- `src/components/ui/{FilterTimeRange,PageSizeSelect}.tsx` (mới)
- `src/features/cases/components/{CaseDetailView,CaseFiltersForm}.tsx`
- `src/features/events/components/{EventFiltersForm,EventsExplorer}.tsx`
- `src/features/workspace-admin/components/{AdminForms,WorkspaceAdminView}.tsx`
- `src/pages/{CaseDetailPage,CasesPage}.tsx`, `src/index.css`
- `tests/{app-shell-ui,workspace-admin-ui,layout-redesign}.test.mjs`

Các thay đổi quản trị workspace từ đợt trước vẫn giữ trong working tree và được mô tả riêng trong `WORKSPACE_ADMIN_IMPLEMENTATION.md`. Không sửa `design.md`, backend hoặc root repository; không thêm dependency.

## Kiểm tra thực tế

- `npm test`: 229/229 đạt, chạy tuần tự.
- `npm run lint`: đạt.
- TypeScript app/config: `tsc -p tsconfig.app.json --noEmit --strict` và `tsc -p tsconfig.node.json --noEmit --strict`: đạt.
- `npm run build`: đạt, dùng public env hợp lệ từ mẫu; build không xác nhận kết nối API/SSO.
- `git diff --check`: đạt; Git chỉ nhắc chuyển LF/CRLF.
- Bổ sung kiểm tra SSR cho tên truy cập sidebar khi thu gọn, input thời gian vẫn tồn tại, lỗi thời gian được mở, lựa chọn số dòng, nháp phiên bản cũ và tổng quan hồ sơ tách riêng.

## Chưa xác minh

Công cụ trình duyệt timeout khi mở localhost và đọc frame, dù HTTP localhost trả 200. Vì vậy chưa xác nhận bằng tương tác hoặc ảnh chụp ở 390/768/1280/1440px, zoom 200%, reduced motion, bàn phím/focus thực tế, giữ nháp khi đóng/mở panel và đổi số dòng. SSR không thay thế kiểm tra này. Không chạy UAT API/Keycloak thật trong đợt layout.

Khi kiểm tra thủ công: thử thu gọn sidebar và dùng Tab; mở vai trò; nhập nháp bộ lọc rồi đổi số dòng; đóng/mở tác vụ hồ sơ và panel thành viên; thử Escape và focus quay lại; đổi workspace/đăng xuất để bảo đảm nháp được gỡ. Kiểm tra bảng chỉ cuộn trong vùng bảng và không đẩy rộng toàn trang trên mobile.
