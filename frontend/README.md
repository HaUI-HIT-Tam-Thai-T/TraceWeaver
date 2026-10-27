# TraceWeaver Frontend

Nền tảng React + TypeScript + Vite. Nhánh foundation chuẩn bị cấu hình và routing;
chưa triển khai đăng nhập Keycloak, API client hoặc UI nghiệp vụ.

## Công cụ và phần đã làm

- Zod (`src/config/env.ts`): kiểm tra env khi Vite khởi động/build và trước khi mount React.
  Lỗi chỉ nêu tên biến, không in giá trị. API URL là HTTPS origin, không gồm `/api/v1`;
  Keycloak URL cho phép path `/identity`. URL không chứa credentials/query/fragment.
- Vite (`vite.config.ts`): local `http://localhost:5173`, `strictPort: true`;
  nếu cổng bận thì dừng, không tự chuyển sang 5174.
- Proxy development: chỉ `/api` tới `API_PROXY_TARGET`, giữ nguyên path và Authorization,
  kiểm TLS, bỏ Origin ở chặng server tới server. OAuth dùng issuer HTTPS thật;
  không proxy `/identity`, `/core` hoặc service secrets. Proxy không chạy trong production build.
- React Router: BrowserRouter, routes tập trung trong `src/routes/AppRoutes.tsx`.
  `/` là trang chủ; `/auth/callback` là route chuẩn bị cho auth;
  `*` hiển thị trang không tìm thấy. Callback chưa xử lý code/token và không giả đăng nhập thành công.
- TypeScript: `strict: true` cho app và Vite config; entrypoint kiểm tra DOM root thay assertion.

## Chạy local

Dùng Node tương thích Vite 8 (20.19+ hoặc 22.12+), npm và lockfile hiện có.
Nếu chưa có dependencies, chạy `npm ci` từ thư mục `frontend/`.

```powershell
npm run dev
```

`.env.development` chứa cấu hình công khai theo tài liệu bàn giao. Không cần tạo env để chạy local.
Muốn thay cấu hình máy mình, sao chép sang `.env.development.local` (được Git bỏ qua).
`VITE_API_BASE_URL=` rỗng ở local để API client tương lai gọi `/api/v1/...` qua Vite.
`API_PROXY_TARGET` chỉ dùng phía dev server, không có prefix `VITE_`.
Sau khi sửa env, khởi động lại Vite.

Kiểm tra bằng trình duyệt:

1. Mở `http://localhost:5173/` và thấy TraceWeaver.
2. Mở trực tiếp `http://localhost:5173/auth/callback`, nhấn reload;
   thấy thông báo đăng nhập chưa sẵn sàng, không phải lỗi 404 từ server.
3. Mở `/khong-ton-tai`, thấy trang không tìm thấy; bấm về trang chủ.
4. Khi dev server đang chạy, chạy thêm `npm run dev`: tiến trình thứ hai phải báo cổng bận.

## Build và kiểm tra

```powershell
Copy-Item .env.example .env.production.local
npm run lint
npm run build
npm run preview
```

`.env.example` chứa toàn bộ biến công khai cho production; điều chỉnh theo deployment thực tế.
`.env.production.local` đã được Git bỏ qua. Không ghi mật khẩu, token hay client secret vào `VITE_*`.
Production bắt buộc API HTTPS origin khác rỗng cùng đủ ba biến Keycloak;
thiếu/sai env sẽ làm build dừng. `npm run build` chạy `tsc -b` với strict rồi Vite build.
Preview phục vụ bản build tại URL Vite in ra (mặc định cổng 4173), không dùng dev proxy.

## Deploy SPA và phụ thuộc tiếp theo

Deploy thư mục `dist/`. Hosting phải phục vụ static assets trước và fallback `index.html`
cho các đường dẫn React, bao gồm `/auth/callback`; cấu hình dev không tự cấu hình hosting.
Ví dụ location trên Nginx dành riêng cho frontend:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

BE/vận hành cần đăng ký callback `http://localhost:5173/auth/callback`, Web Origins,
production CORS và post-logout redirect trước khi kiểm auth/API thật.
Nhánh tiếp theo bổ sung `keycloak-js`, init PKCE một lần trước mount React,
sau đó mới API client và workspace. Không có request API hay token storage trong foundation.
