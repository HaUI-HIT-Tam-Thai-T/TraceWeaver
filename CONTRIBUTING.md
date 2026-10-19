# Đóng góp

Tạo thay đổi nhỏ, nêu mục tiêu và cách kiểm tra trong issue/PR. Dùng `backend/contracts/` làm hợp đồng chung cho backend, frontend và AI.

- Node.js ES modules; import nội bộ có đuôi `.js`.
- Router khai báo endpoint; controller xử lý HTTP; service giữ nghiệp vụ; model/repository truy cập dữ liệu.
- Core không phụ thuộc Express. Dùng transaction cho nghiệp vụ và audit.
- Không mở endpoint nghiệp vụ trước xác thực và kiểm quyền nguồn.
- Thêm migration mới, không sửa migration đã áp dụng.
- Chạy `npm test`; chạy integration khi thay SQL hoặc hành vi DB.
- Không commit `.env`, token, dữ liệu cá nhân hoặc oracle.

Commit theo Conventional Commits. PR ghi hành vi thay đổi, lệnh kiểm thử và giới hạn còn lại.

Mã mới dùng Apache-2.0 và SPDX header. Thay dependency cần chạy `npm run licenses`, `npm run licenses:check` và `npm run check:base`. Giữ nguyên attribution/license của mã bên thứ ba. Không thêm SPDX trực tiếp vào SQL đã migrate; dùng file `.sql.license` đi kèm để giữ checksum.

Các bước cho thành viên mới, xử lý lỗi và trách nhiệm BE/FE/AI nằm trong [hướng dẫn license cho team](docs/HUONG-DAN-LICENSE-CHO-TEAM.md).
