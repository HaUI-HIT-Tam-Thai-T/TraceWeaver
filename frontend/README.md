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

## Reconstruction — task 6

Trong `/events`, operator/reviewer chọn root từ detail đã validate để mở form tạo run.
Mặc định nguồn root, `rule_only`, window root ±5 phút. Nhập thời gian UTC+7 theo
`YYYY-MM-DDTHH:mm:ss.ffffff` (phần thập phân tùy chọn). Dùng text input để giữ precision
vượt milliseconds; không để native datetime input làm mất fractional seconds.
Source picker có tải thêm; không coi nguồn chưa nằm trong trang đầu là mất grant.

Feature `src/features/reconstruction/` tách schema, form helpers, service factory,
reducer/controller và UI. Service dùng Axios hiện có, trả Run/Graph đã validate Zod:
`createRun(workspaceId, body, {idempotencyKey, signal})`, `getRun(workspaceId, runId, signal)`
và `getGraph(workspaceId, runId, signal)`. Endpoint poll luôn được dựng từ workspace/run UUID
đã validate, không theo Location bên ngoài. Không thêm dependency.

- Trước POST đọc lại root detail, kiểm đúng ID/source và root trong window inclusive.
  UUID nguồn phải duy nhất, chứa nguồn root; window đúng thứ tự, tối đa một giờ. UTC API
  được giữ nguyên precision; phép so sánh duration dùng integer BigInt. BE quyết định grants
  và tối đa 1.000 events trước candidate filtering; FE không cắt dataset hoặc gửi action/q.
- Sinh `crypto.randomUUID()` một lần sau preflight cho thao tác, giữ body/key trong memory,
  khóa submit. Không tự retry POST. Network/timeout/5xx/response sai contract sau POST là
  kết quả chưa rõ: nút gửi lại dùng cùng body/key, kiểm root lại, trong TTL 24h. Đổi body
  phải bắt đầu thao tác mới; cảnh báo run trước có thể đã được tạo. Sau khi có run ID chỉ
  GET trạng thái/graph. Reload hoặc đổi scope không khôi phục thao tác từ storage.
- Xét Run.status thay vì HTTP 202: completed tải graph ngay; failed dừng và không gọi graph.
  Degraded là cờ trên run, không phải status; ai_unavailable vẫn hiển thị graph rule-only.
  Không hiển thị raw Run.error.message, chỉ mã hợp lệ và thông báo an toàn.
- Chỉ queued/running được poll, setTimeout sau mỗi response theo 1/2/4/8/10 giây,
  tối đa 5 phút mỗi lượt theo dõi. Không chồng request; dừng khi terminal/lỗi và cho kiểm tra
  tiếp thủ công. Hết thời gian theo dõi không có nghĩa run failed. Graph lỗi có nút tải lại;
  RUN_NOT_READY không tạo vòng lặp. Graph kiểm ID run, node/link/evidence references, source/window
  của attempt; giữ score null, review state, version, unresolved và nhãn chưa có bằng chứng.
- AbortController + generation bảo vệ request và timer. Đổi root/snapshot/scope, revalidation,
  logout hoặc rời route xóa artifact/key, dừng theo dõi; không tự POST khi quay lại. 401 yêu cầu
  đăng nhập; 403/404 purge và yêu cầu workspace revalidate một lần. Abort không hủy run ở BE.
- UI dùng bảng nodes/links/evidence và React escape. Chưa làm sơ đồ tương tác/review/case.

Kiểm tra triển khai: lint, toàn bộ 84 tests, build TypeScript strict với env hợp lệ và
`git diff --check`. Tests dùng adapter/service/timer giả và SSR: window biên/precision,
idempotency/double submit/TTL, completed/degraded/failed, polling/cleanup/stale responses,
401/403/404, graph sai contract/scope, escape và lỗi an toàn.
Các test SSR có cacheDir riêng trong node_modules/.tmp để không ghi đè cache dev server.

Đã kiểm tra operator thật: login/workspace/sources và `/events` hoạt động; danh sách events
không lọc trả rỗng. Chưa có root để nghiệm thu POST run, polling/degraded/graph trên deployment.
Không ingest dữ liệu hoặc sửa grants. Backend local còn mô tả runs planned; chưa xác nhận
tương thích production chỉ bằng tests giả. Dev server có sẵn ở 5173 được giữ chạy.

Kiến thức rule: service/feature và tách trách nhiệm (3,5); strict/Zod/RHF (4,11);
lifecycle, timer, cancellation/generation, reducer (6,8); scope auth/workspace, escape,
semantic HTML/label/keyboard (9,14); Axios, idempotency và lỗi/retry có chủ đích (10,12);
kiểm thử theo rủi ro, bảo toàn source và giới hạn frontend (15,16).

## Link review và manual link — task 7

Nhánh triển khai `ThienBao/feature/link-review-logic`. Feature `src/features/link-review/`
thêm service factory, schema/types và một panel dưới bảng graph của reconstruction.
Không thêm dependency. Các thay đổi có sẵn ở routes/WorkspacePanel và thay đổi workspace
khác trong lúc làm việc được giữ nguyên, không stage/commit thêm.

- Một form review cho link đang chọn: hướng, trạng thái, Link.version, accepted/rejected
  và reason. Một form manual gồm event nguồn/đích lấy từ nodes snapshot và reason.
  Chỉ operator/reviewer có controls ghi; run phải completed và graph ready.
- `reviewLink(wid, rid, lid, body, signal)` POST `/api/v1/workspaces/{wid}/runs/{rid}/links/{lid}/reviews`
  chỉ gửi decision/reason/expected_version. Version lấy từ link người dùng chọn, không lấy
  Graph.version và không tự tăng. Response Review được validate link/decision/link_version.
- `createManualLink(wid, rid, body, signal)` POST `/api/v1/workspaces/{wid}/runs/{rid}/links`
  chỉ gửi from_event_id/to_event_id/reason. Hai ID phải khác nhau, thuộc graph; cạnh cùng
  hướng đã tồn tại (kể cả rejected) được chuyển sang review. BE quyết định cycle/quyền.
  Response phải manual/pending/null score/version1, đúng pair. Schema Link dùng chung
  với graph; request/response đều Zod và TypeScript strict.
- Reason trim trước gửi, 1–1000 ký tự và không trắng. Không đưa nháp lên URL/storage/log.
  Form có label/fieldset, lỗi field, keyboard; nội dung render bằng React text đã escape.
- Controller reconstruction sở hữu graph và mutation, khóa cả hai form khi gửi hoặc graph
  chưa đồng bộ. Không optimistic update. POST thành công refetch graph; chỉ mở controls sau
  GET hợp lệ. Nếu GET lỗi vẫn báo POST đã ghi, nút tải lại chỉ GET. Giữ graph cũ trong memory
  cho lựa chọn/nháp nhưng không render bảng khi graph chưa ready; mất scope purge toàn bộ.
- Timeout/network/5xx/response sai contract sau POST: kết quả chưa rõ, GET graph đúng một lần,
  không tự gửi lại POST. Graph hiện tại không chứng minh ai đã ghi review bị mất response.
  Hai mutation không gửi Idempotency-Key, không dùng retry của createRun.
- VERSION_CONFLICT giữ reason/decision nháp, refetch và yêu cầu chọn sử dụng phiên bản hiện
  tại trước submit mới. LINK_EXISTS refetch và chọn cạnh có sẵn; SELF_LINK/LINK_CYCLE báo
  lỗi để sửa đề xuất. Không tự bỏ cạnh hoặc tính cycle thay BE.
- CASE_CLOSED khóa mutation theo run, vẫn đọc/refetch graph; GET không tự mở khóa. Nút
  Thử chỉnh sửa lại chỉ cho phép lần gửi chủ động tiếp theo được BE kiểm lại, không POST
  tự động hoặc gọi reopen. Bất kỳ case closed nào trên run đều có thể giữ khóa.
- 401 yêu cầu login; 403/404 purge artifact và revalidate workspace một lần. AbortController
  + generation chặn response POST/GET cũ sau đổi root/run/scope/logout/revalidation/rời route.
  Abort không chứng minh BE rollback; nháp được xóa khi panel/scope không còn hợp lệ.

Kiểm tra: lint không warning, build với env hợp lệ (tsc strict + Vite), toàn bộ 99 tests
và git diff --check. Test mới kiểm reason/DTO/Link.version khác Graph.version, accept/reject/
reaccept, duplicate/self/cycle, double submit, closed-case lock/probe, timeout không replay,
refetch thất bại sau commit, scope đổi giữa POST/GET và SSR controls/error/escape/readonly.
SSR dùng cache riêng node_modules/.tmp/ssr-link-review, không ghi đè cache dev server.

UAT: operator thật login/workspace/sources/events thành công, nhưng events không lọc trả rỗng.
Chưa có root/run/graph để nghiệm thu mutation thật. Không ingest hoặc sửa grants/case BE.
Không khẳng định tích hợp mutation đã hoàn tất chỉ dựa trên tests giả.

Kiến thức rule: service/feature và tách trách nhiệm (3,5); strict/Zod/RHF (4,11);
cleanup, reducer, cancellation/generation (6,8); Axios/Link.version/refetch/lỗi có phân loại
(10,12); auth scope, dữ liệu memory, escape và accessibility (9,14); kiểm thử/phạm vi (15,16).

## Case management — task 8

Nhánh `ThienBao/feature/case-management-logic`; chỉ frontend, không dependency mới.
Hai route lazy `/cases` và `/cases/:caseId`, link từ Home. `CasesProvider` dưới Router/Workspace
quản lý read state bằng Context + reducer/controller; chỉ fetch khi route cases và scope đọc
đang hợp lệ. Form tạo case nằm dưới kết quả run completed trong `/events`, controller riêng
gắn user/workspace/access scope/run/root. Các thay đổi source có sẵn hoặc phát sinh đồng thời
được giữ nguyên; không tự stage/commit/push.

### API và dữ liệu

- `createCase(wid, {run_id,title}, {idempotencyKey,signal})`: POST `/api/v1/workspaces/{wid}/cases`.
  Chỉ operator/reviewer; đọc lại run trước POST để xác minh completed và current grants.
  Title trim, có nội dung, tối đa 300. Không gửi state/owner/creator/workflow hoặc tự áp graph
  closed-case lock sang create case khi API không quy định.
- Sinh UUID key một lần sau preflight, giữ body/key trong memory và khóa submit. Timeout,
  network/5xx/response sai schema sau POST báo kết quả chưa rõ; retry thủ công giữ nguyên
  body/key trong 24h, kiểm TTL trước và sau preflight. Thao tác mới dùng key mới và có thể
  tạo thêm case. Không tự retry POST hoặc khôi phục attempt sau reload/đổi scope.
- POST thành công chỉ lấy case ID đã validate để điều hướng sang detail rồi GET mới. Không
  tin Case từ replay là workflow hiện tại; không đi theo Location tùy ý. Backend sở hữu
  state/owner/version; không tự tăng Case.version vì đọc/thêm evidence.
- `listCases(wid, filters, {cursor,limit,signal})` GET collection, `getCase(wid,cid,signal)`
  GET detail không query. Zod validate Case/Create/CasesPage/CaseDetail/WorkflowHistory/Evidence,
  UUID, subject (không bắt buộc UUID), workspace/run/case tương ứng và evidence.case_id.
  Detail phải là `{case,history,evidence}`, không phải Case hoặc LinkEvidence.

### Filter và pagination

- Form nháp RHF + Zod, chỉ bấm Tìm kiếm mới áp dụng một lần lên URL. Trường chưa chọn được bỏ.
  Filter: một state enum, owner_id là subject tối đa 255, from/to UTC, limit 25/50/100 mặc định50.
  Không có waiting tổng hợp, user lookup, run_id filter hoặc filter nhiều state ở API này.
- Thời gian nhập text UTC+7 `YYYY-MM-DDTHH:mm:ss.ffffff`, chuyển UTC và giữ microseconds;
  kiểm ngày/from<=to, không giới hạn một giờ. Filter áp **parent run.created_at**, không
  phải case.created_at, updated_at hoặc event.occurred_at. Không lọc case date lại ở FE.
- Trước/Tiếp giữ stack cursor trong memory, gửi đúng filters/limit; không cache payload mọi
  trang, offset/total hoặc bảo đảm snapshot. Cases là live-state, state có thể đổi giữa trang.
  Search/limit/refresh reset stack. INVALID_CURSOR chờ Bắt đầu lại; không retry vô hạn.
  Link detail giữ filter query để quay về danh sách; khi đổi route, list tải lại từ trang đầu.

### Detail và scope

- Hiển thị metadata Case, owner null là chưa được gán. History không có ID: action,
  from_state nullable/to_state, actor, reason, version, occurred_at, evidence_refs (evidence IDs).
  Evidence có kind/events hoặc note, event_ids, note, creator, timestamp; không nhầm các refs.
  Có empty/loading/error/retry, UI chỉ đọc, UTC gốc với precision và giờ UTC+7. React escape
  text; không log token/payload hoặc persist dữ liệu. Chưa có assign/transition/add evidence.
- List/detail/create có AbortController và generation; response cũ không thể khôi phục data.
  Scope chưa ready/revalidation/logout purge, ẩn ngay dữ liệu cũ. Cùng subject/workspace sau
  revalidation giữ URL rồi tải mới, không khôi phục cursor hoặc tự POST; đổi scope xóa filter/ID
  và về /cases. Đổi user/workspace remount form để bỏ nháp. Rời route dừng request đọc.
- 401 dừng và yêu cầu login; 403/404 purge dữ liệu phụ thuộc và revalidate một lần, không lặp
  tự động. Lỗi network/timeout/schema có retry GET và giữ nháp phù hợp. RUN_NOT_READY khi tạo
  yêu cầu kiểm tra run. Hủy chờ POST không chứng minh BE đã rollback.

### Kiểm tra

Lint, toàn bộ **116 tests**, build TypeScript strict + Vite với env hợp lệ và git diff --check.
Test service/query/controller/create/UI SSR (cache riêng) kiểm title/DTO, opaque owner, UTC+7,
run.created_at filter semantics, cursor, response ngược thứ tự, scope/401/403/404/cancellation,
key/body/TTL/double submit, replay chỉ lấy ID rồi đọc detail mới, owner null, history/evidence,
precision và escape. UI SSR dùng fixtures; không được coi là UAT dữ liệu thật.

Operator thật login, tải workspace/sources, /cases và bộ lọc state/time/limit thành công.
Nhập nháp chưa đổi URL; submit chuyển UTC giữ microseconds, window nhiều ngày được chấp nhận.
Cases hiện trả rỗng; chưa có case/run để nghiệm thu detail/history/evidence/create thật hoặc
nhiều trang. Không ingest hoặc sửa grants BE. Luồng auth giữ nguyên: reload qua check-sso
vẫn có thể về `/` thay vì khôi phục route sau callback. Dev server kiểm thử được dừng sau bàn giao.

Kiến thức rule: feature/service/tách trách nhiệm (3,5); strict/Zod/RHF (4,11); reducer/Context,
cleanup/AbortController/generation (6,8); params/URL filters/Link/lazy (9); Axios/idempotency/
cursor/lỗi (10,12); scope, escape, accessibility và kiểm thử/phạm vi (14–16).

## Case evidence — task 9

Nhánh `ThienBao/feature/case-evidence-logic`; chỉ frontend, không dependency mới.
Form dưới evidence tại `/cases/:caseId` mặc định Note. Chỉ operator/reviewer trong scope
ready và case chưa closed có quyền gửi; viewer/admin đơn thuần chỉ đọc. Chưa có workflow
transition/reopen, sửa hoặc xóa evidence.

- `addEvidence(wid, cid, {kind,event_ids,note}, signal)` POST
  `/api/v1/workspaces/{wid}/cases/{cid}/evidence`. Luôn đủ ba field; không gửi version,
  expected_version hoặc Idempotency-Key. Zod validate request và Evidence response,
  đúng case/kind/tập event IDs; không so note nguyên văn vì BE có thể redact.
- Note phải có nội dung không trắng, tối đa 10.000 ký tự; giữ nguyên newline/khoảng trắng.
  Note UI gửi event_ids=[] và không tải graph. Events chọn 1–1.000 UUID duy nhất thuộc
  graph snapshot của chính case.run_id; note được rỗng nhưng field vẫn bắt buộc. Đổi về
  Note xóa lựa chọn events, giữ note. Không nhập UUID tự do hoặc lấy từ Event explorer.
- Graph được tải lười khi chuyển Events, dùng getGraph đã validate run ID. Snapshot có
  loading/empty/error/retry GET; lỗi mạng/schema của picker không ngăn note nếu case còn
  hợp lệ. Không kết luận nguồn mất quyền từ lỗi mạng; 401/403/404 vẫn xử lý toàn artifact.
- CasesProvider/reducer/controller sở hữu snapshot và mutation. Khóa gửi trong POST/refetch,
  không optimistic append evidence/history, không tự tăng Case.version. POST xác nhận thành
  công mới xóa nháp; GET detail lấy evidence/history/version hiện tại (có thể đổi do workflow
  đồng thời). Form giữ mounted khi refetch, còn detail cũ không được hiển thị như dữ liệu mới.
- POST thành công + GET lỗi: báo đã lưu nhưng chưa đồng bộ, retry chỉ GET. Timeout/network/
  5xx/response sai schema sau POST: kết quả chưa rõ, GET detail đúng một lần, không replay
  POST. Giữ nháp; sau GET hợp lệ phải chủ động Bắt đầu thao tác evidence mới để gửi tiếp,
  cảnh báo có thể tạo bản trùng. Nội dung giống nhau trong detail không chứng minh actor
  hoặc request vừa rồi đã commit. GET lỗi giữ binding/nháp, không cho gửi khi chưa đồng bộ.
- CASE_CLOSED khóa form và đọc lại detail; cần reviewer xử lý ở workflow, không tự reopen.
  422 giữ input để sửa; 401 yêu cầu login; 403/404 purge và revalidate một lần. AbortController,
  generation và sequence snapshot chặn response cũ khi đổi case/run/user/workspace/access,
  mất quyền/revalidation/logout hoặc rời detail; xóa snapshot/nháp/mutation. Abort không
  chứng minh BE rollback. Note/payload chỉ memory, không URL/storage/log và dùng React escape.

Kiểm tra tự động: lint, build TypeScript strict với env hợp lệ, toàn bộ **131 tests** và
git diff --check. 15 tests mới kiểm limits, note giữ whitespace, exact body/no key/version,
DTO sai case/kind/refs, graph sai run, snapshot membership, closed/readonly, double submit,
timeout không replay, GET lỗi sau POST giữ binding, permissions và response cũ; Case.version
không tự tăng, version từ workflow đồng thời chỉ lấy qua GET. SSR dùng cache riêng.

Đã kiểm UI tương tác bằng fixture cục bộ (không gọi BE): Note không GET graph; timeout +
GET lỗi giữ nguyên textarea và khóa submit; GET thành công rồi xác nhận thao tác mới;
Events tải graph một lần; đổi Note xóa selection nhưng giữ note; submit Events thành công
gửi đúng IDs/body, GET detail lại, xóa nháp sau thành công và giữ Case.version theo fixture.
Fixture kiểm thử nằm trong node_modules/.tmp, không nằm trong production build.

UAT thật: BE hiện đã có dataset FE-DEMO-20261027-v1. Operator mở case demo
`02 - Cap moi truong that bai`, thêm một note đánh dấu FE-UAT Task9 và một evidence
tham chiếu event provision.failed trong snapshot của case.run_id (note rỗng hợp lệ).
Hai POST thành công, GET detail sau mỗi lần hiển thị evidence đã lưu; state vẫn new,
Case.version vẫn 1. Viewer đăng nhập lại đọc được cả hai evidence, không có form ghi.
Đã kiểm logout/đổi user xóa scope. Không ingest, đổi workflow hoặc sửa grants BE.
Timeout/GET lỗi/CLOSED/mất quyền được kiểm bằng tests/fixture, chưa cố tình gây trên BE thật.
Hai evidence UAT là append-only và được giữ trong case demo; không có API xóa ở task này.

Kiến thức rule: service/feature/tách form (3,5), TypeScript strict/Zod/RHF (4,11), reducer/
Context/lifecycle/AbortController/generation (6,8), Axios và phân loại kết quả POST/refetch
(10,12), scope/snapshot/escape/accessibility (9,14), kiểm thử theo rủi ro và phạm vi (15–16).

### Task 10 — Case workflow

Thêm form chuyển trạng thái trong detail: assign, start, request_verification,
verify_close, verification_failed, reopen. Owner là subject; nút Giao cho tôi lấy
/me.subject, không suy username hoặc gọi API users chưa có. FE kiểm state/role/owner,
evidence và note đã lưu; reviewer đóng case phải GET graph mới và kiểm pending links
trên toàn run. Reopen phải có reason khác verify_close gần nhất. BE vẫn kiểm grants,
owner còn hợp lệ và guard tại thời điểm ghi.

Service POST /cases/{cid}/transitions chỉ gửi action, expected_version (Case.version),
reason trim 1–1.000 ký tự, và owner_id chỉ khi assign. Một UUID Idempotency-Key cho một
thao tác sau preflight. Không tự retry POST, không tự cập nhật version/state/history.
Thành công luôn GET detail; GET lỗi sau thành công chỉ tải lại GET. VERSION_CONFLICT
giữ nháp, yêu cầu chủ động dùng version hiện tại. IDEMPOTENCY_CONFLICT không tự đổi key.

Timeout/network/5xx/DTO lỗi sau POST giữ body/key trong memory và GET detail một lần.
Gửi lại thủ công dùng đúng body/key trong 24 giờ (kiểm TTL trước/sau preflight), kể cả
khi POST trước đã thành công và state/version hiện tại thay đổi. Thao tác mới cần bấm
chủ động, có cảnh báo có thể ghi thêm transition. Form evidence và workflow dùng chung
khóa request. Logout/đổi scope/role/case/run/rời route hủy chờ, purge attempt và chống
response cũ bằng generation. Abort không chứng minh backend rollback.

Kiến thức rule sử dụng: service/feature (3,5); strict TypeScript, Zod, RHF (4,11);
Context/reducer, cleanup, cancellation/generation (6,8); role và owner theo scope,
semantic form/keyboard/escape (9,14); Axios, optimistic concurrency bằng Case.version,
idempotency và phân loại kết quả không rõ (10,12); kiểm thử theo rủi ro và phạm vi (15–16).

Nghiệm thu Task 10 ngày 27/10/2026: lint, build strict với env hợp lệ, toàn bộ 144 tests
và git diff --check đều pass. Tests bao gồm DTO/guard sáu action, owner/reviewer, pending
links, reopen reason, conflict, key/body/TTL, timeout đã commit, GET lỗi sau success,
double submit, event submit không được hiểu nhầm là replay, 401/403/404 và response cũ.

UAT operator trên case demo 02: assign thành công (version 2), start (version 3),
request_verification (version 4); mỗi lần GET lại detail/history từ BE. Case hiện ở
awaiting_verification, owner là subject operator. Ba reason có prefix FE-UAT Task10;
không thêm evidence hoặc sửa grants/config BE. UI operator chặn verify_close vì cần
reviewer. Ba action verify_close/verification_failed/reopen chưa nghiệm thu BE thật vì
chưa có tài khoản reviewer; đã kiểm bằng service giả/test. Timeout/conflict/TTL cũng
chỉ mô phỏng, không cố tình gây trên BE thật. Lỗi proxy EACCES ban đầu do sandbox;
chạy dev server với quyền kết nối được cấp đã tải /me/sources thành công.
Ảnh kiểm thử cục bộ: node_modules/.tmp/workflow-operator-real.png (không commit).

### Task 11 — Knowledge chỉ đọc

Route lazy `/knowledge`, liên kết từ trang chủ. Chỉ gọi
`GET /api/v1/workspaces/{wid}/knowledge` khi auth/workspace ready và có role đọc.
Form React Hook Form + Zod: nhập nháp, bấm Tìm kiếm mới áp dụng q/limit vào URL;
q tối đa 500 ký tự, giữ literal text, không xử lý wildcard hoặc lọc lại dữ liệu ở FE.
BE tìm substring không phân biệt hoa/thường trên title/body của latest version.
Mặc định 50, chọn 25/50/100. Không có API detail riêng hoặc API CRUD knowledge.

Phân trang Trước/Tiếp bằng cursor stack trong memory, không cache payload các trang
hoặc bịa tổng trang. Đổi q/limit hoặc Làm mới xóa lịch sử cursor và tải trang đầu.
INVALID_CURSOR/cursor lặp dừng tải và chờ thao tác bắt đầu lại; không tự retry vô hạn.
Knowledge không có bảo đảm snapshot cố định, bài viết/version có thể đổi giữa các GET.

Validate KnowledgeArticle/KnowledgePage: UUID, đúng workspace, title/body, version >=1,
subject, source_ref URI, timestamp UTC, duplicate IDs và next_cursor. UI đọc body trong
`details`, hiển thị version, source_ref, author subject, created_at UTC nguyên gốc.
Không có nút tạo/sửa/xóa, không có POST/PUT/PATCH/DELETE. Body/source_ref render bằng
React text; source_ref kể cả URN chỉ là tham chiếu, không mở link URI tùy ý hoặc render HTML.

Controller + reducer thuần, useSyncExternalStore và AbortController/generation:
response cũ không ghi đè query/scope mới. Auth/logout, mất quyền, đổi user/workspace,
revalidation và rời route purge payload/cursor và hủy chờ. URL q/limit giữ nguyên khi
đổi scope; form nháp reset, tải mới trang đầu sau khi scope hợp lệ. 401 yêu cầu đăng nhập;
403/404 purge và revalidate workspace một lần, latch qua revalidation để tránh loop.
Mạng/timeout/schema có retry GET, cancellation không hiển thị lỗi hệ thống.

Kiểm tra: toàn bộ 153 tests pass (9 test knowledge mới), lint và TypeScript strict.
UAT viewer với BE thật: mở /knowledge, list rỗng và tìm kiếm q có dấu thành công;
nhập nháp không thay URL, submit cập nhật URL rồi GET. BE hiện chưa có bài knowledge,
nên chưa nghiệm thu nội dung/version/source_ref và nhiều trang với dữ liệu thật.
Không tạo hoặc ingest bài mẫu. Đã kiểm UI bằng service giả cục bộ: đọc version 3/2,
source_ref URN/HTTPS, body có HTML được escape, Trước/Tiếp GET đúng trang và nút disabled.
Ảnh cục bộ trong node_modules/.tmp/knowledge-viewer-real.png và knowledge-content-fixture.png.

Kiến thức rule áp dụng: feature/service và tách UI (3,5); TypeScript strict, Zod,
RHF (4,11); effect cleanup, AbortController/generation, reducer/external store (6,8);
Router/lazy/search params (9); Axios/cursor/ApiError (10,12); scope quyền, escape,
semantic HTML/keyboard (14); node:test/SSR và giữ phạm vi frontend (15–16).

### Task 12 — Dashboard, thời gian và waiting drill-down

Route lazy /dashboard, liên kết từ trang chủ. GET dashboard hiển thị đúng bốn counter
runs, degraded_runs, unresolved_events, waiting_cases; số 0 là dữ liệu hợp lệ, không
thay lỗi/loading bằng số 0. unresolved_events là occurrence cộng theo từng run completed,
không phải event duy nhất toàn hệ thống. Không tự suy run-list/global-unresolved endpoint.

RHF/Zod quản lý form nháp from/to nhập UTC+7; bấm Áp dụng mới chuyển UTC và cập nhật URL.
Kiểm ngày hợp lệ, from <= to, giữ precision, cho phép một biên hoặc không giới hạn thời gian.
Cả dashboard và list cases dùng from/to inclusive theo parent run.created_at.
Validate Dashboard DTO: số nguyên không âm, safe integer, filters echo đúng thời điểm yêu cầu.

Nút Xem waiting cases mở hai query riêng state=new và state=assigned, cùng from/to,
50/trang. Mỗi danh sách có status/error/cursor Trước/Tiếp riêng, tái sử dụng Cases controller;
không gửi multi-state, không ghép cursor, không đếm trang đầu làm tổng counter.
Hai danh sách là live-state, có thể quan sát tại các thời điểm khác nhau. Link detail giữ
state/from/to; Browser Back trở lại URL dashboard với filter và GET dữ liệu mới.

Bổ sung workspaceMutations (chỉ truyền workspace ID, không lưu payload/token). Service
production createRun, reviewLink, createManualLink, createCase, addEvidence và transitionCase
phát thông báo sau mỗi lần thao tác kết thúc, gồm cả lỗi/kết quả chưa rõ. Không đổi body/key,
không replay POST. Khi dashboard đang mở, thông báo đúng workspace hủy GET cũ, ẩn dữ liệu,
GET lại counters và reset cả hai drill-down. Khi rời dashboard không tải nền hoặc giữ cache;
quay lại luôn GET mới. Không triển khai realtime/polling dashboard hoặc đồng bộ tab khác.
Subscriber lỗi bị gỡ, không được làm đổi kết quả mutation hay kích hoạt retry.

Scope/auth/mất quyền/rời route purge dữ liệu và hủy request; generation ngăn response cũ.
401 yêu cầu đăng nhập; 403/404 ở counter hoặc waiting list purge dashboard, revalidate một
lần và latch qua access reload để tránh lặp. Network/timeout/schema có retry GET thủ công.

Kiểm thử tự động: 162 tests pass, gồm 9 test dashboard mới cho DTO, time/precision,
zero counters, single-state queries/cursor riêng, mutation invalidation, lỗi auth/quyền,
subscriber lỗi không đổi kết quả POST, stale response và SSR accessibility.

UAT operator trên dataset FE-DEMO-20261027-v1 ngày 27/10/2026:
- Window 27/10 theo UTC+7 trả runs=12, degraded_runs=4, unresolved_events=9, waiting_cases=5.
- Waiting có 2 new + 3 assigned. Mở demo 05 từ drill-down giữ from/to và Case.version=2.
- Start demo 05 thành công, investigating/version=3; reason có prefix FE-UAT Dashboard.
  Quay lại cùng URL dashboard GET mới: waiting_cases=4, gồm 2 new + 2 assigned;
  case demo 05 rời waiting. Các counter còn lại giữ 12/4/9.
- Window 01/12/2026 trả bốn số 0 và cả hai danh sách rỗng.
Không ingest, sửa grants hoặc tạo case/run để kiểm thử. Không nghiệm thu pagination nhiều
trang, review/manual link và timeout thật do không tạo thêm tình huống/dataset BE;
các tình huống đó kiểm bằng service giả. Ảnh: node_modules/.tmp/dashboard-after-mutation.png.

Kiến thức rule: feature/service (3,5); strict TS/Zod/RHF (4,11); reducer, external store,
cleanup/cancellation/generation và subscription (6,8); Router/lazy/URL filters (9);
Axios, cursor và refetch sau mutation (10,12); scope/grants, escape/keyboard (14);
node:test/SSR, giữ thay đổi không liên quan và phạm vi frontend (15–16).
