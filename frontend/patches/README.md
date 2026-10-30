# Bản vá FE không merge vào nhánh BE

`fix-optional-lab-404.patch` áp dụng lên FE commit `12335d5` của nhánh
`ThienBao/feature/app-shell-ui`, từ repository root:

```sh
git apply --check frontend/patches/fix-optional-lab-404.patch
git apply frontend/patches/fix-optional-lab-404.patch
```

Nếu lấy patch từ nhánh BE, lưu file patch tại đường dẫn tương ứng trước khi chạy.
Không áp dụng trên FE cũ của nhánh BE: patch cần integration sandbox đã có trong12335d5.

Sửa controller để404 từ GET workspace `/lab` chỉ là lỗi module, không purge hồ sơ hợp lệ.
401/403 vẫn purge;404 từ case-bound sandbox/proofs vẫn giữ xử lý mất scope cũ.
Không đổi BE closure guard, không suy ra được miễn proof từ việc đọc module thất bại.

Panel của hồ sơ chưa cấu hình sandbox hiển thị thông báo trung tính khi đã xác định đúng tổ hợp
sandbox422/binding required, lab404 và đọc proofs thành công; lỗi dịch vụ khác vẫn hiển thị lỗi.

Panel phân biệt “Chưa chạy kiểm tra”, “Chưa đạt”, “Phiên bản nguồn đã thay đổi — cần chạy lại”
và “Đã chạy đạt”. Hồ sơ đã đóng hiển thị trạng thái đóng riêng, kết quả lần chạy và bản kiểm chứng
lịch sử riêng; không yêu cầu kiểm chứng mới chỉ vì phiên bản hồ sơ tăng khi đóng.
Mã ACCOUNT_DISABLED có giải thích rõ bằng tiếng Việt. FE vẫn giữ nguyên kết quả BE trả về;
lỗi BE dùng phiên bản toàn sandbox để đánh giá hiệu lực sẽ xử lý sau cùng simulator.

28 tests sandbox/UI/workflow liên quan, TypeScript và lint đã đạt. Snapshot đang chạy ở
`.local/fe-12335d5/frontend` đã áp dụng bản sửa để tải lại trang.
Không merge, push hoặc triển khai production FE; không đổi BE/simulator trong bản sửa này.
