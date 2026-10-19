# Bảo mật TraceWeaver

## Trạng thái

Chưa có sản phẩm phát hành hoặc phiên bản được hỗ trợ. Đội chưa công bố đầu mối báo cáo bảo mật. Trước public release phải điền maintainer và bật kênh báo riêng; không invent email.

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
