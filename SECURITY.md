# Bảo mật TraceWeaver

## Trạng thái

Phiên bản 0.1.0-base.1 là bộ khung phát triển; chưa có API nghiệp vụ hoặc đăng nhập. Chưa có cam kết hỗ trợ production. Chỉ báo lỗi bảo mật qua kênh riêng với maintainer; không đăng credential hoặc dữ liệu nhạy cảm lên issue công khai.

## Quy tắc thực hiện

- OIDC Code + PKCE; API validate issuer/audience/expiry/signature, không tin role client.
- Quyền nguồn kiểm trước search/candidate/scorer và khi đọc run/case cũ.
- Redact token/password trước lưu; log lỗi không echo payload nhạy cảm.
- Oracle chỉ evaluator truy cập; không mount vào runtime.
- Parser chỉ các định dạng cho phép; giới hạn byte/record/time window theo API.
- Model artifact do đội tạo, checksum kiểm trước load; không load pickle không tin cậy.
- AI không có credential ghi DB/workflow hoặc tự chạy lệnh từ nội dung log.
- .env và credential cục bộ bị ignore; .env.example không chứa giá trị dùng được.

## Khi phát hiện vấn đề

Ghi mô tả, phiên bản, bước tái hiện với dữ liệu giả và tác động; giữ thông tin nhạy cảm trong kênh riêng của đội. Nếu repo có private security reporting thì dùng kênh đó. Chưa có kênh riêng: liên hệ trực tiếp maintainer đã biết, không đăng secret lên issue.

Secret lộ: thu hồi/rotate trước, kiểm lịch sử và log liên quan, sửa nguyên nhân rồi scan lại. Xóa dòng khỏi file không đủ để thu hồi credential đã lộ.
