# Đóng gói và phát hành

Tài liệu dùng cho maintainer khi chuẩn bị bản phát hành TraceWeaver. Không tạo tag, upload hay triển khai khi chỉ chạy các lệnh kiểm kê.
Tag `v0.1.0-base.1` là scaffold cũ; trạng thái của bản phát hành mới cần được mô tả theo hành vi thực tế.

## Chuẩn bị revision

1. Chọn commit đã tích hợp đúng BE/FE/AI/simulator; tránh lấy kết quả test của các nhánh khác nhau.
2. Cập nhật CHANGELOG, phiên bản package/lockfile liên quan và ghi rõ giới hạn còn lại.
3. Chạy các kiểm tra phù hợp tại [TESTING](../../TESTING.md), bao gồm DB/identity/browser nếu bản phát hành tuyên bố hỗ trợ luồng đó.
4. Tạo lại inventory, notices và [SBOM](../../sbom/README.md); kiểm drift sau khi sinh.
5. Kiểm tracked paths và nội dung gói để loại credentials, dữ liệu riêng, cache và oracle đánh giá.

## Gói source hiện có

Trong checkout sạch của commit cần đóng gói:

```sh
npm run package:source
```

Script [package-source.js](../../backend/scripts/package-source.js) từ chối working tree không sạch và các đường dẫn secret/local bị cấm.
Nó tạo archive từ đúng Git commit cùng `SHA256SUMS` và `manifest.json` tại `.local/council-evidence/source-<commit>/`.
Script hiện ghi scope là backend candidate; đọc manifest và xác nhận phạm vi trước khi dùng làm release sản phẩm.
Không stash/reset các thay đổi đang làm chỉ để ép script chạy; dùng checkout sạch riêng khi thực sự chuẩn bị release.

## Nội dung cần đính kèm release

| Tệp | Mục đích |
|---|---|
| Source `.tar.gz` | Mã nguồn đúng revision, gồm LICENSE/NOTICE và tài liệu cài đặt |
| `SHA256SUMS` / manifest | Đối chiếu bytes và commit |
| `backend.cdx.json`, `frontend.cdx.json`, `ai.cdx.json` | Dependency inventory có phạm vi ghi rõ; lấy từ đúng commit |
| Release notes | Hành vi mới, cách nâng cấp, migration, kết quả kiểm và giới hạn |

Gói binary/container cần thêm SBOM và notices của distribution thực tế, gồm base OS và optional/native packages được đóng gói.
Không gắn nhãn SBOM hiện có là toàn bộ runtime image.
Không công bố credential demo thật trong notes hoặc tệp đính kèm.

Repo chưa có workflow tự động tạo release sản phẩm hoặc đẩy image; thao tác phát hành là bước riêng của maintainer.
Hướng dẫn triển khai server ở [Oracle](../../deploy/oracle/README.md), license ở [LICENSES](../../LICENSES.md).
