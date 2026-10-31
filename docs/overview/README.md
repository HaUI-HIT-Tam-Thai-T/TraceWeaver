# Tổng quan

[Mục lục tài liệu](../README.md)

TraceWeaver **Dự thi OLP Phần mềm nguồn mở 2026**, do đội **HaUI.Tam_Thái_Tử**, Trường Công nghệ Thông tin và Truyền thông, Đại học Công nghiệp Hà Nội thực hiện.

Sản phẩm nối sự kiện từ nhiều dịch vụ thành hành trình có bằng chứng, hỗ trợ điều tra, duyệt liên kết, xử lý hồ sơ và kiểm chứng việc khắc phục. Tình huống minh họa là tiếp nhận yêu cầu → tạo tài khoản → cấp phát môi trường CNTT.

## Đọc theo nhu cầu

| Nội dung | Tài liệu |
|---|---|
| Ý tưởng, giao diện và công nghệ | [Giới thiệu dự án](../../README.md) |
| Phiên bản đang chạy và giới hạn xác minh | [Hiện trạng](status.md) |
| Tính năng, mã nguồn và kiểm tra liên quan | [Ma trận tính năng](features.md) |
| Kiến trúc ba tầng, lõi xử lý và lớp kết nối với nghiệp vụ | [Kiến trúc](../../ARCHITECTURE.md) |
| Thử một hành trình điều tra | [Hướng dẫn demo](../guides/demo.md) |
| Yêu cầu và hồ sơ dự thi | [Hồ sơ dự thi](../competition/README.md) |

## Những khái niệm cần phân biệt

- **Event:** bản ghi từ dịch vụ nguồn, có thông tin nơi phát sinh; không sửa log gốc để khớp kết luận.
- **Run:** lần dựng hành trình từ bộ log đã được lưu cố định; không đồng nghĩa với thực thi lại nghiệp vụ.
- **Review:** quyết định của người duyệt về liên kết, có lý do và số phiên bản để tránh ghi đè quyết định mới.
- **Case:** hồ sơ xử lý có người nhận, các bước xử lý và lịch sử thay đổi.
- **Sandbox attempt:** lần thực thi mô phỏng mới sau khi sửa điều kiện.
- **Verification/proof:** bằng chứng kiểm chứng nguồn, được đối chiếu trước khi đóng hồ sơ.
