# TraceWeaver Frontend

React + TypeScript + Vite, có cấu hình, routing, phiên Keycloak, Axios client, workspace/sources và event explorer.
Chưa triển khai reconstruction, dashboard hoặc các thao tác case.

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
Lần kiểm tra ban đầu gặp `Invalid parameter: redirect_uri`; khi kiểm task 4 ngày 27/10/2026,
callback local đã hoạt động. Operator và viewer đăng nhập, tải `/me` cùng ba nguồn thật
intake/account/provision, hiển thị đúng roles. Viewer làm mới quyền/nguồn và logout thành công;
UI xóa dữ liệu workspace sau logout. Khởi động lại dev server cũng khôi phục SSO operator.
Không đặt thông tin đăng nhập vào source. Lỗi cấu hình Identity không giải quyết bằng retry API.

## Workspace và quyền truy cập — task 4

`src/features/workspace/` gồm schema/service, reducer thuần, controller điều phối request,
Context/provider và panel tối thiểu trên trang chủ. Controller chỉ có một state trong memory;
React theo dõi bằng useSyncExternalStore và Context. Không có Redux store hoặc cache lưu đĩa.

- Service `getMe(signal)` đọc `/api/v1/me`; `listSources(workspaceId, options)` đọc sources.
  Dữ liệu được validate bằng Zod; sai UUID/role/group/source scope/DTO trả ApiError an toàn,
  không đưa payload gốc vào thông báo. Options gồm signal, cursor, limit mặc định 50/max 100.
- Provider chỉ bắt đầu sau auth authenticated. Không có membership thì dừng, hiện tài khoản
  chưa được cấp workspace. Một membership được tự chọn; nhiều membership cần chọn thủ công.
  Picker hiển thị workspace ID vì API không có tên. Reload phải lấy `/me` lại.
- `useWorkspace()` cung cấp state (/me, selectedWorkspaceId, sources), membership và permissions,
  cùng selectWorkspace/loadMoreSources/refreshAccess. Quyền dẫn xuất từ membership hiện tại;
  không decode JWT hoặc sao chép role sang state khác.
- Role đọc: viewer/operator/reviewer/admin. Role ghi: operator/reviewer. Xác minh: reviewer.
  Admin đơn thuần không có quyền ghi; ingest_service đơn thuần không phải role đọc browser.
  Đây là khả năng theo role cho UI, không bảo đảm đủ read grants, owner hoặc case guards.
- Sources phân trang cursor với nút tải thêm; không có total hoặc tổng trang. Workspace chỉ hiện
  nguồn BE trả về. Đổi workspace bỏ ngay sources/cursor cũ; không giữ selection nguồn ở task này.
- Logout/hết phiên/lỗi auth: ẩn ngay dữ liệu cũ rồi hủy request và reset state. Subject `/me`
  thay đổi không được kế thừa workspace của user trước. AbortController cùng request generation
  chặn response cũ ghi lại state, kể cả khi service/adapter không thực sự hỗ trợ abort.
- Focus cửa sổ hoặc bấm làm mới sẽ revalidate `/me`, gộp request trùng và ẩn dữ liệu/quyền cũ.
  Giữ workspace nếu cùng subject và còn membership, sau đó tải lại sources từ trang đầu.
  Không polling nền hoặc theo dõi quyền realtime; thay đổi quyền được phát hiện qua request.
- Sources 403/404: purge nguồn/cursor, recheck `/me` đúng một lần. Membership còn thì hiện lỗi
  truy cập và không tự lặp gọi sources; membership mất thì chọn scope hợp lệ hoặc hiện chưa cấp.
  HTTP 401 purge toàn bộ scope, dừng tự tải và hiện nút đăng nhập lại, không tự logout SSO.
- Lỗi network/timeout/schema có thông báo, request ID nếu có và nút thử lại. Cancellation
  không hiện lỗi hệ thống. Làm mới sau lỗi bắt đầu lại từ identity và cursor mới.

Kiểm thử: `npm run lint`, `npm test`, `npm run build` với env hợp lệ. Tests dùng node:test,
service/adapter giả và React SSR cho các trạng thái UI, không sửa grants trên BE.
Tổng 51 tests pass tại lần triển khai. Các ca nhiều/không workspace, mất quyền, 401/403/404, đổi user, request cũ, pagination,
cleanup kiểu StrictMode và dữ liệu sai contract được kiểm tự động. Chưa có dataset/tài khoản
thật cho mọi tình huống; không coi tests giả là nghiệm thu thu hồi grants trên production.

Kiến thức theo rule: kiến trúc service/feature (3,5), TypeScript strict + Zod (4), lifecycle và
cancellation/race condition (6), Context + reducer và state dẫn xuất (8), provider trong cây auth (9),
Axios/ApiError (10,12), phân quyền và keyboard/label/escape nội dung (14), kiểm thử/phạm vi (15,16).
Workspace không tự gọi API dashboard hoặc thao tác case.

## Event explorer — task 5

Mở `/events` từ link trang chủ. Route được lazy load qua React Suspense. Feature trong
`src/features/events/` gồm schema/service, query/form helpers, reducer/controller, Context/provider
và UI tối thiểu. Không thêm dependency; giữ nguyên phần workspace chưa commit.

- `listEvents(workspaceId, filters, {cursor, signal})` và `getEvent(workspaceId, eventId, signal)`
  dùng Axios client hiện có, validate JSON bằng Zod. API fields: source_id/from/to/action/q/limit;
  detail không gửi query. Không có filter outcome hoặc endpoint reconstruction ở task này.
- Filter đã áp dụng và event_id nằm trên URL; form dùng React Hook Form + Zod giữ bản nhập nháp.
  Chỉ bấm Tìm kiếm mới cập nhật URL và gọi API. URL lạ/lặp/sai UUID/time/limit không được gửi
  nguyên xuống backend. Trường chưa chọn được bỏ hẳn, không gửi chuỗi rỗng.
- Nhập thời gian theo Asia/Ho_Chi_Minh (UTC+7), chuyển sang UTC kết thúc Z khi submit;
  kiểm ngày thực và from <= to tới fractional seconds. Timestamp event/provenance nhận từ API
  giữ nguyên chuỗi và precision, dùng Date/Intl chỉ để hiển thị; không sửa hoặc serialize lại event.
- Mặc định 50/trang, UI cho chọn 25/50/100. Trước/Tiếp giữ stack opaque cursors trong memory,
  không cache payload mọi trang hoặc bịa total. Request các trang giữ nguyên filters/limit.
  Làm mới/filter/scope mới bỏ history và root để bắt đầu snapshot mới; event đến muộn không tự nối.
- Context `useEvents()` cung cấp state, filter/detail/page/refresh và selectRoot/clearRoot.
  List và detail có trạng thái/request riêng; AbortController + generation kiểm cả list và detail.
  Đổi detail không tải lại list; đổi trang đóng detail và giữ root trong cùng snapshot.
- Root chỉ được chọn từ detail đã validate thành công, khi role hiện tại có canWrite
  (operator/reviewer). Viewer/admin đơn thuần chỉ đọc. Root chứa Event đã xác minh trong memory,
  không lên URL/storage và không tự tạo run. Task 6 vẫn phải kiểm source scope và window.
- Mỗi response `/me` mới là một access scope mới dù subject/workspace ID không đổi. Khi
  workspace chưa ready, revalidate, đổi user/workspace hoặc logout, UI ẩn và purge events/root.
  Cùng subject/workspace sau revalidation giữ filter, bắt đầu snapshot mới; đổi scope xóa filter.
  Ra khỏi trang events dừng request; root có thể dùng tiếp trong cùng access scope cho task sau.
- 403/404 purge events và revalidate workspace một lần; giữ latch để không lặp khi `/me` vẫn
  cho thấy cùng membership. Thử lại do người dùng mới mở một lượt kiểm tra nữa. 401 dừng tải,
  hiện đăng nhập lại, không tự logout/retry. INVALID_CURSOR reset history/detail/root và chờ
  người dùng bắt đầu lại. Lỗi network/timeout/schema có thông báo an toàn và giữ filter.
- Bảng và detail chỉ dùng React text/JSON đã escape. Hiển thị outcome bằng text, identifiers,
  payload_redacted, parser version, batch_id, locator, sha256_redacted và UTC gốc. Source picker
  có tải thêm; source chưa nằm trong trang sources hiện tại không bị tự coi là mất quyền.

Kiểm thử bằng `npm run lint`, `npm test` (69 tests pass), `npm run build` với env hợp lệ và `git diff --check`.
Tests service/query/controller/UI SSR kiểm conversion UTC+7, microseconds, filter validation,
cursor, response ngược thứ tự, quyền/root, escape payload, 401/403/404 và cancellation.
Lần kiểm tra operator trên backend thật: login, route, form nháp, submit source/time/action/search
và limit hoạt động; danh sách events trả rỗng, không phải lỗi schema/network. Không ingest thêm
dữ liệu hoặc sửa grants để tạo demo. Detail/provenance/root và nhiều trang hiện kiểm bằng
fixtures; chưa được coi là UAT các phần đó trên dataset thật.

Viewer thật cũng đăng nhập, tải workspace/sources và events rỗng thành công; UI hiển thị
quyền đọc có, ghi không. Chưa kiểm root trên detail thật vì chưa có event trong kết quả.
Reload `/events` qua check-sso hiện có đi qua callback rồi về `/` theo luồng auth task 2;
chưa khôi phục URL events/filter sau vòng redirect này. Không thay đổi callback auth trong task 5.

Kiến thức theo rule: feature/service (3,5), TypeScript strict + Zod (4), async cleanup và race
condition (6), reducer/Context/state URL (8,9), Axios/RHF/ApiError (10–12), scope quyền,
escape nội dung/keyboard/semantic HTML (14), kiểm thử và giới hạn frontend (15,16).
