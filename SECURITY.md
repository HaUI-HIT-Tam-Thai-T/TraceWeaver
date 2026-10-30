# Bảo mật TraceWeaver

## Trạng thái

Tag `v0.1.0-base.1` là bộ khung cũ. Dự án đang phát triển; xem [hiện trạng](docs/overview/status.md) theo revision và môi trường. Chưa công bố dòng release được hỗ trợ dài hạn hoặc SLA vá lỗi. Chỉ báo lỗi bảo mật qua kênh riêng với maintainer; không đăng credential/dữ liệu nhạy cảm lên issue công khai.

## Quy tắc thực hiện

- OIDC Code + PKCE; API validate issuer/audience/expiry/signature, không tin role client.
- Quyền nguồn kiểm trước search/candidate/scorer và khi đọc run/case cũ.
- Redact token/password trước lưu; log lỗi không echo payload nhạy cảm.
- Oracle chỉ evaluator truy cập; không mount vào runtime.
- Parser chỉ các định dạng cho phép; giới hạn byte/record/time window theo API.
- Model artifact do đội tạo, checksum kiểm trước load; không load pickle không tin cậy.
- AI không có credential ghi DB/workflow hoặc tự chạy lệnh từ nội dung log.
- .env và credential cục bộ bị ignore; .env.example không chứa giá trị dùng được.
- API/core từ chối compressed request415; body-parser2.4.0 và fast-uri3.1.9 đã pin để xử lý advisory đã audit. npm audit0 chỉ áp dụng cây npm/lần kiểm, không chứng minh Docker/OS/model an toàn.
- CORS exact origins chỉ cho API/health, không thay auth; core dùng server credentials. Production browser origins phải HTTPS explicit, runtime DB role/TLS phải chuẩn bị riêng khỏi cấu hình development.

## Khi phát hiện vấn đề

CI hiện cấu hình kiểm inventory/license và SBOM drift. Workflow [Dependency audit](.github/workflows/dependencies.yml) kiểm npm lockfile root/frontend khi dependency đổi và hằng tuần, gồm dev/build tools; mức chặn là high trở lên. Dependabot đề xuất cập nhật theo tháng. Đây là cấu hình tự động hóa, không phải tuyên bố lần quét mới đã pass. Python CVE, container/OS và secret-content scanning chưa được workflow này bao phủ.

Ghi mô tả, phiên bản, bước tái hiện với dữ liệu giả và tác động; giữ thông tin nhạy cảm trong kênh riêng của đội. Nếu repo có private security reporting thì dùng kênh đó. Chưa có kênh riêng: liên hệ trực tiếp maintainer đã biết, không đăng secret lên issue.

Secret lộ: thu hồi/rotate trước, kiểm lịch sử và log liên quan, sửa nguyên nhân rồi scan lại. Xóa dòng khỏi file không đủ để thu hồi credential đã lộ.
