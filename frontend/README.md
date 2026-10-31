# TraceWeaver Frontend

Ứng dụng React/TypeScript dùng Vite, Context, Axios, React Hook Form và Zod. Hỗ trợ workspace, sự kiện, hồ sơ, tái dựng, tri thức, quản trị thành viên và sandbox kiểm chứng nghiệp vụ.

## Cấu trúc

```text
src/
├── app/                  # Provider toàn ứng dụng
├── components/
│   ├── ui/               # UI dùng chung
│   └── layout/           # Header, sidebar, layout
├── config/               # Kiểm tra cấu hình môi trường
├── constants/            # Route và tiêu đề trang
├── features/
│   ├── auth/
│   ├── workspace/
│   │   └── admin/
│   ├── events/
│   ├── cases/
│   │   └── sandbox/
│   ├── reconstruction/
│   │   └── review/
│   ├── dashboard/
│   └── knowledge/
├── hooks/                # useAuth, useWorkspace, useEvents, useCases, usePageTitle
├── pages/                # Màn hình lắp ráp feature theo route
├── routes/               # Router, guard, lazy loading
├── services/             # Axios, token, lỗi, endpoint, khóa mutation dùng chung
├── styles/               # global.css và variables.css
├── types/                # auth, workspace, events, cases, reconstruction
├── utils/                # Hàm thuần dùng chung
├── App.tsx
└── main.tsx
```

Component nghiệp vụ nằm trong feature; Context, Provider, reducer và controller giữ trong `state/` cạnh nhau. Service đặt trực tiếp trong feature: `createCasesService.ts` là factory, `casesService.ts` là instance dùng chung. Các nhóm admin/sandbox/review nằm trong miền tương ứng.

Types chia sẻ suy ra từ schema Zod bằng `z.infer`, import schema bằng `import type`; props và state riêng giữ cạnh nơi sử dụng. `services/endpoints.ts` chỉ xây đường dẫn; service nghiệp vụ vẫn kiểm tra ID, body và response. Axios giữ response đầy đủ để service đọc `response.data`.

`styles/global.css` import Tailwind rồi `variables.css`; token nằm nguyên trong `@theme`. Tài nguyên truy cập bằng URL ở `public/`; chỉ tạo `src/assets/` khi có tài nguyên thực tế cần import.

## Chạy local

Chạy trong thư mục `frontend/`, dùng Node.js tương thích Vite hiện có (Node 22.12+ hoặc 24 LTS) và npm:

```powershell
npm ci
Copy-Item .env.example .env.development.local
npm run dev
```

Mở http://localhost:5173. Vite dùng strict port; nếu port đang bận, dừng đúng tiến trình đang dùng trước khi chạy lại. Đăng nhập qua Keycloak public client; phiên còn hiệu lực được khôi phục theo luồng hiện có. Quyền lấy từ membership workspace của `/me`; FE guard không thay kiểm tra quyền ở BE.

## Cấu hình công khai

Xem `.env.example` để lấy giá trị mặc định:

| Biến | Ý nghĩa |
| --- | --- |
| `VITE_API_BASE_URL` | HTTPS origin của API, không kèm path; service tự thêm `/api/v1` |
| `VITE_KEYCLOAK_URL` | HTTPS URL của Keycloak |
| `VITE_KEYCLOAK_REALM` | Realm đăng nhập |
| `VITE_KEYCLOAK_CLIENT_ID` | Public client của FE |

Mọi biến `VITE_*` đều xuất hiện trong bundle trình duyệt. Không đưa mật khẩu, client secret hoặc token vào env công khai, URL, log hay storage. File `.env.*.local` giữ ở máy; không commit. API origin phải cho phép CORS và Keycloak phải cấu hình redirect URI cho origin local. API base rỗng chỉ dành cho môi trường dev phục vụ API cùng origin; Vite hiện không cấu hình proxy API.

## Kiểm tra và build

```powershell
npm run lint
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --strict
node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit --strict
Copy-Item .env.example .env.production.local
npm run build
npm run preview
git diff --check
```

Production yêu cầu API origin HTTPS hợp lệ. Build xuất ra `dist/`; máy chủ triển khai cần SPA fallback về `index.html` cho deep link. Không dùng preview làm máy chủ production.

## Giới hạn kiểm chứng

Baseline trước khi tổ chức lại: **254/254 test đạt**, chạy tuần tự. Thư mục tests/fixtures và script `npm test` đã được xóa theo phạm vi dọn dự án; các lệnh lint, strict typecheck và build vẫn giữ.

Kiểm tra tĩnh/build không chứng minh luồng SSO, phân quyền, race, delivery hay proof chạy đúng trên hệ thống thật. Cần smoke test trên trình duyệt với tài khoản/workspace kiểm thử: đăng nhập, đổi workspace, route lazy/deep link, Events, hồ sơ/sandbox và quản trị; kiểm tra desktop/mobile, bàn phím và zoom. Không tự sửa hồ sơ mẫu đã đóng hoặc reset dữ liệu server.

Quy tắc làm việc xem `AGENTS.md` và `rule.md`; định hướng giao diện ở `design.md`, dependency ở `DEPENDENCIES.md`.
