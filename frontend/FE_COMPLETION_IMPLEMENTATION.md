# Bàn giao hoàn thiện FE — 30/10/2026

Đầu vào: `FE_COMPLETION_HANDOFF.md`, `FE_WORKSPACE_ADMIN_HANDOFF.md` và bản `FE_SANDBOX_HANDOFF.md` bổ sung ngày 30/10/2026. Chỉ sửa frontend, không thêm dependency hoặc đổi backend/hạ tầng. Base FE được đối chiếu: `d90addc`. Chưa tạo commit mới trong lượt này.

## Trạng thái

| Hạng mục | Kết quả |
| --- | --- |
| Phân biệt lỗi account policy/ownership với pending/chưa rõ kết quả | Đã sửa và kiểm tra bằng test |
| Giữ lý do từ chối sau GET pending/lỗi; không cho retry POST nội dung bị từ chối | Đã sửa tại controller và UI |
| Quản lý thành viên độc lập với intent account | Đã sửa; vẫn tuần tự hóa request và kiểm CAS |
| Sau completed chuyển sang thành viên/cấp nguồn | Đã thêm nút chuyển tab, làm mới trang đầu, subject đầy đủ có copy và hướng dẫn tải thêm nếu chưa thấy |
| Giữ form/password khi GET danh sách lỗi | Đã giữ form mounted qua version=null, vẫn khóa gửi khi danh sách chưa sẵn sàng |
| Hủy/thay thế intent bị policy/ownership từ chối | Chờ BE; không thêm API/status hoặc xóa key giả |
| Panel sandbox, commands, proof và hướng dẫn đóng theo proof | Đã tích hợp theo handoff mới, có test schema/service/controller/UI; chưa UAT server thật |
| UAT trình duyệt desktop/mobile, zoom, bàn phím/focus | Chưa nghiệm thu: công cụ mở localhost timeout dù HTTP trả 200 |
| UAT ghi dữ liệu API/SSO thật | Chưa chạy; giữ nguyên tài khoản và hồ sơ mẫu |

## Hành vi tài khoản

- `rejection` là trạng thái FE trong bộ nhớ để giữ lỗi policy/ownership; không phải field/status bổ sung của API. Không chứa mật khẩu.
- Intent bị từ chối giữ key và nội dung form bị khóa. UI bỏ nút retry; controller cũng chặn POST kể cả gọi trực tiếp. GET operation còn dùng được. Pending không xóa lý do bị từ chối; lỗi GET giữ nguyên lý do. Chỉ completed khớp username/roles mới xóa rejection và báo thành công.
- UI nêu giới hạn phục hồi của BE, không yêu cầu lặp mãi input lỗi và không coi reload là hủy intent.
- Pending/network/timeout/5xx giữ cơ chế đối chiếu GET và retry chủ động cùng key/body; chỉ expected_version được cập nhật theo dữ liệu đã đọc. Provider disabled trước reserve không tạo pending giả.
- Bỏ khóa toàn bộ mutation thành viên khi account còn key. Mutation/check/account vẫn dùng cùng khóa request hiện có, không chạy ghi chồng nhau. Mỗi mutation dùng version BE; thay đổi version cần xác nhận rõ trong form account trước retry.
- Thay đổi quyền của chính actor vẫn purge và xác minh lại `/me`/nguồn. Đổi scope/logout tiếp tục hủy request, xóa intent và chặn response muộn.
- Password tiếp tục chỉ ở RHF form, xóa khi completed/rời trang/scope bị gỡ; không đưa vào storage, URL, snapshot controller hoặc log.

## Contract và triển khai sandbox

OpenAPI công khai đã xác nhận GET `/sandbox`, POST `/sandbox/commands` và GET/POST `/verifications` dưới case. Bản `FE_SANDBOX_HANDOFF.md` mới bổ sung DTO proof/history và quy tắc observation tối thiểu, đã gỡ phụ thuộc contract cho P1. FE dùng các field được mô tả trong handoff; không yêu cầu BE thêm endpoint.

- Panel toàn chiều rộng nằm sau tổng quan, trước lịch sử/bằng chứng/tái dựng; thu gọn giữ form mounted. Admin đơn thuần thấy form sửa dù canWrite=false; viewer chỉ đọc. Closed khóa ghi, reviewer reopen qua workflow hiện có.
- Schema/service tích hợp sandbox, commands, verifications và đọc tổng RAM từ GET `/lab`. Không dùng available_ram lịch sử làm dung lượng hiện tại. /lab chỉ project version/ram; environment và snapshot legacy giữ dạng dữ liệu kỹ thuật chưa dùng để kết luận đạt. Response hiện đại, request body và binding được validate; proof inconclusive chỉ có result/reason vẫn hợp lệ.
- Commands dùng case_version từ envelope và source_version; không tự cộng version. Form giữ nháp/phiên bản cũ và yêu cầu chủ động nhận phiên bản/tài nguyên mới. Capacity đặt tổng RAM; yêu cầu tổng RAM đọc cùng version nguồn trước khi gửi capacity.
- Provision mới dùng UUID. Timeout giữ nguyên body/ID, GET đối chiếu, chỉ retry chủ động đúng body cũ. Khi chưa tìm thấy attempt của provision chưa rõ kết quả, chặn bỏ intent để tránh tạo execution mới thay thế. Không tự POST lại sửa nguồn hoặc proof.
- Execution/replay hiển thị riêng observation; attempts cũ không bị cập nhật theo conditions mới. Log pending có nút GET kiểm tra, không polling hoặc tự lưu proof.
- Proof HTTP 201 chỉ báo đã lưu với result thực tế. Timeout GET history nhưng không tự nhận một bản mới nhất là kết quả của request vừa timeout. Chỉ người dùng chủ động kết thúc đối chiếu mới bắt đầu ý định khác. Version case/source/checker khác hoặc delivery chưa đủ được nêu rõ; FE không tự xác nhận đủ điều kiện đóng.
- Workflow giữ pending-link và BE proof guard. Sau workflow thay đổi, đọc lại sandbox/history; reopen làm proof khác case version bị đánh dấu cũ. Không tạo run mới hoặc chèn log vào graph cũ.
- Các lệnh ghi dùng cùng khóa với evidence/workflow/link review. GET sandbox không chặn đọc graph. Hủy và purge theo scope/role/401/403/404; response muộn không phục hồi dữ liệu cũ. Lỗi module khác không phá phần điều tra hoặc tự miễn proof.
- Chỉ dịch message LAB_COMMAND_REJECTED thuộc whitelist reason an toàn; không render raw message/HTML. Không thêm storage, dependency hoặc credentials.

Mặc định không tự thực hiện UAT ghi trên server. Hồ sơ 103 mới đã closed chỉ dùng xem lịch sử; không gọi lại các ID LAB-LIVE/BE51 cũ hoặc reset/configure dữ liệu. Chưa có xác nhận vận hành của các endpoint mới bằng tài khoản thật trong lượt triển khai này.

## File thay đổi

- `src/features/workspace-admin/controller.ts`
- `src/features/workspace-admin/components/AdminForms.tsx`
- `src/features/workspace-admin/components/WorkspaceAdminView.tsx`
- `tests/workspace-admin.test.mjs`
- `tests/workspace-admin-ui.test.mjs`
- `src/features/case-sandbox/{schemas,service,state,presentation}.ts`
- `src/features/case-sandbox/SandboxPanel.tsx`
- `src/features/cases/state/{state,controller,casesContext}.ts`, `CasesProvider.tsx`
- `src/pages/CaseDetailPage.tsx`
- `tests/{case-sandbox,case-sandbox-ui}.test.mjs`, `tests/sandbox-fixtures.mjs`
- `tests/fixtures/case-sandbox.html`, `tests/fixtures/case-sandbox.tsx`
- `FE_COMPLETION_IMPLEMENTATION.md`

## Kiểm tra thực tế

- Toàn bộ tests tuần tự: **249/249 đạt**.
- Lint: đạt.
- TypeScript strict app và config: đạt.
- Production build với public env hợp lệ: đạt. Build không chứng minh API/SSO kết nối hoặc UAT đạt.
- `git diff --check`: đạt.
- Test bổ sung: hai lỗi rejection qua GET pending/lỗi/completed; chặn POST replay; intent không bị reset; mutation nguồn độc lập; CAS stale bị chặn; retry pending giữ key/body sau mutation đổi version; loại trừ request chồng nhau; purge rejection khi logout; UI không có nút retry cho rejection; nút thêm thành viên không bị intent khóa; form vẫn có mặt khi version=null và đường đi cấp nguồn sau completed.
- Test sandbox bổ sung: strict DTO/binding/operation và duplicate proofs; legacy/malformed checker-v2; quyền bốn role/closed; source/case conflict; sai resource; timeout replay giữ toàn body; capacity/proof không tự POST lại; proof 201 failed/inconclusive; không thay graph; pending-link/BE proof guard; reopen cập nhật source/proof stale; khóa ghi chung; graph đọc song song GET sandbox; denial purge ngay khi nguồn khác đang chậm; response muộn sau logout/đổi case/workspace/actor/admin; UI admin nằm ngoài canWrite, escape HTML và phân biệt hiện tại/lịch sử.
- Browser: HTTP fixture localhost trả 200, nhưng `createBrowserTab` timeout. Chưa kiểm chứng tương tác giữ password/nháp, đóng mở panel, Tab/Escape, focus, 1366/1440/390px hoặc zoom 200%. SSR test không thay thế E2E.

Không đăng nhập bằng credential thật, không tạo/sửa tài khoản hoặc hồ sơ mẫu trên server trong lượt này. Không đánh dấu toàn bộ handoff hoàn tất.

## Kiểm tra thủ công tiếp theo

Chạy Vite, mở `/tests/fixtures/case-sandbox.html` để dùng production panel với dữ liệu tổng hợp trong bộ nhớ. Chọn role `all` chỉ trong fixture để thử sửa RAM/image/account, chạy lại, xác nhận pending/delivered bằng nút fixture, lưu proof failed/inconclusive/passed và đóng/mở fixture. Role admin/operator/reviewer/viewer có thể kiểm riêng; role logout gỡ scope. Fixture không gọi API/SSO thật và không thay bằng chứng UAT hệ thống thật.

Trên hệ thống thật: đọc case/sandbox mới, thử RAM → image → account → passed → delivered → awaiting verification → proof → đóng; kiểm reopen/proof cũ. Giữ bộ dữ liệu bàn giao, không tự reset. Cần kiểm trình duyệt 1366/1440/390px, zoom 200%, Tab/Escape, focus và nháp qua refresh/thu gọn khi môi trường trình duyệt hoạt động.
