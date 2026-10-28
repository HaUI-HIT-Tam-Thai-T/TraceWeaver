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

### Task 13 — Kiểm thử tích hợp xuyên module

Nhánh ThienBao/feature/integration-tests. Thêm integration-fixtures.mjs,
integration.test.mjs và integration-ui.test.mjs. Không thêm dependency hoặc sửa source
production trong task này. Fixture dùng AuthSession thật với SDK giả, Axios instance và
adapter giả, các service Zod/controller thật; subscription trong fixture mô phỏng dây nối
Auth/Workspace/Events/Cases và cleanup tương ứng provider. Vì vậy đây là integration
service/controller, không thay thế browser E2E toàn bộ React provider tree.

10 test mới kiểm:
- Auth → /me/sources → event detail/root → create run completed HTTP202/graph → review
  bằng Link.version → create case → evidence → assign/start/request verification →
  reviewer fail/close/reopen → dashboard. UI SSR trang detail thật kiểm role controls.
- Viewer/admin chỉ đọc; operator không verify; reviewer lấy quyền từ /me revalidation.
- Concurrent Axios services dùng chung SDK refresh; hủy một request không hủy refresh
  chung. Refresh thất bại không gửi HTTP và purge toàn bộ artifact/attempt đang có.
- Logout trong POST đang chờ, response muộn không khôi phục dữ liệu; revalidation/đổi
  subject khi event detail đang chờ không ghi payload của user cũ vào scope mới.
- VERSION_CONFLICT của link refetch graph, không replay; Case.version conflict giữ
  thao tác, chỉ gửi sau xác nhận version mới với key mới.
- Create case timeout đã commit: retry thủ công giữ đúng body/key; evidence timeout chỉ
  đọc lại detail, không tự gửi POST hoặc tự tăng Case.version.
- Mất grants khi vẫn còn membership: 403 purge case/graph/dashboard/knowledge, /me lấy
  scope mới và sources rỗng, không loop; mất membership tiếp theo purge toàn bộ scope.

UAT thật ngày 27/10/2026 (operator):
1. Chọn root event 85553210-b8ff-4fdc-94b7-54b56fdbfd80 từ dataset FE-DEMO hiện có.
2. Tạo run 98fbc5d8-20b8-46c8-a32a-ff5854d17b7d với ba nguồn, rule_only/root±5 phút;
   completed, graph 3 nodes/2 links. Accept một link: Link.version 1→2, graph revision2.
3. Tạo case d4b425d6-db18-43fe-b09d-b16dcd8dd4da có tiêu đề prefix FE-UAT Integration;
   GET detail mới; thêm note 16d6533c-f15c-427a-8ffd-de9014c3c33f, Case.version giữ1.
4. Hai tab giữ version1. Tab đầu assign thành công version2; tab thứ hai submit nháp
   version1 bị preflight VERSION_CONFLICT, giữ nguyên reason và yêu cầu chủ động dùng
   version hiện tại. History chỉ có một assign. Case được giữ assigned/version2.
5. Mở tab thứ hai đã đi qua check-sso thành công và trở về home (giới hạn route callback
   hiện có); chưa khôi phục deep link tự động. Không sửa auth redirect ở task này.

Giới hạn nghiệm thu: người dùng xác nhận không có tài khoản reviewer, nên reviewer
fail/close/reopen chỉ kiểm bằng fixture/SSR. Trình duyệt cục bộ bị tắt trong Work settings
khi tiếp tục phiên, không thể hoàn tất logout/đổi viewer thật trong lượt kiểm này. Các
lượt task trước đã kiểm viewer chỉ đọc; không gộp kết quả cũ thành UAT mới. Logout,
refresh token, retry timeout, mất grants và purge xuyên module đã pass mô phỏng; chưa
cố tình thu hồi grants hoặc gây lỗi hạ tầng trên BE thật. Không thay config/grants BE.
Một run, một case, một note và một review UAT thật được giữ lại; không tự xóa dữ liệu.
Chưa có ảnh UAT mới được lưu thành công trước khi browser bị tắt.

Kết quả: npm run lint pass; npm test 172/172 pass, không skip (10 integration mới).
Build strict với env hợp lệ và git diff --check được chạy khi bàn giao.
Kiến thức rule: test theo rủi ro (15–16), service boundary/DTO strict (3–5,10), lifecycle,
shared refresh/cancellation/generation/cleanup (6,8), scope/role/owner và purge (9,14),
optimistic concurrency, idempotency và phân loại kết quả chưa rõ (12).


### Sắp xếp thư mục feature

Đã di chuyển 53 file theo trách nhiệm trong 8 feature; giữ nguyên tên file, exports,
API, route và logic. components/ chứa UI của feature; services/ chứa API/factory;
state/ chứa state/reducer/controller/Context/Provider. schemas.ts, query.ts, form.ts,
workflow.ts và types.ts giữ ở gốc feature khi hiện có. Không thêm Redux store, barrel
index.ts, dependency hoặc thư mục rỗng. Pages vẫn ở src/pages/, HTTP client và
workspaceMutations vẫn ở src/services/, tests vẫn ở tests/.

Danh sách file đã di chuyển (đường dẫn tính từ frontend/):

**auth**

- `src/features/auth/AuthStatus.tsx` → `src/features/auth/components/AuthStatus.tsx`
- `src/features/auth/auth.ts` → `src/features/auth/services/auth.ts`
- `src/features/auth/AuthProvider.tsx` → `src/features/auth/state/AuthProvider.tsx`
- `src/features/auth/authContext.ts` → `src/features/auth/state/authContext.ts`
- `src/features/auth/session.ts` → `src/features/auth/state/session.ts`

**workspace**

- `src/features/workspace/WorkspacePanel.tsx` → `src/features/workspace/components/WorkspacePanel.tsx`
- `src/features/workspace/createWorkspaceService.ts` → `src/features/workspace/services/createWorkspaceService.ts`
- `src/features/workspace/service.ts` → `src/features/workspace/services/service.ts`
- `src/features/workspace/WorkspaceProvider.tsx` → `src/features/workspace/state/WorkspaceProvider.tsx`
- `src/features/workspace/workspaceContext.ts` → `src/features/workspace/state/workspaceContext.ts`
- `src/features/workspace/controller.ts` → `src/features/workspace/state/controller.ts`
- `src/features/workspace/state.ts` → `src/features/workspace/state/state.ts`

**events**

- `src/features/events/EventsExplorer.tsx` → `src/features/events/components/EventsExplorer.tsx`
- `src/features/events/EventFiltersForm.tsx` → `src/features/events/components/EventFiltersForm.tsx`
- `src/features/events/createEventsService.ts` → `src/features/events/services/createEventsService.ts`
- `src/features/events/service.ts` → `src/features/events/services/service.ts`
- `src/features/events/EventsProvider.tsx` → `src/features/events/state/EventsProvider.tsx`
- `src/features/events/eventsContext.ts` → `src/features/events/state/eventsContext.ts`
- `src/features/events/controller.ts` → `src/features/events/state/controller.ts`
- `src/features/events/state.ts` → `src/features/events/state/state.ts`

**reconstruction**

- `src/features/reconstruction/ReconstructionPanel.tsx` → `src/features/reconstruction/components/ReconstructionPanel.tsx`
- `src/features/reconstruction/RunResult.tsx` → `src/features/reconstruction/components/RunResult.tsx`
- `src/features/reconstruction/GraphTable.tsx` → `src/features/reconstruction/components/GraphTable.tsx`
- `src/features/reconstruction/createReconstructionService.ts` → `src/features/reconstruction/services/createReconstructionService.ts`
- `src/features/reconstruction/service.ts` → `src/features/reconstruction/services/service.ts`
- `src/features/reconstruction/controller.ts` → `src/features/reconstruction/state/controller.ts`
- `src/features/reconstruction/state.ts` → `src/features/reconstruction/state/state.ts`

**link-review**

- `src/features/link-review/LinkReviewPanel.tsx` → `src/features/link-review/components/LinkReviewPanel.tsx`
- `src/features/link-review/createLinkReviewService.ts` → `src/features/link-review/services/createLinkReviewService.ts`
- `src/features/link-review/service.ts` → `src/features/link-review/services/service.ts`

**cases**

- `src/features/cases/CasesLayout.tsx` → `src/features/cases/components/CasesLayout.tsx`
- `src/features/cases/CasesFeedback.tsx` → `src/features/cases/components/CasesFeedback.tsx`
- `src/features/cases/CaseFiltersForm.tsx` → `src/features/cases/components/CaseFiltersForm.tsx`
- `src/features/cases/CaseDetailView.tsx` → `src/features/cases/components/CaseDetailView.tsx`
- `src/features/cases/CreateCasePanel.tsx` → `src/features/cases/components/CreateCasePanel.tsx`
- `src/features/cases/EvidenceForm.tsx` → `src/features/cases/components/EvidenceForm.tsx`
- `src/features/cases/WorkflowForm.tsx` → `src/features/cases/components/WorkflowForm.tsx`
- `src/features/cases/createCasesService.ts` → `src/features/cases/services/createCasesService.ts`
- `src/features/cases/service.ts` → `src/features/cases/services/service.ts`
- `src/features/cases/CasesProvider.tsx` → `src/features/cases/state/CasesProvider.tsx`
- `src/features/cases/casesContext.ts` → `src/features/cases/state/casesContext.ts`
- `src/features/cases/controller.ts` → `src/features/cases/state/controller.ts`
- `src/features/cases/createCaseController.ts` → `src/features/cases/state/createCaseController.ts`
- `src/features/cases/state.ts` → `src/features/cases/state/state.ts`

**knowledge**

- `src/features/knowledge/KnowledgeView.tsx` → `src/features/knowledge/components/KnowledgeView.tsx`
- `src/features/knowledge/createKnowledgeService.ts` → `src/features/knowledge/services/createKnowledgeService.ts`
- `src/features/knowledge/service.ts` → `src/features/knowledge/services/service.ts`
- `src/features/knowledge/controller.ts` → `src/features/knowledge/state/controller.ts`

**dashboard**

- `src/features/dashboard/DashboardView.tsx` → `src/features/dashboard/components/DashboardView.tsx`
- `src/features/dashboard/WaitingCaseList.tsx` → `src/features/dashboard/components/WaitingCaseList.tsx`
- `src/features/dashboard/createDashboardService.ts` → `src/features/dashboard/services/createDashboardService.ts`
- `src/features/dashboard/service.ts` → `src/features/dashboard/services/service.ts`
- `src/features/dashboard/controller.ts` → `src/features/dashboard/state/controller.ts`

Cập nhật 301 tham chiếu import/module trong source, main.tsx, pages và tests (gồm
ssrLoadModule). Đối chiếu nội dung 117 file source/tests với HEAD sau chuẩn hóa đường
dẫn: không có thay đổi ngoài path, không có module reference thiếu hoặc path cũ.

Kiểm tra: lint pass, TypeScript strict/build với env hợp lệ pass, 172/172 tests pass.
HTTP smoke trên server có sẵn tại localhost:5173: tám URL gồm home/events/cases/detail/
knowledge/dashboard/callback/not-found và bảy entry/page modules đều 200. Không mở được
Vite thứ hai vì port 5173 đã được dùng; giữ nguyên tiến trình đang có, không đổi cổng.
Chưa nghiệm thu lại tương tác UI/login qua browser trong refactor này.

## React cơ bản với TSX

Đã chuyển phần kết nối React với session/controller từ `useSyncExternalStore`
sang `useState` và `useEffect`. Mỗi component đăng ký listener của controller hiện
có, đọc lại state ngay sau đăng ký để không bỏ lỡ thay đổi giữa render và effect,
và gỡ listener khi cleanup. Không tạo hook subscription tổng quát hoặc nguồn state
nghiệp vụ mới; snapshot trong React chỉ phục vụ render. Các guard theo auth/scope,
AbortController, generation, polling và khóa mutation của controller được giữ nguyên.

Routes giữ tám đường dẫn và mỗi object chỉ có `path`, `element`. Lazy/Suspense cho
năm page là ngoại lệ được người dùng yêu cầu riêng, mô tả ở mục Lazy loading bên dưới.
Không tăng giới hạn cảnh báo, thay cấu hình strict hoặc thêm thư viện để che cảnh báo.

Các file thay đổi trong lượt này:

- `src/features/auth/state/AuthProvider.tsx`
- `src/features/workspace/state/WorkspaceProvider.tsx`
- `src/features/events/state/EventsProvider.tsx`
- `src/features/cases/state/CasesProvider.tsx`
- `src/features/reconstruction/components/ReconstructionPanel.tsx`
- `src/features/cases/components/CreateCasePanel.tsx`
- `src/features/dashboard/components/WaitingCaseList.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/KnowledgePage.tsx`
- `src/constants/routes.ts`
- `tests/routes-ui.test.mjs`
- `README.md`

Kiến thức sử dụng: function component TSX, props/children, `useState`, `useEffect`
và cleanup, `useRef`, Context, custom hook đơn giản, React Router và React Hook Form
hiện có. Reducer/controller thuần JavaScript tiếp tục phục vụ nghiệp vụ và kiểm thử;
không sử dụng thêm hook React nâng cao hoặc Redux.

Kiểm tra tại bước chuyển React cơ bản trước khi thêm ngoại lệ lazy: lint không có
cảnh báo, 173/173 tests và build strict pass. Kết quả hiện tại ở mục Lazy loading.

Kiểm tra trên trình duyệt với operator và BE thật: đăng nhập, callback, reload SSO,
workspace với ba sources; list/detail events, chọn root và form mặc định; revalidate
quyền xóa root/reconstruction; bốn counter dashboard và hai danh sách waiting new/
assigned; case list/detail (mở liên kết bằng bàn phím), history/evidence và guard
reviewer; Knowledge search/empty; logout xóa dữ liệu workspace khỏi UI. Reload qua
check-sso vẫn quay về trang chủ theo luồng auth hiện có. Proxy cần chạy dev server
ngoài sandbox vì kết nối API trong sandbox bị EACCES.

Lượt này không gửi mutation nghiệp vụ để tạo run/case hoặc ghi review/evidence/
transition; các tình huống này được bao phủ bằng test hiện có. Chưa kiểm lại tài
khoản viewer trên BE thật; không có tài khoản reviewer thật. Các thay đổi chưa commit
từ những lượt trước được giữ nguyên; không commit/push.

## Lazy loading theo page

Dashboard, Events, Cases, Case Detail và Knowledge dùng `React.lazy` ở cấp module
với dynamic `import()`. `.then(module => ({ default: module.Page }))` giữ named export
của page hiện có. Home, callback đăng nhập và 404 vẫn import trực tiếp; không đổi
đường dẫn, DTO/API hoặc cơ chế quản lý phiên/quyền.

`AppRoutes` bọc `Routes` bằng `Suspense`; các provider vẫn nằm bên ngoài. Khi code
chưa tải xong, `PageLoading` hiện “Đang tải trang…” với `role="status"`. Đây là loading
module, độc lập loading API của từng feature. Nếu import thất bại, loader trả về
`PageLoadError` với thông báo an toàn và nút “Tải lại trang”; không hiện raw error,
không tự retry, gọi lại POST hoặc thêm class Error Boundary. Kết quả loader được React
cache; khi đã lỗi, người dùng tải lại toàn trang để bắt đầu lần tải mới. Cơ chế này
chỉ xử lý lỗi import, không thay thế xử lý lỗi render/API.

Đo bằng `npm run build -- --manifest`: năm page đều có `isDynamicEntry: true` và không
nằm trong tập dependency tĩnh của entry. Bảng tính JavaScript của entry cộng toàn bộ
dependency tĩnh dùng chung, không chỉ riêng file entry:

| Chỉ số | Import trực tiếp trước đó | Lazy hiện tại |
| --- | --- | --- |
| Entry JavaScript | 596.371 kB | 231.552 kB |
| Tổng JavaScript ban đầu (gồm shared chunks) | 596.371 kB | 484.832 kB |
| Tổng gzip của các file ban đầu | 180.479 kB | 155.632 kB |

JavaScript ban đầu giảm 18,7%; gzip giảm 13,8%. Đơn vị kB = 1.000 bytes; gzip dùng
cùng `node:zlib.gzipSync` trên từng file rồi cộng, không phải số đo băng thông thực tế
trên browser. CSS và request dữ liệu API không nằm trong bảng. Build không còn cảnh
báo chunk trên 500 kB; không thay ngưỡng cảnh báo hoặc cấu hình strict.

File đổi trong lượt lazy loading:

- `src/constants/routes.ts`
- `src/routes/AppRoutes.tsx`
- `src/routes/PageLoadFeedback.tsx` (mới)
- `tests/routes-ui.test.mjs`
- `rule.md` (ngoại lệ routing; file local đang bị Git ignore)
- `README.md`

Kiểm tra: lint sạch, 175/175 tests pass, build TypeScript strict với env hợp lệ và
`git diff --check` pass. Test routes dùng streaming SSR đợi đủ tám page/guard; có
module chậm để xác nhận loading rồi nội dung, module lỗi để xác nhận thông báo an
toàn/nút reload và không tự thử import lại khi render lại.

Trình duyệt production preview tại localhost:5173: Home/callback tải trực tiếp,
Knowledge tải động; mô phỏng thiếu file chunk Knowledge trong dist để kiểm tra lỗi,
khôi phục file rồi bấm reload và tải được trang. Back/Forward giữa Home và Dashboard
hoạt động. Login/callback production chạy được nhưng request API cross-origin không
nhận được response tại môi trường này; không kết luận nguyên nhân là CORS.

Với Vite dev/proxy local đã có: operator truy cập được cả năm lazy page, dashboard
counter, 13 cases và detail/history/evidence, 36 events, Knowledge empty; không gửi
mutation nghiệp vụ. Reload vẫn qua check-sso rồi về Home theo auth hiện có, kể cả URL
không tồn tại. 404 được kiểm bằng SSR; chưa xác nhận màn hình 404 khi mở trực tiếp trên
browser do luồng auth đó. Không mở rộng nhiệm vụ sang sửa auth hoặc BE. Giữ các thay
đổi chưa commit trước đó; không thêm dependency, commit hoặc push.

## UI Foundation — trắng và xanh dương

Theme hiện tại ở `src/index.css` dùng Tailwind v4 `@theme`: canvas #F5F8FC, panel #FFFFFF,
control #F1F5FB, line #D7E1EE, primary #0066CC (hover #0057AD), focus/link #005EB8,
foreground #172B4D, muted #52627A, success #18794E, warning #8A5A00, danger #C62828.
Native controls dùng color-scheme: light. Đây là palette mới thay cho theme xám đậm trước đó.
Font Segoe UI/Roboto/system, spacing theo bước 4px, control tối thiểu 40px, bo 6px.
Chỉ dùng token và component chung thay vì chép màu vào từng feature.

Component tại `src/components/ui/`, import trực tiếp từng file. Sau chuyển đổi shadcn/ui,
các wrapper này dùng primitive và dependency mô tả bên dưới:

- `Button`: variant primary/secondary/ghost/danger; mặc định type=button. Form phải đặt
  type=submit rõ ràng. loading khóa button và đặt aria-busy; caller cung cấp nhãn đang xử lý.
- `Input`, `Select`: native props, label/aria-describedby/aria-invalid và ref của register()
  được chuyển tới DOM. React 19 nhận ref qua props, không cần forwardRef.
- `Badge`: tone neutral/info/success/warning/danger; luôn cung cấp nội dung trạng thái.
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`: composition
  HTML semantic, caption bắt buộc, vùng cuộn ngang focus được. Không có sorting/cursor nội bộ.
- `LoadingState`, `EmptyState`, `ErrorState`: nội dung an toàn do caller cung cấp;
  ErrorState có requestId/action tùy chọn, không tự xử lý lỗi hoặc retry request.

Ví dụ dùng trong form React Hook Form hiện có (giả định register/errors được lấy từ useForm):

```tsx
import { Input } from './components/ui/Input';
import { Button } from './components/ui/Button';

// Bên trong form đã có onSubmit:
<label htmlFor="query">Tìm kiếm</label>
<Input id="query" {...register('q')} aria-invalid={!!errors.q}
  aria-describedby={errors.q ? 'query-error' : undefined} />
{errors.q && <p id="query-error" role="alert">{errors.q.message}</p>}
<Button type="submit" loading={isSubmitting}>Tìm kiếm</Button>
```

Đã tích hợp ở HomePage, AuthStatus, WorkspacePanel và PageLoadFeedback. Sources hiển thị
bảng với ID xuống dòng; vai trò dùng badge, quyền và API vẫn do module hiện có quản lý.
Input được kiểm tra bằng fixture SSR, chưa thay form nghiệp vụ. Các trang nghiệp vụ hiện
nhận font/nền chung; thiết kế lại từng trang, sidebar/header và theme Keycloak ngoài phạm vi.
Không thêm dữ liệu mẫu hoặc route xem mẫu vào ứng dụng.

Kiểm thử: `tests/ui-foundation.test.mjs` kiểm native props/ref, variants, disabled/loading,
HTML semantic, escape và feedback; tests auth/workspace/routes kiểm tích hợp các trạng thái.
SSR không thay kiểm tra bàn phím, tương phản hoặc layout thực tế trong trình duyệt.

Kết quả kiểm tra UI Foundation (28/10/2026): lint, 176/176 tests và build strict pass;
git diff --check không có lỗi whitespace. Browser: desktop/mobile 390px, login operator,
callback, logout, workspace thật với 3 sources, picker và focus bằng bàn phím đã kiểm.
Mobile: viewport 390px, document 375px (không tràn ngang); bảng rộng 576px trong vùng
292px, ArrowRight thay đổi scrollLeft. Các trạng thái rỗng/lỗi auth và quyền được kiểm bằng
SSR; lỗi proxy thực tế cũng hiển thị thông báo an toàn. Chưa kiểm lại toàn bộ vai trò và
mutation nghiệp vụ trong lượt UI này. Tương phản: white/primary 5.57:1,
foreground/panel 13.51:1, muted/panel 7.72:1, focus/panel 6.59:1.


### Component từ shadcn/ui

Bộ UI hiện dùng source thực từ registry chính thức `new-york-v4`:
https://ui.shadcn.com/r/styles/new-york-v4/{name}.json
với button, input, native-select, badge, table, alert, empty, spinner.
Hướng dẫn cài thủ công: https://ui.shadcn.com/docs/installation/manual

- `src/components/ui/primitives/`: source shadcn có data-slot, cn và các variant chuẩn.
- `src/components/ui/`: wrapper giữ API primary/danger, loading, tone, caption hiện có;
  LoadingState dùng Spinner, EmptyState dùng Empty, ErrorState dùng Alert.
- `components.json`: cấu hình shadcn, alias `ui` trỏ vào primitives. Alias @ được khai báo
  trong TypeScript/Vite; import nội bộ primitive dùng relative để SSR tests chạy độc lập.
- `src/lib/utils.ts`: cn kết hợp clsx và tailwind-merge, giải quyết class Tailwind xung đột.
- Dependency mới: @radix-ui/react-slot, class-variance-authority, clsx, tailwind-merge,
  lucide-react. Không cài package bao toàn bộ Radix. Lockfile đi kèm.

Tùy biến source: đường dẫn import; Slot từ gói Radix riêng; chỉ export component để
Fast Refresh không cảnh báo; Empty dùng kiểu div khớp DOM; Spinner tôn trọng reduced motion;
Native Select wrapper full width; Table nhận containerProps cho vùng cuộn focus bằng bàn phím.
Các surface bg-muted của source được ánh xạ sang secondary vì token muted hiện dùng cho chữ.
Không dùng CLI init ghi đè CSS; theme semantic shadcn ánh xạ về palette TraceWeaver hiện có.

NativeSelect giữ select/option native, onChange/ref và giá trị hiện có thay vì đổi sang Select
popup với API khác. Badge wrapper dùng ghost, border-0 và bg-transparent theo yêu cầu.
VariantProps/ComponentProps/ClassValue là kiểu có sẵn của thư viện dùng ngay tại điểm tích hợp;
không tự xây mapped/conditional types. asChild trong source được thư viện Radix quản lý;
wrapper nghiệp vụ chỉ dùng button/span thông thường.

Khi thêm primitive sau này: chạy `npx shadcn@latest add <name>` trong frontend, chỉ thêm
component đang cần; kiểm diff trước khi ghi đè primitive đã tùy biến, giữ wrapper/theme.

Kiểm tra sau chuyển shadcn: lint sạch, 176/176 tests pass, build strict và diff --check pass.
Preview component độc lập đã kiểm nhập Input/chọn NativeSelect; 5 Badge đều có background
transparent và border 0px, Input có nền #343E4D. Preview là build artifact kiểm thử, không
thêm route vào source. Chưa nghiệm thu lại luồng API thật sau chuyển đổi; cổng 5173 đang
có dev server nên không dừng tiến trình đó. Khởi động lại dev server sau cập nhật dependency
và alias nếu phiên đang chạy chưa nhận cấu hình mới.

### Typography của TraceWeaver

Đây là quy ước typography riêng, tương thích theme shadcn/ui; không phải component
Typography được cài từ registry. Không thêm package hoặc component bọc. Class được định nghĩa
trong `src/index.css` ở layer components, dùng token rem; font Segoe UI/Roboto/sans-serif.

| Class | Size / line-height (px tại root 16px) | Weight | Dùng cho |
| --- | --- | --- | --- |
| type-h1 | 28/36 mobile; 32/40 từ 640px | 600 | Tiêu đề trang |
| type-h2 | 24/32 | 600 | Khu vực chính |
| type-h3 | 20/28 | 600 | Nhóm nội dung |
| type-h4 | 18/24 | 600 | Nhóm nhỏ |
| type-body | 16/24 | 400 | Nội dung |
| type-body-sm | 14/20 | 400 | Nội dung phụ/bảng |
| type-label | 14/20 | 500 | Nhãn input/link điều hướng |
| type-caption | 12/16 | 400 | Metadata/chú thích |
| type-code | 13/20, Consolas/Courier New/monospace | 400 | UUID/mã |

```tsx
<h1 className="type-h1">Sự kiện</h1>
<p className="type-body mt-3">Nội dung chính của trang.</p>
<label htmlFor="search" className="type-label block">Tìm kiếm</label>
<p className="type-caption mt-2 text-muted">Thông tin bổ sung.</p>
<code className="type-code break-all">10000000-0000-4000-8000-000000000015</code>
```

Class không đặt margin, màu hoặc heading level; chọn thẻ theo cấu trúc nội dung.
Ví dụ h2 trong thẻ điều hướng có thể dùng type-h3 để gọn hơn nhưng vẫn là h2 trong cây HTML.
Không nhảy cấp heading chỉ vì muốn chữ nhỏ, không dùng code cho toàn bộ văn bản thông thường.
Màu dùng text-foreground/text-muted hoặc token trạng thái; layout tự quản lý spacing.
Không gán style lên mọi h1/p, không bọc app bằng Typeset; không thêm class Typography React.

Tokens text-xs/sm/base/lg/xl/2xl có line-height rõ để shadcn dùng cùng thang chữ.
Với wrapper shadcn, dùng utility text/leading/font tương ứng token vì utility của primitive
có thể ghi đè class ở layer components; cn giải quyết utility xung đột. Không ghép thêm
utility cỡ chữ cạnh type-* khi không có chủ đích ghi đè. Input/Select vẫn 16px, Button/Badge
và bảng giữ typography theo primitive và token chung. Thông báo lỗi không line-clamp.

Đã áp dụng: Home, AuthStatus, WorkspacePanel, AuthCallbackPage, PageLoadFeedback,
LoadingState, EmptyState, ErrorState. Các trang nghiệp vụ chưa thiết kế lại chữ trong lượt này.

Kiểm tra typography (28/10/2026): lint sạch, 176/176 tests pass, build strict pass.
Preview cô lập dùng component thật với Context giả (không gọi API): 9 cấp chữ có computed
font-size/line-height/weight đúng bảng; H1 desktop 32/40px, mobile 390px là 28/36px.
Mobile document width 375px trong viewport 390px, không tràn ngang. Kiểm text scaling 200%
bằng root font-size 32px: H1 mobile 56/72px, bảng cuộn riêng (1152px trong vùng 212px),
message dài có clientHeight=scrollHeight nên không bị cắt. Chưa xác minh browser zoom 200%
thật vì phím zoom không làm đổi mức zoom trong công cụ. Chưa chạy luồng API/login thật
trong lượt typography; preview không thêm route hoặc fixture vào source ứng dụng.

File sửa riêng cho typography: src/index.css, src/pages/HomePage.tsx,
src/features/auth/components/AuthStatus.tsx, src/features/workspace/components/WorkspacePanel.tsx,
src/pages/AuthCallbackPage.tsx, src/routes/PageLoadFeedback.tsx,
src/components/ui/LoadingState.tsx, src/components/ui/EmptyState.tsx,
src/components/ui/ErrorState.tsx, tests/auth-ui.test.mjs, tests/workspace-ui.test.mjs,
tests/ui-foundation.test.mjs và README.md. Không sửa primitive shadcn hoặc dependency trong lượt này.

## AppShell — Header / Sidebar / Main

Nhánh triển khai: `ThienBao/feature/app-shell-ui`. Layout dùng theme và typography hiện có.

- `src/components/layout/AppLayout.tsx`: một Main với Outlet/Suspense, skip link, state sidebar
  mobile, cleanup listener matchMedia và đóng Sheet khi location.key thay đổi.
- `AppHeader.tsx`: logo về `/dashboard`, workspace picker từ memberships, role badge, refreshAccess,
  đăng nhập/đăng xuất. Không suy tên/email từ token. Khi workspace đang xác minh lại, picker
  disabled, bỏ options/role cũ; Header không tự gọi `/me` trong effect hoặc render.
- `AppSidebar.tsx`: NavLink tới dashboard/events/cases/knowledge; Cases active tại detail.
  Sidebar desktop 240px, Header 64px; breakpoint desktop 1024px. Main padding responsive,
  min-width 0; bảng cuộn trong component. `/` không có mục active riêng.
- `WorkspaceAccessState.tsx`: presentation guard; mặc định Outlet, hoặc nhận children cho
  vùng sources của Home. Phân biệt auth init/error/unauthenticated, workspace loading/error/
  reauth, không membership, chưa chọn, membership không hợp lệ/không có quyền đọc và ready.
  Không tự gọi API hoặc lưu quyền; nút thao tác gọi hành động của provider hiện có.
- `PublicLayout.tsx`: main gọn cho `/auth/callback` và `*`, không có Header/Sidebar.

`src/constants/routes.ts` có APP_ROUTES (6) và PUBLIC_ROUTES (2), ROUTES tổng hợp vẫn 8
object path/element. AppRoutes dùng nested route AppLayout + WorkspaceAccessState;
App không bọc thêm main. Năm business page vẫn lazy; Suspense ở Main nên shell giữ nguyên
khi chờ code. Đường dẫn `/` chuyển sang `/dashboard`; HomePage cũ không còn được route sử dụng; page nghiệp vụ
bỏ nav/AuthStatus/WorkspacePanel lặp lại. CasesLayout vẫn giữ guard và key scope riêng;
provider/controller/auth/API và cơ chế abort/purge không bị viết lại.

Sidebar mobile dùng source Sheet chính thức:
https://ui.shadcn.com/r/styles/new-york-v4/sheet.json
ở `src/components/ui/primitives/sheet.tsx`, import trực tiếp @radix-ui/react-dialog.
Đây là dependency trực tiếp mới duy nhất; lockfile đi kèm. Source đổi import cn/Dialog,
nhãn Close thành Đóng menu, bỏ class animation cần plugin. Dialog quản lý Escape, overlay,
focus trap và restore focus; có SheetTitle/Description và aria-modal. Không thêm Redux,
useMemo/useCallback hoặc animation package. Source dùng kiểu thư viện tại điểm tích hợp.

### Kiểm tra AppShell

- `npm run lint`: sạch. `npm test`: 177/177 pass. `npm run build`: TypeScript strict và Vite
  pass, không có chunk vượt ngưỡng cảnh báo. `git diff --check`: pass (có thông báo LF/CRLF).
- SSR kiểm đủ 8 route, một Main, callback/404 không Sidebar, case detail active Cases,
  loading/error lazy giữ Header/Sidebar, guard không gọi auth/selection/refresh khi render.
- `tests/app-shell-ui.test.mjs` kiểm auth/workspace states, purge thông tin Header khi
  revalidation; lỗi sources riêng không chặn nội dung route khi membership/read còn hợp lệ.
  Các controller regression tests hiện có tiếp tục kiểm stale response, đổi scope và logout.
- `tests/fixtures/shell.html` + `app-shell.tsx` là fixture tương tác riêng qua Vite, Context giả,
  không Keycloak/API, không thêm route vào ứng dụng và không nằm trong build production.
  Mở `/tests/fixtures/shell.html` khi dev để thử các trạng thái. Các URL con của fixture chỉ
  phục vụ Back/Forward trong phiên; reload fixture dùng URL gốc trên.
- Browser fixture: 390px không tràn toàn trang, Sheet mở/đóng, chọn mục đóng menu,
  Tab quay vòng trong Sheet, Escape/overlay trả focus về trigger; resize sang 1280px đóng
  Sheet. Header đo 64px, Sidebar 240px. Cases detail active, Back/Forward đã kiểm.
  Revalidation ẩn payload/role cũ và khóa picker; ingest_service đơn thuần bị chặn đọc;
  logout ẩn nội dung. Các trạng thái khác được kiểm SSR.
- Browser thật: operator đăng nhập qua Keycloak, Home có 3 sources; navigation Cases/Events/
  Dashboard/Knowledge dùng chung shell, một picker/main; mobile Home 390px không tràn ngang.
  Reload qua check-sso vẫn có thể về `/`: giới hạn có sẵn, không sửa redirect auth trong task.
  Lỗi proxy EACCES ban đầu do sandbox được kiểm lại sau khi chạy Vite với quyền mạng được duyệt.
- Chưa kiểm lại mọi mutation, tài khoản viewer/reviewer thật hoặc thu hồi grants trên BE.
  Không có tài khoản reviewer, không sửa grants/dataset/case BE để tạo tình huống thử.

Các file thay đổi: package.json/lockfile; App, constants/routes, routes/AppRoutes;
5 component layout + primitive Sheet; Home/Events/Dashboard/Knowledge/NotFound pages;
WorkspacePanel và CasesLayout; tests auth-ui/routes-ui/workspace-ui/app-shell-ui và fixture;
README này. Không thay provider/controller/service, không commit/push.


### Trang vào mặc định

`/` chuyển thẳng đến `/dashboard` bằng Navigate replace, không thêm trang chào vào lịch sử.
Logo, link trở về của callback/404 và callback đăng nhập thành công đều trỏ `/dashboard`.
Chưa đăng nhập/chưa chọn workspace vẫn thấy AppShell và guard tương ứng, không tải dữ liệu
Dashboard khi quyền chưa hợp lệ. Năm page lazy và tám đường dẫn hiện có được giữ nguyên.
HomePage/WorkspacePanel cũ chưa xóa để tránh gộp dọn source không liên quan vào thay đổi này.

### Icon — MUI Icons

Theo yêu cầu mới, toàn bộ icon runtime chuyển sang `@mui/icons-material`.
Nguồn và hướng dẫn chính thức: https://mui.com/material-ui/material-icons/

| Vị trí | Icon MUI |
| --- | --- |
| Tổng quan | DashboardOutlined |
| Sự kiện | TimelineOutlined |
| Cases | FolderOpenOutlined |
| Tri thức | MenuBookOutlined |
| Menu mobile / làm mới | Menu / Refresh |
| Đóng Sheet / mũi tên Select | Close / KeyboardArrowDown |
| Loading | Autorenew |

Import trực tiếp từng icon để tránh barrel import toàn bộ thư viện:

```tsx
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';

<DashboardOutlined sx={{ fontSize: '1.25rem' }} aria-hidden="true" />
```

Sidebar/menu dùng 1.25rem; refresh/close/select/loading dùng 1rem. `sx.fontSize` quy định
kích thước SVG vì SvgIcon có style width/height riêng; màu vẫn kế thừa currentColor từ
Tailwind/theme. Icon trang trí aria-hidden; accessible name nằm trên button/link.
Spinner tiếp tục role/nhãn của LoadingState và animate-spin/motion-reduce:animate-none.

Dependency: @mui/icons-material, @mui/material, @emotion/react, @emotion/styled; đã gỡ
lucide-react khỏi package/lockfile. Material/Emotion là dependency để SvgIcon hoạt động,
không thêm CssBaseline/ThemeProvider, font CDN hoặc thay UI shadcn sang component MUI.
`components.json.iconLibrary` vẫn là mặc định registry shadcn (lucide), không điều khiển
icon runtime. Khi generate component shadcn mới, rà soát import và chuyển icon sang MUI
như các primitive đã tùy biến; không tự đặt giá trị iconLibrary không xác minh trong schema.

Kiểm tra: lint sạch, 177/177 tests, build TypeScript strict và diff --check pass. Browser
fixture cô lập: sidebar SVG 20x20px đúng currentColor, icon decorative aria-hidden; nút
đóng Sheet hoạt động; spinner MUI 16px vẫn quay; mobile 390px không tràn ngang.
Dùng dev server fixture tạm ở 5175 vì server 5173 đang có; không thay cấu hình port mặc định.
Chưa chạy lại API/login thật trong lượt đổi icon. Khởi động lại dev server đang chạy sau khi
cài dependency nếu chưa tải được module mới. Không commit/push.

File đổi riêng cho MUI: AppHeader, AppSidebar, primitives/native-select, sheet, spinner;
package.json, package-lock.json, tests/ui-foundation.test.mjs và README.


### Theme trắng — xanh dương

Nền ứng dụng xanh xám rất nhạt; Header/Sidebar/panel trắng; nút primary và trạng thái active
màu xanh dương. Các semantic token shadcn đã ánh xạ vào palette nên Button/Input/Select,
Table, Sheet, Alert và icon MUI dùng chung màu mới. Badge vẫn chỉ có màu chữ, không nền/viền.
Không thêm theme switcher hoặc dependency; không thay typography, layout, quyền hay API.
Theme Keycloak nằm ngoài frontend và không được sửa trong lượt này.

Đã kiểm lint, 177/177 tests, build strict và diff --check. Browser fixture cô lập desktop/
mobile 390px: panel/Sheet trắng, chữ tối, native controls light, active icon xanh, nút primary
#0066CC với chữ trắng, lỗi #C62828; không tràn toàn trang. Chưa chạy lại API/login thật trong
lượt đổi palette. Tương phản: white/primary 5.57:1, foreground/white 14.10:1,
muted/control 5.67:1, focus/white 6.38:1, success/white 5.41:1,
warning/white 5.93:1, danger/white 5.62:1. Các số đo theme tối ở phần lịch sử phía trên
là kết quả trước khi đổi palette. Lượt này chỉ sửa src/index.css và README.md.


### Header/Sidebar xanh nước biển và thu gọn

Cập nhật hiện tại: Header và Sidebar dùng `--color-chrome: #064B93`, chữ/icon trắng,
chữ phụ `#D6E7FF`; nền nội dung/panel vẫn sáng theo theme trắng–xanh. Active navigation
có nền trắng mờ và viền để dễ nhận biết. Workspace options dùng nền trắng/chữ tối.
Đăng xuất đã chuyển khỏi Header xuống cuối Sidebar (desktop và Sheet mobile), vẫn gọi
`signOut()` hiện có; lỗi đăng xuất hiển thị an toàn ngay tại Sidebar.

Nút menu desktop dùng `useState` trong AppLayout để đổi `data-collapsed`. CSS transition
280ms thu chiều rộng từ 240px về 0 và `translateX(-100%)` đẩy nội dung Sidebar sang trái;
Main mở rộng cùng lúc và không bị unmount. Khi đóng, `inert`/`aria-hidden` loại controls
khỏi thao tác bàn phím. Nút có `aria-controls`/`aria-expanded`, bấm lại để mở.
Mobile dùng Sheet hiện có với CSS keyframes vào 240ms/ra 200ms. `prefers-reduced-motion`
tắt transition/animation. Không thêm dependency hoặc lưu trạng thái menu vào storage.

File cập nhật riêng lượt này: `src/index.css`, `src/components/layout/AppHeader.tsx`,
`AppSidebar.tsx`, `AppLayout.tsx`, `tests/app-shell-ui.test.mjs` và README này.
Kiểm tra: lint sạch; 177/177 tests; build strict; git diff --check pass. Browser fixture
không gọi API ở desktop 1280px/mobile 390px: đúng màu, logout cuối Sidebar, thu gọn/mở lại,
Main mở rộng, Sidebar đóng không nhận focus; mobile không tràn ngang, Escape đóng và trả
focus về nút menu, logout giả chuyển sang chưa đăng nhập. Có reduced-motion CSS nhưng
chưa giả lập cài đặt hệ điều hành. Chưa chạy lại logout Keycloak thật trong lượt UI này.


### Palette hiện tại — xanh lá cây

Header/Sidebar (cả Sheet mobile) dùng `chrome #166534`, chữ trắng và chữ phụ `#DCFCE7`.
Primary `#15803D`, hover/focus `#166534`; nền `#F5FAF7`, control `#EEF6F0`, viền `#D5E5DA`.
Các token semantic shadcn tiếp tục dùng chung palette; active/hover Sidebar giữ lớp trắng mờ.
Giữ nguyên logout cuối Sidebar và animation thu gọn. Chỉ đổi token trong `src/index.css`.
Các phần palette xanh dương phía trên là lịch sử trước lần đổi này.

Đã kiểm lint, build strict và git diff --check; browser fixture desktop 1280px/mobile 390px
xác nhận nền Header/Sidebar/Sheet #166534, chữ trắng, mobile không tràn ngang.
Chưa chạy lại toàn bộ tests hoặc luồng API/Keycloak vì thay đổi chỉ gồm màu CSS.


### Nút mũi tên thu gọn Sidebar

Nút desktop đã chuyển khỏi Header ra giữa mép phải Sidebar, dùng ChevronLeft/ChevronRight
của MUI. Nút đứng ngoài vùng `inert`/overflow để vẫn dùng được khi Sidebar thu về 0;
Main và animation hiện có giữ nguyên. Mobile mở bằng ChevronRight trên Header, đóng bằng
ChevronLeft giữa mép phải Sheet; giữ hành vi focus/keyboard của Radix.

File đổi: AppHeader.tsx, AppLayout.tsx, src/index.css, tests/app-shell-ui.test.mjs, README.
Đã kiểm lint, 177/177 tests, build strict và diff --check. Browser fixture desktop 1280px:
nút đúng giữa chiều cao Sidebar, thu gọn về 0 vẫn còn nút mở lại tại x=0, bàn phím hoạt động.
Mobile 390px: nút đóng giữa Sheet, không tràn ngang. Chưa chạy lại API/Keycloak thật.


### Đồng bộ UI nghiệp vụ với shadcn

Các control phù hợp trên Dashboard, Events, Cases/detail, Knowledge, reconstruction,
review/manual link, evidence và workflow đã tái sử dụng bộ UI shadcn hiện có:

| Thành phần | Sử dụng |
| --- | --- |
| Button | Submit primary; refresh, phân trang, retry và thao tác phụ secondary; giữ type/disabled/handler |
| Input | Text, datetime-local và tìm kiếm; type=search có icon MUI, ref/onChange/onBlur truyền tới input thật |
| NativeSelect | Source, limit, state, mode, decision và picker; giữ options, register và fieldset disabled |
| Textarea | Note và reason; giữ ref, maxLength, xuống dòng, whitespace, aria-invalid/describedby |
| Table | Events, cases, graph nodes/links và sources; caption, heading/cell semantic, vùng cuộn có thể focus |
| Badge | Outcome sự kiện và vai trò; tiếp tục không có background/border |
| Alert / LoadingState / EmptyState | Validation/lỗi an toàn, thông báo chờ và kết quả rỗng |
| Card | Bốn counter Dashboard, vẫn render dt/dd và giá trị từ BE |
| Sheet | Menu mobile hiện có; các nút Header/thu gọn cũng dùng Button chung |

Chỉ thêm hai primitive đang dùng: [Textarea](https://ui.shadcn.com/r/styles/new-york-v4/textarea.json)
và [Card](https://ui.shadcn.com/r/styles/new-york-v4/card.json), điều chỉnh theo token xanh lá và
React/TypeScript hiện có. Không cài dependency, không đổi HTTP/DTO/controller/provider,
route, quyền, cursor, idempotency hoặc thời gian debounce/submit. Không thêm toàn bộ registry.
Các label, fieldset, legend, time, details/summary và link giữ semantic HTML. Checkbox chọn
nhiều và input hidden của RHF tiếp tục native để bảo toàn register/value và validation hiện có;
checkbox được phối accent xanh. Phân trang vẫn là Button gọi controller, không giả URL/page
number hoặc chuyển thành các link href không tồn tại. Lỗi inline dùng Alert với layout block
để nội dung dài và request ID không rơi vào cột grid 0px mặc định của primitive.

```tsx
<Input type="search" id="q" {...register('q')} />
<Textarea id="reason" maxLength={1000} {...register('reason')} />
<Button type="submit" disabled={busy}>Tìm kiếm</Button>
```

Import Input/Button từ components/ui; Textarea từ components/ui/primitives/textarea.
Label và aria-describedby do form quản lý. Chỉ dùng loading spinner cho trạng thái đang
chờ, không đổi thông báo kết quả chưa rõ hoặc khóa nghiệp vụ thành lỗi hệ thống.

File bổ sung: primitives/card.tsx, primitives/textarea.tsx, tests/fixtures/shadcn.html và
shadcn.tsx. File cập nhật: components/ui/Input.tsx; layout/AppHeader.tsx, AppLayout.tsx;
DashboardPage, CasesPage, CaseDetailPage, KnowledgePage; components DashboardView,
WaitingCaseList, EventFiltersForm, EventsExplorer, EventPresentation, KnowledgeView,
CaseFiltersForm, CasesFeedback, CreateCasePanel, EvidenceForm, WorkflowForm,
ReconstructionPanel, RunResult, GraphTable, LinkReviewPanel; tests/ui-foundation,
dashboard-ui, integration-ui và README. Giữ nguyên các thay đổi trước đó chưa commit.

Kiểm tra: lint, 178/178 tests, build TypeScript strict và git diff --check pass.
Browser fixture cô lập (không backend): Dashboard submit UTC+7 thành UTC, Knowledge tìm
bằng Enter và limit 25, Cases giữ owner subject không phải UUID cùng limit 100; Evidence
báo lỗi note rỗng và submit nguyên whitespace/xuống dòng. Desktop 1280px/mobile 390px:
không tràn toàn trang, bảng cuộn trong vùng riêng, lỗi inline có chiều rộng đọc được,
text API được escape. Fixture tại /tests/fixtures/shadcn.html chỉ phục vụ kiểm thử,
không được import vào source production. Chưa nghiệm thu lại toàn bộ luồng API/Keycloak
và mutation thật trong lượt thay UI. Không commit/push.


### Sửa nút mở Sidebar đè nội dung khi thu gọn

Sidebar thu gọn chừa rail 3rem (48px tại cỡ chữ mặc định), thay vì width=0.
Nút 40px nằm trong rail với right=0.25rem; Main bắt đầu sau rail nên nút không đè
form hoặc CTA dù nằm cùng độ cao. Giữ animation, inert/aria-hidden và mobile Sheet.
Mô tả width=0/x=0 trong các mục kiểm thử lịch sử phía trên không còn áp dụng.

File đổi riêng: src/index.css, tests/fixtures/app-shell.tsx (thêm form/counter Dashboard
thật với dữ liệu giả để kiểm layout), README. Lint/build strict/diff check pass;
tests AppShell/routes pass. Browser fixture ở 1280px: nút kết thúc x=44, nội dung từ x=80;
1024px: x=44 và x=72; Sidebar mở: nút kết thúc x=260, nội dung x=264. Mobile 390px
không có rail desktop và không tràn ngang. Chưa chạy lại toàn bộ tests hoặc API/Keycloak
trong lượt sửa CSS này. Không commit/push.


### Header: picker sáng và căn lề với H1

Header bỏ dòng trạng thái đăng nhập và nút Làm mới quyền/nguồn. Role badge và các thao tác
đăng nhập/đăng xuất hiện có vẫn hoạt động; không thay cơ chế refresh token/revalidation.
Workspace NativeSelect dùng nền trắng, chữ xanh đậm và icon xanh, options dễ đọc.
Header brand và Sidebar dùng chung biến --shell-sidebar-width (15rem mở, 3rem thu gọn).
Khoảng đệm trái picker khớp Main (desktop 24/32px); khi thu gọn brand hiển thị TW,
accessible name và link vẫn là TraceWeaver. Mobile giữ tên đầy đủ và picker trên hàng riêng.

File đổi: components/layout/AppHeader.tsx, AppLayout.tsx, src/index.css,
tests/app-shell-ui.test.mjs và README. Lint, 178/178 tests, build strict, diff check pass.
Browser fixture: select/H1 cùng x=272 khi mở ở 1280px; cùng x=80 khi thu gọn;
mobile 390px cùng x=16, không tràn ngang. Đổi sang workspace ingest_service chỉ đọc thông báo
thiếu quyền, không giữ nội dung cũ. Chưa kiểm lại API/Keycloak thật trong lượt Header này.
Không commit/push.


### Workspace Combobox trên Header

Workspace picker dùng Popover + Command (cmdk) theo source shadcn đã tùy biến, không
đổi picker của những form nghiệp vụ khác. Nút nền xanh đậm hơn Header, icon MUI,
nhãn Workspace · 10000000…0015; title và mô tả truy cập giữ UUID đầy đủ. Danh sách
nền trắng hiển thị đầy đủ UUID, dấu check cho workspace hiện tại và input tìm kiếm.
Tìm chuỗi con theo UUID, không phân biệt hoa/thường, bỏ khoảng trắng hai đầu; không
có kết quả thì báo Không tìm thấy workspace. Chọn lại workspace hiện tại chỉ đóng popup.

Memberships từ /me là nguồn duy nhất; tìm kiếm không gọi API, không persist vào storage.
Chọn workspace gọi selectWorkspace hiện có, không tự thay scope hoặc quyền. Popover đóng,
nháp tìm kiếm bị bỏ khi scope không còn ready/đổi subject; trigger bị disabled khi chưa
đăng nhập, đang kiểm quyền hoặc chưa có membership. Giữ căn trái H1 và responsive trước đó.
Keyboard: Enter mở, input được focus, ArrowUp/ArrowDown/Enter chọn, Escape đóng/trả focus;
click ngoài đóng. UUID đầy đủ xem trong danh sách hoặc title, không tự bịa tên workspace.

Dependency mới: @radix-ui/react-popover 1.3.1, cmdk 1.1.1. Package/lockfile cập nhật trong
frontend; thêm primitives/popover.tsx, command.tsx, features/workspace/components/WorkspacePicker.tsx,
tests/workspace-picker-ui.test.mjs; sửa AppHeader.tsx và README. Icon giữ MUI; không thêm
Lucide, animation package hoặc package shadcn tổng. Nguồn tham chiếu:
[Popover](https://ui.shadcn.com/r/styles/new-york-v4/popover.json),
[Command](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/command.tsx).
Chỉ lấy các primitive cần dùng; không thêm CommandDialog hoặc các component không sử dụng.

Kiểm tra: lint, 179/179 tests, build strict và diff check pass. Browser fixture không API:
search không khớp, lọc UUID, chọn bằng ArrowDown/Enter, chuyển workspace mất quyền, chọn lại,
Escape trả focus, mở lại xóa query cũ; revalidation đóng portal, khóa trigger, không còn UUID
scope cũ trong DOM. Mobile 390px: popup bằng chiều rộng trigger, nằm trong viewport, không
tràn ngang. Chưa kiểm thử lại API/Keycloak thật trong lượt UI này. Không commit/push.
