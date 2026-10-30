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

Hai regression tests: hồ sơ thường đọc được, sandbox422/proofs200/lab404 vẫn giữ chi tiết và thêm
bằng chứng được; optional lab404 không purge, lab401/403 vẫn purge.38 tests liên quan, TypeScript và
lint đã đạt. Snapshot đang chạy ở `.local/fe-12335d5/frontend` đã được áp dụng bản sửa để người dùng
tải lại trang. Không merge, push hoặc triển khai production FE trong lượt sửa này.
