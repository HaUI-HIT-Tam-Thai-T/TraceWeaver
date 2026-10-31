# Đóng góp

Tạo thay đổi nhỏ, nêu mục tiêu và cách kiểm tra trong báo lỗi hoặc đề xuất thay đổi (issue/PR). Dùng `backend/contracts/` làm định nghĩa API chung cho backend, frontend và AI.

Đọc [quy tắc ứng xử](CODE_OF_CONDUCT.md), [kiến trúc](ARCHITECTURE.md) và [cài đặt](INSTALL.md).
Tạo bản sao repo trên GitHub (fork) hoặc một nhánh để làm thay đổi. Gửi đề xuất gộp mã (PR) tới đúng nhánh của công việc; không tự chọn nhánh khác khi đã có yêu cầu về nhánh đích.
PR cần nêu vấn đề, hành vi sau sửa, thay đổi định nghĩa API, script cập nhật bảng dữ liệu hoặc thư viện và kết quả kiểm thật.
Bug và feature có mẫu tại [Issues](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues/new/choose).

- Node.js ES modules; import nội bộ có đuôi `.js`.
- Router khai báo endpoint; controller xử lý HTTP; service giữ nghiệp vụ; model/repository truy cập dữ liệu.
- Core không phụ thuộc Express. Lưu thay đổi nghiệp vụ và lịch sử thao tác trong cùng giao dịch dữ liệu: cùng thành công hoặc cùng hủy.
- Mỗi API đọc hoặc sửa dữ liệu nghiệp vụ phải kiểm đăng nhập và quyền nguồn trước khi xử lý.
- Thay cấu trúc dữ liệu bằng script cập nhật mới (migration); không sửa script đã chạy.
- Chạy `npm test`; chạy kiểm tra với cơ sở dữ liệu thật khi thay SQL hoặc cách đọc/ghi dữ liệu.
- Không commit `.env`, token, dữ liệu cá nhân hoặc file đáp án đánh giá (oracle).

Commit theo Conventional Commits. PR ghi hành vi thay đổi, lệnh kiểm thử và giới hạn còn lại.

Mã mới dùng Apache-2.0 và dòng khai báo giấy phép SPDX ở đầu file. Thay dependency cần chạy `npm run licenses`, `npm run licenses:check` và `npm run check:base`. Giữ nguyên ghi công/giấy phép của mã bên thứ ba. Không thêm SPDX trực tiếp vào SQL đã dùng để cập nhật cơ sở dữ liệu; dùng file `.sql.license` đi kèm để giữ nguyên mã băm kiểm nội dung.

## Thư viện và giấy phép

Chạy lệnh license tại thư mục gốc; không cần cơ sở dữ liệu hoặc khóa bí mật. Nếu thư viện đã cài đúng phiên bản ghi trong file khóa (lockfile) thì không cài lại. Khi thêm/nâng dependency, commit file khai báo thư viện (manifest) và lockfile, chạy `npm run licenses`, đọc diff [inventory](backend/DEPENDENCIES.md)/[notices](backend/THIRD_PARTY_NOTICES.txt), rồi chạy hai lệnh check ở trên. Không sửa thông tin package trong node_modules hoặc bỏ qua gói thiếu giấy phép chỉ để công cụ báo đạt.

Backend dùng `npm run licenses` / `npm run licenses:check`. Frontend có lockfile riêng: dùng `npm run licenses:frontend` / `npm run licenses:frontend:check` từ root. Python dùng `python -m ai.scripts.dependency_inventory` và `--check` trong môi trường Python riêng, dùng đúng các phiên bản đã khóa. Commit inventory/notices cùng thay đổi dependency; xem [LICENSES.md](LICENSES.md) về gói tùy chọn, gói chạy theo nền tảng, mô hình, dữ liệu và hệ điều hành trong image.

Khi đóng góp, bạn xác nhận có quyền cung cấp nội dung theo [Apache-2.0](LICENSE), đồng thời giữ giấy phép/attribution gốc của phần bên thứ ba. Không đổi giấy phép của mã được sao chép thành giấy phép dự án.

## Kiểm tra trước PR

Chọn kiểm tra theo [TESTING.md](TESTING.md). Sửa giao diện cần kiểm thử web và kiểm lỗi mã; sửa nghiệp vụ máy chủ cần kiểm logic và API. Thay cơ sở dữ liệu hoặc quyền cần kiểm các thành phần phối hợp với dữ liệu thật. Ghi rõ kiểm tra chưa chạy và điều kiện còn thiếu. Không lấy số lượng test lịch sử làm kết quả của PR mới.

## Mở rộng nghiệp vụ mà giữ ranh giới core

1. Xác định hành vi dùng chung và hành vi riêng của TraceWeaver theo [ARCHITECTURE](ARCHITECTURE.md). Quy tắc nguồn log, phạm vi lần dựng hành trình hoặc kiểm chứng mô phỏng có thể chỉ phù hợp với TraceWeaver; không mặc định áp dụng chúng cho mọi ứng dụng dùng chung lõi.
2. Với quy trình hồ sơ, khai báo trạng thái, bước chuyển, vai trò và điều kiện ở máy chủ. API lõi không nhận định nghĩa quy trình tùy ý từ trình duyệt. Kiểm quyền hiện tại trong cơ sở dữ liệu, lưu thay đổi và lịch sử trong cùng giao dịch.
3. Nếu thay HTTP, sửa OpenAPI, JSON Schema và dữ liệu mẫu kiểm thử trong cùng PR và cập nhật chương trình gọi API tương ứng.
4. Viết test cho vai trò bị từ chối, xung đột phiên bản, hủy giao dịch khi lỗi, lịch sử thao tác và gửi lại yêu cầu liên quan; xem [bảng tính năng](docs/overview/features.md) để chọn bộ kiểm.
5. Cập nhật demo và giới hạn nếu hành vi người dùng thay đổi. Ghi rõ mã mới đã được kết nối và triển khai ở đâu; sửa mã trên máy không tự cập nhật dịch vụ đang chạy.

Ví dụ đăng ký quy trình dùng trực tiếp qua mã mà không cần giao diện và tình trạng refactor tại [core README](backend/src/core/README.md).

## Cập nhật thư viện

Dependabot được cấu hình cho root/backend npm, frontend npm và GitHub Actions; PR cập nhật vẫn cần người duy trì xem xét.
Python requirements.in/requirements.txt được giữ đồng bộ thủ công và kiểm bằng môi trường Python riêng. Khi đổi phiên bản, cập nhật đồng bộ cả hai file.
Thay dependency cần tạo lại license/notices và `npm run sbom`, sau đó chạy `npm run sbom:check`; công cụ tạo danh sách Python đồng thời cập nhật SBOM của AI.
Lỗi optional/WASM frontend đã biết nằm ở [SBOM README](sbom/README.md); không ép bỏ lỗi hoặc bỏ kiểm tra để che việc cây phụ thuộc chưa đủ.
Chuẩn bị release theo [RELEASING](docs/guides/release.md).
