# Software Bill of Materials

Danh mục thành phần máy đọc được theo **CycloneDX 1.5 JSON**, bổ sung cho [license inventory và notices](../LICENSES.md).
SBOM giúp tra package/version/license và cây phụ thuộc; không thay thế nguyên văn giấy phép hoặc kết quả quét CVE.

| File | Nguồn | Phạm vi |
|---|---|---|
| [backend.cdx.json](backend.cdx.json) | Root package-lock.json, npm 11.11.0 | Npm packages và workspace backend; gồm dev/test |
| [frontend.cdx.json](frontend.cdx.json) | Frontend package-lock.json, npm 11.11.0 | Cây npm sau `--omit=optional`, gồm dev/build; không phải toàn bộ cây đa nền tảng |
| [ai.cdx.json](ai.cdx.json) | AI requirements.txt và metadata của wheel đã cài đúng pins | Python packages có license expression; danh mục phẳng, chưa có dependency graph |

## Sinh lại và kiểm drift

Chạy từ root bằng Node.js 24.14.1 / npm 11.11.0, không cần cài thêm công cụ CycloneDX:

```sh
npm run sbom
npm run sbom:check
```

Script gọi `npm sbom --package-lock-only --sbom-format=cyclonedx --offline`, không cài package hoặc sửa lockfile.
Timestamp và serial number của lần chạy được bỏ; tên root lấy từ manifest để đổi thư mục checkout không tạo diff giả.
Package identity, license và các dependency references được kiểm trước khi ghi.

Python dùng venv riêng khớp requirements; generator license đồng thời tạo SBOM:

```powershell
.\.venv\Scripts\python.exe -m ai.scripts.dependency_inventory
.\.venv\Scripts\python.exe -m ai.scripts.dependency_inventory --check
```

Linux/macOS dùng `./.venv/bin/python`. Xem [AI RUN](../ai/RUN.md).
Thay dependency, pins, phiên bản dự án hoặc npm generator thì sinh lại và commit SBOM cùng thay đổi đó.
CI kiểm drift của npm và Python; kết quả GitHub chỉ có sau khi workflow chạy trên commit tương ứng.

## Giới hạn đã xác định

- **Frontend optional/WASM:** tại lockfile hiện tại, `npm sbom` toàn cây báo thiếu `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util` của nhánh `@tailwindcss/oxide-wasm32-wasi`. Generator không bỏ qua lỗi bằng force; nó dùng phạm vi `--omit=optional` được ghi ngay trong metadata SBOM. Bảng [frontend dependencies](../frontend/DEPENDENCIES.md) vẫn liệt kê các mục đã khóa, nhưng không chứng minh closure đầy đủ của dependency graph optional. Cần chuẩn hóa lại nhánh WASM và sinh SBOM đầy đủ trước khi phân phối toolchain có nhánh này.
- **Python:** liệt kê package/version/license đã xác minh; chưa mô tả quan hệ phụ thuộc và environment markers theo nền tảng.
- **Images và tài sản:** chưa gồm container/base OS, Node/Python interpreter, browser, model, dataset, font hoặc ảnh. Nguồn/version/digest của services và model được dẫn tại [LICENSES](../LICENSES.md).
- **Phạm vi build:** npm SBOM có cả công cụ dev/build, không phải chỉ code được đóng gói vào web bundle. SBOM runtime image cần sinh từ image phát hành thực tế.

Tham chiếu: [npm sbom](https://docs.npmjs.com/cli/v11/commands/npm-sbom/), [CycloneDX 1.5 schema](https://cyclonedx.org/docs/1.5/json/).
