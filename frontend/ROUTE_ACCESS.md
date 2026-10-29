# Protected routes và loader

## Luồng truy cập

- `AppLayout → ProtectedRoute → WorkspaceAccessState → trang nghiệp vụ`.
- Chỉ `authenticated` mới render Outlet của ProtectedRoute. Khi đang xác minh phiên,
  hiển thị Loader; khi chưa đăng nhập hoặc lỗi, hiển thị hành động phù hợp. Không tự mở SSO khi render.
- WorkspaceAccessState kiểm tra `/me`, workspace được chọn và quyền đọc hiện tại.
  Trạng thái chờ, lỗi, thiếu quyền hoặc cần đăng nhập lại đều không render trang con.
- `/` được bảo vệ trước khi chuyển sang Dashboard. `/auth/callback` và trang 404 vẫn công khai.
- Provider giữ nguyên vị trí và cơ chế purge/cancel hiện có. Chặn route không cấp thêm quyền ghi
  và không thay kiểm tra quyền của backend.
- Render React ngay khi bootstrap để Loader xuất hiện trong lúc khởi tạo Keycloak.
  AuthSession vẫn khởi tạo SDK một lần và không gọi API nghiệp vụ khi chưa xác thực.
- Khi mở/reload web mà chưa có callback xác thực, AuthSession tự mở Keycloak một lần,
  không qua màn hình bấm Đăng nhập của FE. Có phiên SSO thì Keycloak trả về ứng dụng;
  chưa có phiên thì hiện form Keycloak. Trong lúc chuyển hướng chỉ hiện Loader.
  Gọi login trực tiếp sau init, không dùng login-required để tránh clearToken tự mở login
  chen vào quá trình logout. Lỗi init/chuyển hướng không tự thử lại liên tục.
- Loader vòng xoay được dùng cho chờ phiên, quyền và lazy page. Skeleton tải dữ liệu giữ nguyên.
  Loader có `role=status`, thông báo đọc được và ngừng quay khi người dùng chọn reduced motion.

## File thay đổi trong lượt này

- `src/routes/ProtectedRoute.tsx` (mới)
- `src/components/ui/Loader.tsx` (mới)
- `src/routes/AppRoutes.tsx`
- `src/routes/PageLoadFeedback.tsx` (giữ các chỉnh sửa định dạng đã có)
- `src/components/layout/WorkspaceAccessState.tsx`
- `src/features/auth/components/AuthStatus.tsx`
- `src/main.tsx`
- `tests/protected-route.test.mjs` (mới)
- `tests/app-shell-ui.test.mjs`
- `tests/routes-ui.test.mjs`
- `tests/workspace-ui.test.mjs`
- `tests/fixtures/protected-route.html` và `protected-route.tsx` (mới)
- `ROUTE_ACCESS.md` (mới)
- Bổ sung luồng mở thẳng Keycloak: `src/features/auth/state/session.ts`,
  `tests/auth-session.test.mjs` và hướng dẫn đăng nhập trong `README.md`.

## Kiểm tra ngày 29/10/2026

- `npm test` sau đổi mở thẳng Keycloak: 212/212 đạt, không fail/cancel/skip; khoảng 36,2 giây.
  Log: `node_modules/.tmp/direct-login-tests.log`. Trong đó 14 test AuthSession kiểm tra
  tự chuyển hướng đúng một lần, không hiện guest screen, callback đã xác thực không mở login lại,
  redirect lỗi không lặp, PKCE, refresh, logout và response muộn.
- `npm run lint`: đạt, không cảnh báo.
- TypeScript app/config với `--incremental false`: đạt, giữ strict.
- `npm run build`: đạt với public env từ `.env.example` trong tiến trình.
  Log sau đổi mở thẳng Keycloak: `node_modules/.tmp/direct-login-build.log`.
- `git diff --check`: đạt.
- Test guard ngăn render child/load lazy module khi auth chưa xác minh, hết phiên, lỗi,
  workspace đang tải, không có quyền đọc hoặc cần đăng nhập lại. Callback/404 vẫn mở được.
- Trình duyệt fixture tại 1280×900 và 390×844: loader phiên/quyền/trang; đăng nhập chỉ chạy
  khi bấm nút; tài khoản có quyền đọc mở được trang; thu hồi quyền gỡ nội dung ngay;
  API yêu cầu đăng nhập lại chặn nội dung. Không gọi Keycloak hoặc backend trong fixture.
- Ảnh: `node_modules/.tmp/protected-loader-desktop.png`, `protected-loader-mobile.png`.
- Khi kiểm tra mở `http://localhost:5173/`, công cụ trình duyệt gặp chặn xét duyệt tự động tại
  origin `https://api.quizlearn.tech`: domain chưa được cấp quyền quan sát và có thể chứa dữ liệu riêng tư.
  Không tiếp tục mở origin đó hoặc đi đường vòng. Chưa xác nhận form Keycloak hiển thị;
  cần người dùng cho phép origin trước khi thử lại kiểm tra trình duyệt.
- Chưa nghiệm thu đăng nhập/logout với Keycloak thật, API thật hoặc phản hồi mạng chậm thật.
  Reduced motion đã có CSS và assertion; chưa bật thiết lập hệ thống để kiểm tra trực quan.
