# Bàn giao sửa FE audit — 29/10/2026

Chỉ thay đổi trong `frontend/`. Không sửa BE, hạ tầng, root CI hay dữ liệu môi trường thật.
Giữ các quyết định UI trước đó: bỏ FilterSummary/caption, tiêu đề bảng căn giữa,
tên hồ sơ mở detail theo kiểu Events, hover bằng chứng đổi màu chữ và đậm hơn.

## Trạng thái từng mục

| Mục | Kết quả đợt này | Giới hạn / việc còn lại |
| --- | --- | --- |
| FE-01 | Nhận `workspace_name` tùy chọn tối đa 200 ký tự theo contract dev đã kiểm tra, giữ schema strict; picker hiển thị/tìm tên hoặc ID; kiểm tra bốn vai trò | Chờ nghiệm thu rollout API thật. |
| FE-02 | Tab kết quả tái dựng trong hồ sơ, deep link `?tab=reconstruction`; GET đúng `case.run_id`; graph/review dùng lại UI và services; khóa ghi theo quyền/trạng thái; cập nhật pending bằng graph refetch | Cần nghiệm thu BE thật theo vai trò/grant. Không tạo run để mở run đã lưu. |
| FE-03 | Chưa triển khai | Chờ contract và chức năng kiểm tra sau xử lý từ BE/nguồn mẫu. Không giả kết quả bằng note. |
| FE-04 | Chưa triển khai | Chờ BE cho phép liên kết lần kiểm tra/run mới, phân biệt bằng chứng trước–sau. Snapshot gốc giữ nguyên. |
| FE-05 | Giữ guard version/reviewer/note/evidence/pending links hiện có; pending dùng graph được refetch | Chưa có điều kiện xác minh sau xử lý hoặc snapshot kết luận do BE xác nhận; không coi guard cũ là hoàn thành FE-05. |
| FE-06 | Xem nội dung event từ snapshot trong bằng chứng, kể cả viewer/hồ sơ đóng; thiếu event báo rõ; nguồn tri thức HTTP(S) an toàn hoặc URI dạng text | Bằng chứng sau xử lý vẫn chờ FE-04. |
| FE-07 | Vai trò phiên từ `/me`; chọn người đủ quyền từ API assignees theo hồ sơ; tìm subject, hiển thị vai trò, giữ Giao cho tôi khi hợp lệ; kiểm lại người nhận trước POST | Contract dev đã xác minh; chờ rollout/API thật. BE chưa cung cấp display name/email nên label dùng subject. |
| FE-08 | Nhận abstentions theo contract backend-platform, hỗ trợ API cũ thiếu trường; giải thích lý do và tham chiếu; nhãn fallback riêng; Phân tích hoàn tất khác thành công nghiệp vụ | Kịch bản 011/012 và AI thật chưa chạy E2E; mã lạ dùng lời giải thích trung tính và mã gốc. |
| FE-09 | Khôi phục ý nghĩa bộ lọc/counter và trợ giúp search; sửa liên kết nguồn; test theo nghĩa/hành vi; test concurrency=1 | Không khôi phục các khung/caption người dùng đã yêu cầu bỏ. |
| FE-10 | Unit/contract/controller/SSR và kiểm tra trình duyệt với fixture; hướng dẫn lệnh kiểm tra bên dưới | Chưa nghiệm thu Keycloak/API/AI/DB thật; không sửa `.github` ngoài frontend. |
| FE-11 | Backlog | Chờ API quản trị membership/role/group/grant và audit. |
| FE-12 | Backlog | Chờ source CRUD, collector health, batch history và quyền nhập từ UI; không nhúng ingest secret. |
| FE-13 | Backlog | Chờ API job generator/uploader; không dựng tiến trình giả từ CLI. |
| FE-14 | Backlog | Chờ dịch vụ nguồn mẫu có trạng thái và thao tác thử lại/healthcheck thật. |
| FE-15 | Backlog | Chờ API ghi/version history tri thức, audit và quyền tương ứng. |
| FE-16 | Chỉ có hướng dẫn nghiệm thu kỹ thuật của đợt sửa này | Hướng dẫn bootstrap đầy đủ, health/capabilities và xuất kết quả xác minh chờ dữ liệu BE có nguồn gốc. |

## Thiết kế dữ liệu và thao tác

- Đã đối chiếu bản dev từ origin tại commit `ba0445a`, gồm OpenAPI, domain.schema.json,
  case router và `docs/archive/readable-data.md`. Không pull/merge vào working tree đang có thay đổi;
  bản đọc contract nằm trong `node_modules/.tmp/dev-contract-review.git` (ignored).
- `GET /cases/{cid}/assignees` không query/body/pagination; schema strict `{items:[{subject,roles}]}`.
  Mở picker sẽ tải lại; chỉ state new và canWrite được gọi. Không nhập subject tự do, không suy tên/role.
  Subject được gửi nguyên vẹn theo contract (không trim hoặc đổi định danh).
  Giao cho tôi chỉ bật khi subject phiên có trong danh sách hợp lệ. Trước POST đọc detail và danh sách mới;
  BE vẫn là nơi quyết định quyền cuối cùng. 409 cần chọn phiên bản mới; 422 tải lại detail và người nhận;
  401/403/404 purge toàn bộ dữ liệu hồ sơ; lỗi đọc 503 cho phép thử lại. Không tự gửi lại POST.
- Tên nguồn được tải hết các trang được cấp quyền; chặn cursor lặp và response muộn khi đổi scope.
  Không tìm thấy nguồn hiển thị “Nguồn không khả dụng”, không suy tên từ service.
- Bản dev này vẫn chỉ có Evidence kind `events`/`note`; không có DTO/API kiểm tra sau xử lý,
  liên kết run xác minh, quản trị membership/source/knowledge hoặc simulator. Đã kiểm cả router, schema
  và tài liệu handoff; các phần FE-03/04/05, FE-11–16 còn phụ thuộc tương ứng, không giả lập trên FE.

- `CasesProvider` cung cấp tải run đã lưu, review và liên kết thủ công. Controller hồ sơ dùng
  `snapshot.graph` làm bản graph hiện hành; `snapshot.events` tham chiếu `graph.nodes`, không tải event hiện tại thay snapshot.
- `loadEvidenceSnapshot` được phép đọc khi có scope hợp lệ, không yêu cầu canWrite và không loại hồ sơ đóng.
  Ghi evidence/review/transition vẫn có guard riêng. Tải run/graph không POST tạo run.
- Sau review/manual: refetch graph, dùng Link.version hiện hành; conflict cần chọn lại phiên bản.
  POST timeout/network/5xx không tự replay. `verify_close` vẫn GET graph mới trước POST.
- Đổi hồ sơ/run/scope/quyền hoặc 401/403/404: hủy request, xóa dữ liệu; sequence/generation chặn response cũ.
  Kiểm tra run thay đổi trong preflight không gửi review vào run cũ.
- Query `tab` chỉ điều khiển UI, không gửi đến API lọc hồ sơ. Tab mặc định là lịch sử;
  `evidence`/`reconstruction` giữ được sau reload; giá trị khác trở về lịch sử.
- `abstentions` dựa trên contract đọc từ ref cục bộ `origin/Phuoc/feat/backend-platform`:
  reason_code cùng event_id, hoặc transition_id/from_event_id/to_event_id. API cũ thiếu trường nhận `[]`.

## Lệnh kiểm tra

Chạy từ `frontend/`, không cài thêm package:

```powershell
npm run lint
node node_modules/typescript/bin/tsc -p tsconfig.app.json --incremental false
node node_modules/typescript/bin/tsc -p tsconfig.node.json --incremental false
npm test
npm test
```

Build cần public env hợp lệ cho API/Keycloak. Đợt này dùng các giá trị `.env.example`
trong môi trường tiến trình, không tạo `.env` và không gửi yêu cầu đến các dịch vụ đó:

```powershell
Get-Content -LiteralPath .env.example | ForEach-Object {
  if ($_ -match '^(VITE_[A-Z_]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}
npm run build
git diff --check
```

## Kiểm tra trình duyệt và phần chưa nghiệm thu

Fixture: `tests/fixtures/audit-case.html` + `audit-case.tsx`, dùng component/controller thật với
services mô phỏng trong bộ nhớ; không gọi Keycloak/BE/nguồn hoặc sửa workspace người dùng.
Phục vụ fixture bằng Vite với config test không dùng đăng nhập thật; URL giữ `?tab=reconstruction`.

Đã kiểm tra ở 1440×900 và 390×844:

- Deep link/reload giữ tab kết quả; chuyển tab bằng phím mũi tên.
- Review liên kết làm pending từ 1 thành 0 sau graph refetch.
- Mở bằng chứng thấy nội dung log và provenance trong snapshot.
- Đổi reviewer sang viewer ẩn thao tác ghi; đăng xuất fixture xóa nội dung hồ sơ.
- Sửa bố cục ba tab mobile để không chồng lên nội dung; không tràn ngang ở 390px.
- Picker người nhận ở desktop 1440×900/mobile 390×844: tải danh sách khi mở, tìm opaque subject,
  chọn bằng ArrowDown/Enter, Giao cho tôi và giao thành công cập nhật state/owner.
  Chuyển sang viewer ẩn form giao; logout xóa hồ sơ và danh sách.
  Ảnh kiểm tra cục bộ: `node_modules/.tmp/audit-assignees-desktop.png`.

Chưa kiểm tra tablet/1280px, zoom 200%, reduced motion, và E2E đầy đủ với hệ thống thật.
Việc reload fixture không chứng minh dữ liệu dịch vụ đã được lưu bền vững.
Để nghiệm thu thật, dùng workspace kiểm thử riêng và tài khoản viewer/operator/reviewer/admin:
mở hồ sơ cũ, reload/đổi tài khoản, kiểm tra đọc/ghi đúng quyền, thu hồi grant khi request chậm,
version conflict, POST không rõ kết quả và xác nhận không có POST tạo run khi mở kết quả.
Vòng khắc phục thiếu RAM → thử lại → xác minh → đóng chỉ nghiệm thu sau khi BE/nguồn cung cấp contract.

## Kết quả chạy cuối

- Lint: đạt, không có cảnh báo.
- TypeScript app/config: đạt, không hạ strict.
- Production build: đạt với public env lấy từ .env.example trong tiến trình.
- Bộ tests cuối sau tích hợp dev: hai lượt liên tiếp đều đạt 209/209, không timeout/cancelled (33,1 giây và 36,7 giây). Logs cục bộ: node_modules/.tmp/audit-dev-final-1.log và audit-dev-final-2.log.
- Diff check: đạt; Git chỉ cảnh báo chuyển LF/CRLF theo cấu hình môi trường, không sửa cấu hình Git.
- Chưa chạy E2E với dịch vụ thật, chưa nghiệm thu các mục chờ BE.

Báo cáo không tuyên bố toàn bộ FE-01–16 hoàn tất.

## File thêm/sửa

- AUDIT_IMPLEMENTATION.md
- package.json
- src/components/layout/AppHeader.tsx
- src/features/cases/components/CaseDetailView.tsx
- src/features/cases/components/CaseFiltersForm.tsx
- src/features/cases/components/CaseRunPanel.tsx
- src/features/cases/components/EvidenceEvents.tsx
- src/features/cases/state/CasesProvider.tsx
- src/features/cases/state/casesContext.ts
- src/features/cases/state/controller.ts
- src/features/cases/state/state.ts
- src/features/dashboard/components/DashboardView.tsx
- src/features/knowledge/components/KnowledgeView.tsx
- src/features/reconstruction/components/GraphTable.tsx
- src/features/reconstruction/components/RunResult.tsx
- src/features/reconstruction/presentation.ts
- src/features/reconstruction/schemas.ts
- src/features/workspace/components/WorkspacePicker.tsx
- src/features/workspace/presentation.ts
- src/features/workspace/schemas.ts
- src/pages/CaseDetailPage.tsx
- tests/audit-contracts.test.mjs
- tests/audit-ui.test.mjs
- tests/case-evidence-controller.test.mjs
- tests/case-saved-run.test.mjs
- tests/case-assignees.test.mjs
- tests/case-workflow-ui.test.mjs
- tests/events-presentation.test.mjs
- tests/events-ui.test.mjs
- tests/workspace.test.mjs
- src/features/cases/components/CaseAssigneePicker.tsx
- src/features/cases/components/WorkflowForm.tsx
- src/features/cases/schemas.ts
- src/features/cases/services/createCasesService.ts
- src/features/cases/workflow.ts
- src/features/events/presentation.ts
- src/features/workspace/state/controller.ts
- tests/cases-ui.test.mjs
- tests/dashboard-ui.test.mjs
- tests/fixtures/audit-case.html
- tests/fixtures/audit-case.tsx
- tests/workspace-picker-ui.test.mjs

