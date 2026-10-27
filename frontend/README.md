# TraceWeaver Frontend

React + TypeScript + Vite, có cấu hình, routing, quản lý phiên Keycloak và Axios client.
Chưa triển khai service nghiệp vụ, workspace/phân quyền hoặc UI nghiệp vụ.

## Công cụ và phần đã làm

- Zod (`src/config/env.ts`): kiểm tra env khi Vite khởi động/build và trước khi mount React.
  Lỗi chỉ nêu tên biến, không in giá trị. API URL là HTTPS origin, không gồm `/api/v1`;
  Keycloak URL cho phép path `/identity`. URL không chứa credentials/query/fragment.
- Vite (`vite.config.ts`): local `http://localhost:5173`, `strictPort: true`;
  nếu cổng bận thì dừng, không tự chuyển sang 5174.
- Proxy development: chỉ `/api` tới `API_PROXY_TARGET`, giữ nguyên path và Authorization,
  kiểm TLS, bỏ Origin ở chặng server tới server. OAuth dùng issuer HTTPS thật;
  không proxy `/identity`, `/core` hoặc service secrets. Proxy không chạy trong production build.
- React Router: BrowserRouter, cấu hình trong `src/constants/routes.ts`.
  `/` hiển thị trạng thái phiên; callback thành công về `/` bằng replace;
  `*` hiển thị trang không tìm thấy. SDK xử lý code/state trước khi mount Router.
- Keycloak JS 26.2.4 (Apache-2.0, không phụ thuộc React): một instance, init một lần,
  Code flow + PKCE S256, response query, check-sso và tắt session-status iframe.
  Context + useSyncExternalStore theo dõi phiên, không sao chép token vào React state/Redux.
- TypeScript: `strict: true` cho app và Vite config; entrypoint kiểm tra DOM root thay assertion.

## Chạy local

Dùng Node 22.18+ hoặc 24 LTS, npm và lockfile hiện có; test dùng TypeScript stripping của Node.
Nếu chưa có dependencies, chạy `npm ci` từ thư mục `frontend/`.

```powershell
npm run dev
```

Tạo `.env.development.local` từ `.env.example`, đặt `VITE_API_BASE_URL=` rỗng cho local.
Nếu đã có `.env.development` thì giữ hoặc ghi đè bằng `.env.development.local`.
`VITE_API_BASE_URL=` rỗng ở local để API client gọi `/api/v1/...` qua Vite.
`API_PROXY_TARGET` chỉ dùng phía dev server, không có prefix `VITE_`.
Sau khi sửa env, khởi động lại Vite.

Kiểm tra bằng trình duyệt:

1. Mở `http://localhost:5173/`: kiểm phiên SSO qua Keycloak. Nếu chưa có phiên,
   redirect kiểm tra với prompt=none rồi trở lại FE, hiện nút đăng nhập.
2. Bấm đăng nhập và đăng nhập trên Keycloak; callback thành công chuyển về trang chủ.
3. Reload để kiểm lại SSO; bấm đăng xuất để kết thúc phiên và quay về origin ứng dụng.
4. Hủy login/callback lỗi phải hiện thông báo an toàn; lỗi init dùng tải lại trang, không init lại SDK.
5. Mở `/khong-ton-tai` khi phiên đã khởi tạo để kiểm tra trang không tìm thấy.

## Build và kiểm tra

```powershell
Copy-Item .env.example .env.production.local
npm run lint
npm test
npm run build
npm run preview
```

`.env.example` chứa toàn bộ biến công khai cho production; điều chỉnh theo deployment thực tế.
`.env.production.local` đã được Git bỏ qua. Không ghi mật khẩu, token hay client secret vào `VITE_*`.
Production bắt buộc API HTTPS origin khác rỗng cùng đủ ba biến Keycloak;
thiếu/sai env sẽ làm build dừng. `npm run build` chạy `tsc -b` với strict rồi Vite build.
Preview phục vụ bản build tại URL Vite in ra (mặc định cổng 4173), không dùng dev proxy.
Nếu thử auth trên preview, BE cần đăng ký riêng origin/callback cổng 4173; mặc định dùng dev 5173 để UAT.

## Quản lý phiên và giao diện tích hợp

- `src/features/auth/auth.ts` cung cấp `initializeAuth`, `signIn`, `signOut`, `getAccessToken`.
  `initializeAuth` được await trước mount, giữ chung Promise kể cả lỗi.
- `getAccessToken()` chia sẻ Promise refresh đang chạy, gọi `updateToken(30)` và chỉ trả access token.
  Khi refresh lỗi: clear token, cập nhật UI yêu cầu đăng nhập lại; không tự retry API.
  Refresh đến muộn sau logout không được trả token hoặc khôi phục phiên.
- `useAuth()` trong provider cung cấp trạng thái và các thao tác cho UI. Trạng thái gồm
  initializing/authenticated/unauthenticated/error, không chứa token hoặc quyền workspace.
- onTokenExpired gọi refresh; onAuthRefreshError/onAuthLogout cập nhật trạng thái.
  Tắt iframe đồng nghĩa logout tab khác được phát hiện ở lần refresh sau, không tức thì.
- Không persist access/refresh token hoặc log chúng. SDK tự quản lý dữ liệu giao dịch OAuth
  ngắn hạn (state/nonce/PKCE verifier); điều này khác với lưu token ứng dụng.
- SDK logout tạo request trước khi FE xóa token trong memory. Nếu điều hướng logout lỗi,
  FE báo chưa xác nhận kết thúc SSO; xóa local không được coi là đã logout toàn bộ Keycloak.

`npm test` dùng node:test, không thêm framework. Adapter giả kiểm tra lifecycle, refresh,
race với logout, lỗi và subscription; kiểm thử UI dùng SSR với Context giả, không chứng minh SSO thật.
UAT thật cần kiểm operator/viewer, hủy login, callback, reload, refresh và logout trên trình duyệt.

## Axios client — task 3

- `src/services/apiClient.ts` export `apiClient` dùng trong browser. Instance lấy API origin
  từ env đã validate; local origin rỗng đi qua Vite proxy. Factory `createApiClient` nhận
  baseURL và token provider để kiểm thử độc lập với Keycloak, không cần thư viện mới.
- Timeout HTTP mặc định 10 giây, Accept JSON, withCredentials=false để không gửi cookie
  khác origin. Axios tự đặt Content-Type JSON khi service gửi body dạng object.
  Không tự JSON.stringify body trong service nếu không có nhu cầu riêng.
- Mỗi request await `getAccessToken()` của auth trước khi gắn Bearer. Auth quản lý refresh
  dùng chung; client không tạo cơ chế refresh khác. Refresh thất bại thì request không gửi.
- Chỉ dùng path bắt đầu `/api/v1/`, gồm cả prefix. Client chặn URL tuyệt đối, đổi baseURL,
  Basic Auth và path traversal ra ngoài API scope trước khi gọi token provider.
  Không dùng instance này cho health public, Identity, core hoặc service bên ngoài.
- Giữ AxiosResponse khi thành công: service lấy `response.data`, còn headers/status vẫn có
  khi cần. Generic TypeScript không xác thực JSON lúc chạy; service phải validate boundary
  theo DTO khi cần. Client chỉ kiểm tra shape của phần lỗi chung.
- Client không retry, kể cả 401 hoặc GET. Không tự logout/redirect/alert khi lỗi HTTP.
  Session auth tự xóa phiên khi refresh thất bại; UI/caller xử lý HTTP 401 và 403 riêng.
- Service quyết định Idempotency-Key theo endpoint. Client chuyển nguyên key và body;
  không tự sinh hoặc thay key. POST timeout có thể đã commit ở BE.

`ApiError` có kind (`http`, `network`, `timeout`, `auth`, `client`), code, status và requestId.
Status/requestId là null nếu không có. HTTP 401 có kind=auth, 403 có kind=http.
Code backend hợp lệ được giữ, fallback HTTP_<status>. Request ID ưu tiên body.request_id,
rồi header X-Request-ID không phân biệt hoa/thường. Message dùng thông báo an toàn;
không đính kèm raw body, HTML, config, request hoặc cause có thể chứa token.
Network error không khẳng định là CORS vì browser có thể không cung cấp nguyên nhân.

Truyền AbortController.signal qua request config. Hủy khi chờ token kết thúc request ngay,
không hủy refresh chung; sau khi hủy, request đó không được gửi. Lỗi cancellation vẫn kiểm
tra bằng `axios.isCancel(error)`, không hiển thị như lỗi hệ thống. Abort POST không bảo đảm rollback.
Không log toàn bộ response, Axios config hoặc cancellation object vì có thể chứa Authorization.

Ví dụ gọi từ service (DTO và schema nghiệp vụ sẽ được thêm trong task tương ứng):

```ts
import axios from 'axios'
import { apiClient } from './src/services/apiClient'
import { ApiError } from './src/services/apiError'

const controller = new AbortController()
try {
  const response = await apiClient.get<unknown>('/api/v1/me', {
    signal: controller.signal,
  })
  // response.data là unknown: service validate theo DTO trước khi trả cho UI.
} catch (error: unknown) {
  if (axios.isCancel(error)) {
    // Thao tác hủy chủ động: không hiển thị lỗi hệ thống.
  } else if (error instanceof ApiError) {
    // Caller dùng kind/status/code để xử lý; requestId dành cho hỗ trợ.
  } else {
    throw error
  }
}
```

Đây là mẫu sử dụng, chưa triển khai service /me hoặc nối request vào UI.
`tests/api-client.test.mjs` dùng Axios adapter và token provider giả, kiểm token/refresh,
scope URL, cancellation khi chờ token/HTTP, các kiểu lỗi JSON/HTML/network/timeout,
request ID, không lộ token và POST không retry. `npm test` chạy cả tests auth và client.

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
Kiểm tra thực tế ngày 27/10/2026: authorize endpoint nhận request Code + PKCE S256 nhưng trả
`Invalid parameter: redirect_uri` cho `http://localhost:5173/auth/callback`.
Chưa thể nghiệm thu login/token exchange/refresh/logout thật trước khi BE đăng ký callback.
Không đặt thông tin đăng nhập vào source. Chưa nghiệm thu API có access token thật khi
callback local chưa được đăng ký; lỗi cấu hình Identity không được giải quyết bằng retry API.
Task 3 đã có HTTP client; tiếp theo là `/me` và workspace (task 4).
