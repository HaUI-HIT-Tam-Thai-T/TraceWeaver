# Đối chiếu phiếu hội đồng HaUI 2026

Phạm vi người phụ trách backend: backend và bằng chứng; FE/AI do thành viên khác hoàn thiện. Đối chiếu ngày 25/10/2026 với `Phieu_du_kien_danh_gia_Hoi_dong_PMNM_HaUI_2026.pdf` (3 trang, SHA256 `40c772dd32c2e2ab303c909b65aa09c15598fceff3dda5974223c1c573e368b4`). Không điền điểm, chữ ký hay kết luận tuyển chọn thay hội đồng. **Chưa đủ bằng chứng để xác nhận toàn sản phẩm đáp ứng mọi tiêu chí.**

Nguồn triển khai: [capability hiện tại](CURRENT_STATUS.md), [hợp đồng](../backend/contracts/README.md), [cài đặt](../INSTALL.md), [license](../LICENSE), [notices](../backend/THIRD_PARTY_NOTICES.txt). Mọi kết quả phải gắn commit và thời điểm chạy; trạng thái này không tự áp dụng cho commit mới.

## Điều kiện B — trước khi chấm điểm

| Mục | Bằng chứng/hiện trạng | Việc còn cần hoàn tất |
|---|---|---|
| B1 repo công khai, duyệt trên Internet | GitHub API xác nhận [TraceWeaver](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver) PUBLIC, Issues bật ngày 25/10/2026 | Kiểm lại truy cập ẩn danh và đúng URL trước nộp; source mới hiện chưa push |
| B2 giấy phép nguồn mở phù hợp | Apache-2.0 ở LICENSE, SPDX trong source; [hướng dẫn license](HUONG-DAN-LICENSE-CHO-TEAM.md) | Kiểm tương thích cả FE/AI/model/dữ liệu khi source được đưa vào; không suy từ riêng npm BE |
| B3 phiên bản/tag/release trước hạn | Có prerelease `v0.1.0-base.1`, công bố 19/10/2026 22:57:30 +07; đây là scaffold | Chốt deadline, tích hợp source hoàn chỉnh, tag/release tương ứng và checksum. Archive local không thay release công khai |
| B4 dựng từ source, không phụ thuộc công cụ đóng | Node.js/npm, PostgreSQL, Keycloak; JS không cần compiler riêng; INSTALL và lockfile | Lưu bằng chứng chạy từ source giải nén ngoài checkout; kiểm máy mới và toàn bộ FE/AI khi nhận source. Docker không thay kiểm source |
| B5 phụ thuộc/nguồn gốc/giấy phép | [inventory backend](../backend/DEPENDENCIES.md), lockfile và notices được kiểm bằng `licenses:check` | Bổ sung FE/AI/container/model/dataset và mọi mã sao chép; ghi cả thay đổi mã bên thứ ba nếu có |
| B6 docs, changelog, issue tracker đúng thực tế | README/INSTALL/CHANGELOG, OpenAPI, Issues public và bug templates; [sổ lỗi](CURRENT_STATUS.md) ghi S01–V01 | Dùng release README đúng capability; cập nhật kết quả CI mới và các lỗi tích hợp phát sinh, không tạo issue/ảnh minh chứng giả |
| B7 không lộ bí mật/dữ liệu cá nhân trong source/lịch sử | Env/credentials/private evaluation bị ignore; package script chặn đường dẫn nhạy cảm; API redacts và kiểm schema | Kiểm lại toàn history trước phát hành, kể cả source FE/AI mới. Scan chữ ký không chứng minh tuyệt đối không có PII; thu hồi secret nếu từng lộ |
| B8 lịch sử phát triển thật trong kỳ thi | Repo tạo 19/10/2026 22:39:20 +07; local history có commit từ 19/10; xuất author/committer time bằng collector | Đội cung cấp thông báo bắt đầu/hạn chính thức để đối chiếu. Giữ lịch sử thật; không backdate, dựng commit giả hoặc suy ra đạt chỉ từ số commit |

## Tiêu chí C — 100 điểm của hội đồng

Sáu mục PoF là 50 điểm; năm mục sản phẩm là 50 điểm. Điểm tối đa dưới đây lấy từ phiếu, không phải điểm tự chấm.

| Mục / tối đa | Bằng chứng backend đang có | Cổng còn mở |
|---|---|---|
| C1 repo/lịch sử — 5 | Repo PUBLIC; export Git history; Issue/PR templates | Source mới cần push, đối chiếu kỳ thi và trình bày đóng góp thật |
| C2 giấy phép/tương thích — 10 | Apache-2.0 + SPDX + notices/inventory; kiểm tự động | Tương thích FE/AI/model/data và image đầy đủ |
| C3 quản lý phiên bản — 5 | Changelog, lockfile; prerelease scaffold; source archive + SHA256 | Release sản phẩm đầy đủ trước hạn, đúng commit và tài liệu |
| C4 build từ source — 10 | Lệnh npm/SQL, source smoke live/ready; kịch bản archive bên dưới | Ghi nhận kết quả ngoài checkout; máy mới/các thành phần khác và gói cài hoàn chỉnh |
| C5 phụ thuộc/bundling/nguồn gốc — 10 | Dependency inventory + notices tái tạo từ lockfile | Hoàn thiện provenance FE/AI/model/data/image, third-party modifications |
| C6 tài liệu/theo dõi lỗi — 10 | INSTALL, Swagger/contracts, changelog, bảng 13 lỗi audit và bản sửa | Docs/demo cuối phản ánh source tích hợp, Issue thật có triage/closure |
| C7 ba lớp/core headless, Identity–API–Data–Workflow, H-P-D-I — 10 | REST app tách headless engine/repositories; JWT + DB ACL; case_handling/document_review; core app-service và original-user JWT kiểm độc lập; immutable history/audit | FE gọi core/services thật; minh họa H-P-D-I bằng chính luồng sản phẩm, không chỉ sơ đồ/test BE |
| C8 hoàn chỉnh/ổn định/chạy demo — 10 | Ingest → normalize/redact → rule run → graph/review → case workflow/dashboard; DB/HTTP tests thực | FE/AI/simulator/dữ liệu mẫu tích hợp; scorer còn planned, hybrid degraded; E2E, performance/restore/fresh install chưa chứng minh |
| C9 UI/nghiệp vụ thực tế/permissions — 10 | Guard/version/evidence, owner/reviewer và source grants | FE screens/usability, nghiệp vụ cấp môi trường đại học, demo nhiều vai trò cùng dữ liệu thật |
| C10 kiến trúc/API/data/security/tests/deploy/mở rộng — 10 | Versioned contracts, migrations, transaction/idempotency, isolated tests, CI source, Docker guide, extension contracts | CI của commit mới, image rebuild/scan, least privilege/TLS production, backup/restore, tải đại diện, mở rộng/community |
| C11 thuyết trình/giải thích/Q&A/đóng góp/community — 10 | [kịch bản chung](04-DEMO-VA-HO-SO-NOP.md), checklist BE bên dưới | Slide/video và người trình bày giải thích license/dataflow/giới hạn; nguồn minh chứng đóng góp và hoạt động cộng đồng thật |

## Bộ bằng chứng backend có thể chạy lại

Yêu cầu Node 24.14.1/npm 11.11.0, `npm ci`, PostgreSQL đã migrate, `.env` local có cấu hình hợp lệ và quyền CREATEDB cho **tài khoản test development**. Không dùng quyền đó cho production. Chạy khi tracked/untracked source đã commit; `.local`/`.planning` vẫn ignore.

```powershell
npm.cmd run evidence:backend
npm.cmd run package:source
```

Collector chạy base/license, unit/HTTP/contract, PostgreSQL, identity-native HTTP, source process readiness và npm audit tuần tự. PostgreSQL/identity chạy từng file để giới hạn pool/tài nguyên local; assertions concurrency trong file giữ nguyên. Fail/skip/todo/cancel/timeout đều không được coi pass. Nó chỉ lưu summary, hash source, môi trường và Git history vào `.local/council-evidence`; không lưu stdout con, token hoặc env. Native JWKS fixture không phải Keycloak thật. DB test tạo và giữ DB riêng. `npm audit` cần registry; kết quả phụ thuộc thời điểm. Trước khi chia sẻ vẫn đọc lại bằng chứng và loại thông tin cá nhân không cần thiết trong Git metadata.

Package script chỉ archive đúng HEAD sạch, chặn env/credentials/private paths và kèm manifest + SHA256SUMS. **Không copy `.env`, credentials hay DB dump vào gói source.** Archive không tạo tag/release hoặc push. Kiểm checksum và danh sách archive trước nộp.

Để kiểm C4, giải nén archive sang thư mục ngoài checkout, chạy `npm ci --omit=dev --ignore-scripts` tại bản giải nén rồi chạy smoke của chính bản đó với cấu hình DB cung cấp từ ngoài gói. Giữ nguyên env/volume gốc; dùng port chưa chiếm. Ghi commit/archive hash, đường dẫn, Node/npm, dependency mode, lệnh, kết quả live/ready và giới hạn có sẵn DB/cache/network. Đây là bằng chứng source runtime backend; không gọi đó là máy sạch/offline/toàn sản phẩm. [INSTALL](../INSTALL.md) mô tả fresh setup và migrations.

## Demo backend và giới hạn cần nói rõ

1. Swagger/Keycloak PKCE thật → `/me`; viewer không được ghi, ingest token không được dùng như user; revoke grant có hiệu lực ở lần đọc sau.
2. Nạp normalized events từ intake/account/provision, giữ provenance/hash, redaction, duplicate/conflict. Hiện chưa có raw parser/simulator đầy đủ.
3. Tạo run rule_only → graph → review/manual link, stale expected_version bị 409, không chấp nhận cycle. Hybrid hiện fallback có degraded flag, không gắn nhãn đã chạy ML.
4. Case với owner/evidence/verification/close/reopen, history/audit chung; document_review chứng minh cùng headless engine. DB/HTTP tests kiểm đủ lifecycle; live demo hiện operator/viewer chưa có reviewer được provision, nên live close/reopen cần tài khoản reviewer đúng quyền.
5. Dashboard/drill-down đúng ACL. Dùng [live verifier](../backend/KEYCLOAK.md) để kiểm token do Keycloak cấp; nó giữ lại document/case/evidence/audit tạo lúc chạy. Không chiếu credentials/token trước hội đồng.

API Docker đang chạy có thể còn image cũ; phải rebuild theo [Docker guide](../backend/DOCKER.md) rồi chạy lại verifier/demo. Chưa có kết quả fresh Docker/image scan/backup-restore/full E2E trong bộ này.

## Chốt bản nộp

Người phụ trách FE/AI đưa source vào cùng repo, khai báo license/provenance và hoàn thành các cổng C7–C10. Đội điền tên/mã đội, tên sản phẩm, link release/demo, thời gian thi/hạn nộp và người trình bày từ thông tin thật. Sau tích hợp, chạy lại checks toàn bộ, xác minh CI đúng commit, source build và demo nhiều vai trò, rà secrets/history; tạo release trước hạn và giữ checksum. Chỉ đánh dấu mục đạt khi có bằng chứng tương ứng. Quyết định cho điểm/tuyển tối đa hai đội thuộc hội đồng.

## Kết quả backend đã thực hiện — 25/10/2026

| Kiểm chứng | Kết quả và phạm vi |
|---|---|
| Collector tại `2db195d35812b0cb7cf6c453d4e38f26d8924e12` | 7/7 nhóm pass; 73 unit/HTTP/contract + 49 PostgreSQL + 45 identity-native, không skip/todo/cancel; base/license98, source live/ready200, npm audit0. JSON local: `.local/council-evidence/2026-10-25T14-50-57-632Z/backend-evidence.json` |
| Lượt đầu tại `c6c15cb42bc87b7da6c8cd6c76fd9cc63fa3dddb` | Collector fail: DB12/19 pass,7fail; chưa lưu được nguyên nhân chi tiết. Chạy riêng nguyên bộ DB ngay sau đó49/49 pass. Giữ report fail tại `.local/council-evidence/2026-10-25T14-47-47-221Z`; collector mới ghi mã lỗi và chạy từng file DB. Chưa kết luận nguyên nhân hoặc coi đây là kiểm tải |
| Source archive chạy ngoài checkout | Commit `c6c15cb42bc8`; SHA256 `83ee4b794429b3b5aa27e7db9733d9e763bf1e296e172732a598cc3367584b2c`; `npm ci --omit=dev --ignore-scripts` exit0,89 packages; smoke của source giải nén live/ready200 port18081, child đã dừng. Source runtime/contracts/backend manifest/lock không đổi giữa c6c15cb và2db195d |
| Giới hạn kiểm source | Windows/Node/npm/DB đã có; dùng cache cho dependency, không cô lập network; `.env` được tham chiếu từ ngoài gói, không copy. Không phải kiểm máy sạch, offline hay full FE/AI; không thay release trước hạn |
| Rà nguồn/lịch sử | 75 commit qua mọi refs local: không khớp chữ ký private key/GitHub token/AWS key hay đường dẫn env/key/credentials thật. Không phải chứng nhận mọi secret/PII đều vắng mặt |
| Docs | 36 Markdown tracked,135 relative links,0 hỏng tại2db195d |
| CI công khai | [Run39827203718](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/actions/runs/39827203718) success cho commit `7908d46c24926324beff93a3d9310e3b5441fd8d` ngày22/10; cùng commit có một run failure. Các commit local mới chưa được remote CI xác nhận |

Bằng chứng thô local được ignore có chủ đích; khi bàn giao bộ nộp, chạy lại collector rồi chọn các summary đã rà và Git metadata cần thiết. Không đóng gói `.local` nguyên thư mục vì có cache/cấu hình riêng. Các commit cuối chỉ cập nhật tài liệu không tự biến kết quả trên thành kiểm chứng cho FE/AI hoặc image mới.

## Kết quả backend đã thực hiện — 25/10/2026

| Kiểm chứng | Kết quả và phạm vi |
|---|---|
| Collector tại `2db195d35812b0cb7cf6c453d4e38f26d8924e12` | 7/7 nhóm pass; 73 unit/HTTP/contract + 49 PostgreSQL + 45 identity-native, không skip/todo/cancel; base/license98, source live/ready200, npm audit0. JSON local: `.local/council-evidence/2026-10-25T14-50-57-632Z/backend-evidence.json` |
| Lượt đầu tại `c6c15cb42bc87b7da6c8cd6c76fd9cc63fa3dddb` | Collector fail: DB12/19 pass,7fail; chưa lưu được nguyên nhân chi tiết. Chạy riêng nguyên bộ DB ngay sau đó49/49 pass. Giữ report fail tại `.local/council-evidence/2026-10-25T14-47-47-221Z`; collector mới ghi mã lỗi và chạy từng file DB. Chưa kết luận nguyên nhân hoặc coi đây là kiểm tải |
| Source archive chạy ngoài checkout | Commit `c6c15cb42bc8`; SHA256 `83ee4b794429b3b5aa27e7db9733d9e763bf1e296e172732a598cc3367584b2c`; `npm ci --omit=dev --ignore-scripts` exit0,89 packages; smoke của source giải nén live/ready200 port18081, child đã dừng. Source runtime/contracts/backend manifest/lock không đổi giữa c6c15cb và2db195d |
| Giới hạn kiểm source | Windows/Node/npm/DB đã có; dùng cache cho dependency, không cô lập network; `.env` được tham chiếu từ ngoài gói, không copy. Không phải kiểm máy sạch, offline hay full FE/AI; không thay release trước hạn |
| Rà nguồn/lịch sử | 75 commit qua mọi refs local: không khớp chữ ký private key/GitHub token/AWS key hay đường dẫn env/key/credentials thật. Không phải chứng nhận mọi secret/PII đều vắng mặt |
| Docs | 36 Markdown tracked,135 relative links,0 hỏng tại2db195d |
| CI công khai | [Run39827203718](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/actions/runs/39827203718) success cho commit `7908d46c24926324beff93a3d9310e3b5441fd8d` ngày22/10; cùng commit có một run failure. Các commit local mới chưa được remote CI xác nhận |

Bằng chứng thô local được ignore có chủ đích; khi bàn giao bộ nộp, chạy lại collector rồi chọn các summary đã rà và Git metadata cần thiết. Không đóng gói `.local` nguyên thư mục vì có cache/cấu hình riêng. Các commit cuối chỉ cập nhật tài liệu không tự biến kết quả trên thành kiểm chứng cho FE/AI hoặc image mới.
