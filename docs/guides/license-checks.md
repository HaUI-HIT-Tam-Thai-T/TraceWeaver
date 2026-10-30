# Hướng dẫn kiểm tra license cho thành viên TraceWeaver

Áp dụng khi mới clone, cập nhật dependency hoặc chuẩn bị PR. Chạy lệnh tại thư mục gốc chứa package.json, không phải bên trong backend/. Kiểm license không cần Docker, PostgreSQL, .env hoặc tài khoản demo.

## 1. Chuẩn bị lần đầu

Dùng Node.js 24.14.1 và npm 11.11.0 theo cấu hình repo. Sau khi clone/checkout branch làm việc:

```powershell
node --version
npm.cmd --version
npm.cmd ci --ignore-scripts
```

Nếu dependencies đã cài đúng lockfile thì không cần cài lại chỉ để kiểm license. Linux/macOS có thể dùng npm thay npm.cmd. Không xóa lockfile hoặc node_modules như bước mặc định.

## 2. Kiểm tra mà không ghi lại tài liệu

```powershell
npm.cmd run licenses:check
npm.cmd run check:base
```

`licenses:check` so metadata/version/license của package đã cài với package-lock.json, rồi kiểm hai file inventory/notices có đúng nội dung dự kiến không. Thành công in `License inventory verified: ... npm packages.`; số lượng thay đổi theo dependencies thực dùng.

`check:base` kiểm manifest/lock, Apache-2.0, SPDX trên source và loại trừ các file secret/local khỏi Git. Hai lệnh cần pass trước PR. Đây là các kiểm tra repo; không quét lỗ hổng bảo mật hoặc tự quyết định mọi vấn đề tương thích license.

## 3. Sau khi thêm hoặc nâng dependency

Thêm đúng package/version tại workspace phụ trách; commit cả manifest và lockfile. Sau đó chạy:

```powershell
npm.cmd run licenses
npm.cmd run licenses:check
npm.cmd run check:base
git diff -- backend/DEPENDENCIES.md backend/THIRD_PARTY_NOTICES.txt package-lock.json
```

`licenses` ghi lại hai file bên dưới từ dependencies đã cài. Kiểm diff trước khi commit; không sửa tay tài liệu generated để làm check pass. Ghi lệnh kiểm và kết quả thực trong PR.

| File | Nội dung / người cập nhật |
|---|---|
| [LICENSE](../../LICENSE) | Apache-2.0 của mã dự án; không đổi khi thêm một thư viện |
| [backend/DEPENDENCIES.md](../../backend/DEPENDENCIES.md) | Bảng version, runtime/dev, direct/transitive, license và nguồn; sinh bằng licenses |
| [backend/THIRD_PARTY_NOTICES.txt](../../backend/THIRD_PARTY_NOTICES.txt) | Nguyên văn license/copyright bên thứ ba; sinh bằng licenses |
| [package-lock.json](../../package-lock.json) | Exact resolution/integrity của npm packages; package manager cập nhật |

## 4. Việc của từng phần BE / FE / AI

| Phần phụ trách | Cần làm |
|---|---|
| BE Node.js | Dependency ở backend/package.json; chạy pipeline trên, giữ notices và lockfile cùng thay đổi |
| FE | Khi thêm frontend workspace/dependency, cập nhật workspace và công cụ inventory để nhận manifest/tree mới; không mặc định script hiện tại đã bao phủ FE |
| AI / Python | Npm script không kiểm pip, model hoặc dataset. Lưu version/lock, nguồn/license/notices của Python deps và model/data trong module ai; bổ sung kiểm phù hợp trước tích hợp |
| Dịch vụ/container | Ghi exact version/digest và upstream notices; npm script không audit toàn bộ image/base OS, Keycloak hoặc PostgreSQL distribution |

Giới hạn hiện tại: script đọc manifests root và backend/, duyệt packages ở root node_modules theo lockfile. Workspace mới hoặc dependency cài lồng trong module cần mở rộng công cụ, không chỉ thêm tên vào bảng. Chưa có FE/AI runtime hoàn chỉnh để kiểm toàn bộ các thành phần đó.

Mã mới dùng SPDX như [CONTRIBUTING.md](../../CONTRIBUTING.md). Với SQL đã migrate, không thêm header làm đổi checksum; dùng file .sql.license đi kèm. Giữ attribution của mã bên thứ ba.

## 5. Khi lệnh thất bại

| Thông báo | Xử lý |
|---|---|
| Cannot find package/module | Kiểm đang ở root và đã cài dependencies bằng lockfile |
| Installed package metadata differs from lockfile | Đối chiếu manifest/lock và phiên bản đã cài; cài đồng bộ khi cần, không sửa license metadata trong node_modules |
| Stale inventory | Chạy licenses, kiểm diff, rồi licenses:check |
| Missing license text | Kiểm package exact version và upstream license/notices; ghi nguồn bằng chứng, sửa công cụ để lấy nội dung đúng hoặc chọn dependency rõ nguồn. Không thêm license giả/skip để pass |
| check:base báo SPDX/secret | Bổ sung attribution đúng cho source của mình; bỏ secret khỏi staged files và dùng cấu hình local |

Tài liệu này được Git track để người khác nhận được khi clone/pull. Các tài liệu chuẩn bị trong .local/ và .planning/ không phải hướng dẫn dùng chung đã phát hành.
