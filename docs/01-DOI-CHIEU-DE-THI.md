# 01 — Đối chiếu yêu cầu đề thi và hiện trạng

Đối chiếu ngày 19/10/2026 từ bản PDF đội đã cung cấp. Đây là checklist kỹ thuật phục vụ team, không thay đề/BTC. Chỉ đánh dấu hoàn thành khi có code chạy và minh chứng đúng yêu cầu; không dùng việc có schema/docs làm bằng chứng tính năng đã xong.

## Nguồn và phạm vi

| Nguồn | Phần sử dụng |
|---|---|
| De_thi_PMNM_HaUI_2026_BAN_CHINH_THUC.pdf, 7 trang | Trang 1–2: bối cảnh/14 ngày/10+5; trang 3–4 mục 3–5: ba tầng, core/H-P-D-I/nguồn mở; trang 5 mục 7–10: kỹ thuật/dữ liệu/demo/hồ sơ; trang 6–7: rubric, lỗi và định hướng |
| Thể-lệ-cuộc-thi-phần-mềm-nguồn-mở-OLP-2026.pdf, 3 trang | Trang 1: tham dự/nguồn mở; trang 2–3: PoF, license từng tệp, release/source build và tiêu chí sản phẩm Quốc gia |

SHA256 bản đề HaUI đã đọc: `ebb7578a2b0cd3dc4a1dab0e146bd04cf1c0a461074b0e2b9f668af10928f016`. Bản PDF gốc được giữ ở tài liệu local của người chuẩn bị, không gán lại Apache-2.0 hoặc tự đưa vào source. Người giữ bản gốc cần cung cấp đúng hai PDF này cho các thành viên trước khi chốt hồ sơ. Nguồn đề VFOSSA nền được dẫn trong PDF HaUI: [đề DX-OS Open-Core](https://vfossa.vn/tin-tuc/de-thi-phan-mem-nguon-mo-olp-2026-798.html); nguồn này không thay PDF tuyển chọn nội bộ HaUI.

SHA256 bản thể lệ Quốc gia đã đọc: `7a9625672075eab29e77033a1b4c11cb4f36cc21f789eff89978121697f2c548`. Đây là định danh bản tài liệu đã dùng, không phải xác nhận các thông báo sau này không thay đổi.

## A. Kiến trúc và sản phẩm bắt buộc — HaUI mục 3–4, 7, 9

| ID | Yêu cầu / nguồn | Phần cần làm và minh chứng | Hiện trạng |
|---|---|---|---|
| A01 | Kiến trúc ba tầng, Open-Core trước ứng dụng; tr.1–3 | Sơ đồ core → H-P-D-I → ứng dụng, luồng gọi dịch vụ thật | Có sơ đồ/ranh giới; cần chứng minh toàn luồng |
| A02 | Identity/Auth/Authz, có thể dùng Keycloak/tương đương; 4.1 | Login/roles/groups, token thật và test sai quyền | Local Keycloak PKCE/refresh + DB permissions đã kiểm; FE login UI/production chưa có |
| A03 | API Gateway hoặc lớp API trung gian; 4.1 | Endpoint có kiểm soát, app gọi core qua API | 20/21 operations implemented; core HTTP dùng app/user JWT riêng |
| A04 | Dữ liệu cấu trúc và/hoặc phi cấu trúc; 4.1 | Schema, storage, metadata và migration tái lập | PostgreSQL7 migrations và dữ liệu ingest/provenance có; dataset đại diện chưa có |
| A05 | Workflow engine trạng thái/luồng/lịch sử; 4.1 | Engine/definition, guard/owner/history/audit gọi headless | Engine/version/guards/audit có, hai definitions chạy headless và HTTP |
| A06 | Core tách UI, dịch vụ dùng chung; 4.1 | Gọi API không cần UI, chứng minh tái sử dụng | Core không import Express; document_review/case_handling dùng chung engine/API |
| A07 | H: login, người dùng/nhóm/quyền, workspace/knowledge; 4.2 | Màn hình + dữ liệu/role + tài liệu có nội dung | BE me/sources/knowledge và local IdP có; UI/knowledge demo đại diện còn thiếu |
| A08 | P: ≥1 quy trình có state/creator/handler/time/history và hàng chờ; 4.2 | Case lifecycle và hàng chờ xử lý, audit thật | Case lifecycle/history/owner/guards và dashboard waiting counts có; UI chưa có |
| A09 | D: nguồn thống nhất, provenance, tìm/lọc/thống kê/dashboard, REST hoặc GraphQL; 4.2 | Ingest/events + provenance + explorer/dashboard | Normalized ingest/events/search/provenance/dashboard APIs có; raw parsers/dataset/UI còn thiếu |
| A10 | I: ≥1 chức năng thông minh, có thể rule-based; 4.2/7 | Luật/scorer có input, version/license, giới hạn và căn cứ | Rule engine có version/evidence/unresolved; model/scorer/evaluation chưa có |
| A11 | ≥1 ứng dụng cho khoa/phòng/trung tâm/đơn vị đào tạo; 4.3 | Demo ứng dụng sử dụng cả core và H-P-D-I | TraceWeaver đã xác định bài toán; chưa end-to-end |
| A12 | UI rõ ràng, ưu tiên Việt/song ngữ; dashboard/landing trạng thái; mục9 | FE có màn hình và trạng thái dữ liệu/lỗi thực | FE còn skeleton |

## B. Nguồn mở, kỹ thuật và dữ liệu — HaUI mục 5/7/8

| ID | Yêu cầu | Minh chứng cần có / hiện trạng |
|---|---|---|
| B01 | Repo công khai, lịch sử commit thật | Có lịch sử local và URL repo ghi trong README; kiểm lại truy cập công khai tại commit nộp |
| B02 | LICENSE phù hợp và bảng dependency/license | Apache-2.0, SPDX/notices và npm inventory có; audit FE/AI/model/data/image phải bổ sung khi sử dụng |
| B03 | ≥1 release/tag có version | Local có v0.1.0-base.1; release nền không thay bản sản phẩm hoàn chỉnh; cần kiểm URL/assets/commit nộp |
| B04 | Build/install/run từ source theo README | BE smoke/checks có; full FE/BE/AI trên máy mới chưa chứng minh |
| B05 | README đủ kiến trúc/công nghệ/install/config/run/API/demo account | README/INSTALL/API/demo local có; xem CURRENT_STATUS và KEYCLOAK; tài liệu FE/AI bổ sung khi triển khai |
| B06 | CHANGELOG và issue/bug tracker | Có file và issue URL; dùng issue/commit thực tế, không tạo lịch sử giả |
| B07 | Không secret/API key/token/PII trong source | .env.example/ignore/base checks có; tiếp tục kiểm source, history và artifacts trước release |
| B08 | Không thành phần đóng/không rõ giấy phép ở core; ghi origin/version/license/role của bên ngoài | npm notices có; không coi đó là audit toàn distribution/container/model |
| B09 | Tests tối thiểu cho chức năng lõi | 73 unit/HTTP/contract,49 DB,45 identity-native pass; full app E2E/evaluation chưa có |
| B10 | RBAC, hash mật khẩu, quản lý secret/.env.example | DB permissions + Keycloak local có; credentials sinh local; production SSO riêng |
| B11 | Dữ liệu mẫu đủ cho D/I; mỗi nguồn có origin/quyền sử dụng/provenance | Fixtures schema synthetic có; dataset demo/training/manifest thực chưa có |
| B12 | Nguồn/API ngoài không ổn định có snapshot/fallback; không dùng dữ liệu nhạy cảm/trái quyền | Hybrid degraded rule_only đã có; dataset/full offline replay chưa có |

## C. Hồ sơ và trình diễn — HaUI mục 9–10

| Nội dung | Mức yêu cầu | Trạng thái/cách làm |
|---|---|---|
| Demo chuỗi user → core → process → data → Intelligence → result, chỉ rõ 3 tầng | Bắt buộc | Chưa có; xem [kịch bản và hồ sơ](04-DEMO-VA-HO-SO-NOP.md) |
| 10 phút demo + tối đa 5 phút hỏi | Quy định vòng HaUI | Chưa rehearsal; không áp thời lượng này thay Quốc gia |
| Slide tối đa 12 | Giới hạn vòng HaUI | Chưa có slide sản phẩm |
| Repo/release, README, LICENSE/dependency, CHANGELOG/bug tracker | Bắt buộc | Nền đã có một phần; phải kiểm theo bản sản phẩm nộp |
| Báo cáo kỹ thuật | Có trong danh sách hồ sơ | Khuyến nghị 8–10 trang, không ép đủ trang; chưa viết bản kết quả thật |
| Video 3–5 phút | Khuyến nghị | Làm sau khi có flow chạy thật |
| CONTRIBUTING | Khuyến nghị | Đã có |
| Đội ≤3 người, có giảng viên; 14 ngày từ công bố đề nội bộ | Theo PDF HaUI tr.1 | Đội xác nhận thành viên/GV/deadline lịch; không tự gán D1 vào ngày hiện tại |

## D. Quốc gia cần kiểm riêng, không trộn rubric HaUI

Thể lệ được cấp tr.1 yêu cầu phát hành nguồn mở OSI-approved và truy cập source tự do. Tr.2–3 yêu cầu thông báo/license từng tệp mã, bản sao license, release có version trước hạn, source build/configuration, hoạt động ngoài thư mục source, thông tin dependency/bundling, README/changelog/bug tracker. Có header/sidecar và source archive không tự chứng minh mọi tiêu chí đã đạt; cần kiểm đúng artifact phát hành.

Bản thể lệ này liệt kê zip/rar/arj trong dòng định dạng bị trừ điểm. Để chuẩn bị hồ sơ, dùng source tar.gz kèm checksum và xác nhận với BTC nếu có thắc mắc; không tự sửa hoặc diễn giải ngược dòng quy định. Lịch/format nộp Quốc gia phải kiểm theo thông báo áp dụng lúc nộp, không suy từ lịch 14 ngày của HaUI.

## E. Rubric HaUI 100 điểm — mục11 tr.5–6

| PoF — 50 điểm | Điểm |
|---|---|
| Repo công khai/lịch sử/truy cập | 5 |
| License, tương thích dependency và provenance | 10 |
| Release/tag | 5 |
| Build/install từ source, tái lập | 10 |
| Quản lý thư viện/nguồn gốc/phiên bản | 10 |
| README/CHANGELOG/bug tracker/chất lượng docs | 10 |

Product 50 điểm: kiến trúc/core/H-P-D-I 10; hoàn thiện/ổn định 10; thân thiện/giá trị sử dụng 10; mở rộng/bền vững/kỹ thuật 10; trình diễn/giải thích/cộng đồng 10. Đây là rubric, không phải điểm đội đã đạt. Lỗi nghiêm trọng nguồn mở/license/secret có thể ảnh hưởng điều kiện chấm; xem nguyên văn mục12 khi chốt hồ sơ.

## F. Không được nhầm thành bắt buộc của đề

- Đúng hai nguồn dữ liệu công khai không bắt buộc; HaUI chỉ khuyến khích ≥2 khi phù hợp.
- Không bắt buộc LLM hoặc một model cụ thể; rule-based Intelligence được chấp nhận. TraceWeaver vẫn cần kiểm giá trị của hướng AI đã chọn.
- Node/React/PostgreSQL/Keycloak/scikit-learn, ba nguồn intake/account/provision, hai workflow definitions để chứng minh reuse, benchmark10.000 events và mục tiêu precision/latency là lựa chọn/cổng kiểm của dự án, không phải ngưỡng điểm BTC.
- Docker/Compose, CONTRIBUTING, video, OpenAPI là khuyến khích/ưu tiên theo đúng mục tương ứng; source run, REST/GraphQL, core/H-P-D-I/ứng dụng và dữ liệu/tests vẫn phải có.
