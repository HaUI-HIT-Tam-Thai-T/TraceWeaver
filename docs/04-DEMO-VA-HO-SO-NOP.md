# 04 — Demo, hồ sơ nộp và cổng release

Nguồn: đề HaUI mục5/9/10/11 và thể lệ Quốc gia trang2–3 đã đối chiếu tại [01](01-DOI-CHIEU-DE-THI.md). Đây là hồ sơ cả đội; không mặc định người dùng chỉ làm BE phải tự làm FE/AI/slide thay các phần khác.

## Checklist trước khi nộp

| Hạng mục | Ai cung cấp phần liên quan | Minh chứng phải có | Hiện trạng |
|---|---|---|---|
| Repo công khai + commit history | Các phần source; người giữ repo kiểm quyền truy cập | URL mở bằng phiên không đăng nhập, source commit/tag | Có repo URL/history; kiểm lại đúng bản nộp |
| LICENSE/SPDX/notices | Mỗi phần giữ attribution/deps của mình | License text, header/sidecar, npm/Python/model/data/image inventory | Apache/npm có; audit toàn sản phẩm còn thiếu |
| Source build/install/config/run | BE/FE/AI theo module | Exact commands, env.example, máy mới/commit/hash, hoạt động ngoài source tree khi đóng gói | BE nền có; FE/AI/full app chưa có |
| Release/tag đúng version trước hạn | Bản tích hợp đủ điều kiện | URL, commit, source tar.gz/checksum, nội dung và giới hạn thật | Có tag nền v0.1.0-base.1; chưa xác nhận artifact sản phẩm hoàn chỉnh |
| README/API/demo accounts | BE cung cấp API/seed, FE hướng dẫn thao tác | Hướng dẫn 3 tầng/H-P-D-I/tính năng/install/run/API; account tạo local | Có docs nền; demo accounts/flow còn thiếu |
| CHANGELOG/bug tracker | Từng phần cập nhật thay đổi/lỗi thật | Changelog và issue URL có hoạt động thực | Có khung/lịch sử; duy trì đến freeze |
| Báo cáo kỹ thuật | BE kiến trúc/API/quyền/workflow; FE UX; AI data/model/metrics | Kiến trúc, luồng, phần tự xây/tích hợp, kết quả và giới hạn | Chưa có bản kết quả sản phẩm |
| Slide ≤12, demo 10+5 phút | Mỗi phần chuẩn bị evidence; đội chốt người trình bày | Luồng thật, chỉ rõ tầng1/2/3, rehearsal đúng thời gian | Chưa có demo toàn luồng |
| Dữ liệu mẫu/provenance/fallback | Người làm simulator/data + BE/AI | Manifest/hashes/permission, observable/oracle isolation, offline replay rõ nhãn | Chưa có dataset nghiệp vụ |
| Test/security/reproducibility | Mỗi phần cung cấp report, chạy tích hợp cùng nhau | T01–T20 áp dụng, không secret/PII, actual results | Có tests BE một phần; E2E chưa có |
| CONTRIBUTING | Người làm source/docs | Hướng dẫn đóng góp/PR/tests | Khuyến nghị; đã có |
| Video 3–5 phút | Đội ghi sau flow ổn định | Video đúng bản demo, ghi replay nếu dùng | Khuyến nghị; chưa có |
| Tên đội/thành viên/GV/deadline | Đội tự xác nhận | Thông tin đăng ký và hạn nộp chính xác | Không suy từ ngày hiện tại hoặc lịch tương đối |

Không đánh dấu repo URL hoặc có tag là toàn bộ PoF đã đạt. Bản nền không chứa workflow/Intelligence/UI đầy đủ. Không chép mục tiêu vào bảng actual hoặc chụp mock thành ảnh tính năng thật.

## Kịch bản demo HaUI 10 phút đề xuất

| Phút | Thao tác | Chứng minh |
|---|---|---|
| 0–1 | Yêu cầu cấp môi trường bị mắc và người dùng trung tâm CNTT | Bài toán đào tạo, dữ liệu giả lập được công bố |
| 1–2 | Sơ đồ 3 tầng, login và gọi core API | Core headless, Identity/API/Data/Workflow |
| 2–3 | Nạp batch và mở event/provenance | D: accepted/duplicate/rejected, nguồn gốc |
| 3–5 | Chọn root, dựng hành trình và xem evidence | Rules/model, phần chưa rõ không đoán chắc |
| 5–6 | Same actor/ambiguous, reviewer chấp nhận/bác bỏ | Unresolved, human review/history/version |
| 6–8 | Tạo case, assign, xử lý, evidence, verification/close | P: state/owner/time/guard/audit/hàng chờ |
| 8–9 | Dashboard/KB và workflow definition khác qua API | H/D và core reuse |
| 9–10 | Baseline/model, source build/release/license/limits | I có bằng chứng và PoF |

Tối đa5 phút hỏi là quy định HaUI. Nếu dữ liệu replay hoặc AI lỗi, nói rõ và hiển thị degraded; missing log chỉ là thiếu bằng chứng, không mặc định lỗi nghiệp vụ. Không áp thời lượng này thay thông báo Quốc gia.

## Khung báo cáo và slide

Báo cáo: bối cảnh/phạm vi → kiến trúc3tầng và phần tự xây/tích hợp → data/schema/provenance → I/baseline/model/đánh giá → workflow/quyền/UX → triển khai/tests → nguồn mở/deps/release → limits/kết luận. Độ dài 8–10 trang là khuyến nghị, không kéo dài để đủ trang. Phụ lục có API/test matrix/model-data cards và link source/report.

Slide tối đa12: tên/bài toán, ví dụ trước-sau, kiến trúccore, H-P-D-I, data/quyền, Intelligence, review/workflow/UX, kết quảđo, kiểmthử/sourcebuild, license/release, limits và repo. Gộp nội dung để chừa thời gian thao tác thật; không cần đủ12.

## Cổng release của dự án

1. Các module từ source chạy được cùng nhau; dữ liệu mẫu và account local không lộ secret. Chạy máy mới và backup/restore, offline startup/replay; ghi cache có/không.
2. Quyền, provenance, workflow/audit, oracle isolation đúng; những case chưa đạt có ghi nhận và xử lý trước nộp. I có kết quả thật và fallback/limits công khai.
3. Inventory toàn thành phần thực dùng, notices/model/data rights, source/license/secret check; npm licenses:check không thay audit Python/image/model/data.
4. Chốt commit, changelog và known limitations, tạo release/tag; kiểm source tar.gz/checksum và build từ đúng archive. Bản thể lệ Quốc gia có dòng zip/rar/arj bị trừ điểm, cần theo bản áp dụng/BTC khi nộp.
5. Kiểm URL repo/release/report/slide/video, rehearsal10phút và câu hỏi kiến trúc: core nằm đâu, app khác tái dùng thế nào, I hơn luật ở đâu, dữ liệu thiếu/API hỏng xử lý gì, source build có tái lập không.

Các lệnh/script chưa có cho full app phải được hiện thực và thử trước khi đưa vào INSTALL. Không thêm placeholder target luôn exit0 hoặc đánh dấu mọi checkbox chỉ vì đã tạo tài liệu.
