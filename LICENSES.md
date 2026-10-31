# Giấy phép và thành phần bên thứ ba

## Mã nguồn dự án

Mã nguồn do TraceWeaver cung cấp theo **Apache License 2.0** tại [LICENSE](LICENSE), với attribution tại [NOTICE](NOTICE).
Metadata package và SPDX của backend sử dụng `Apache-2.0`.
Các dependency và thành phần bên thứ ba giữ giấy phép gốc; license root không thay thế điều khoản của chúng.

## Bảng kiểm kê

| Phạm vi | Nguồn phiên bản | Inventory / notices |
|---|---|---|
| Root + backend npm | [package-lock.json](package-lock.json) | [DEPENDENCIES](backend/DEPENDENCIES.md), [THIRD_PARTY_NOTICES](backend/THIRD_PARTY_NOTICES.txt) |
| Frontend npm | [frontend/package-lock.json](frontend/package-lock.json) | [DEPENDENCIES](frontend/DEPENDENCIES.md), [THIRD_PARTY_NOTICES](frontend/THIRD_PARTY_NOTICES.txt) |
| Mã UI sao chép/chỉnh sửa từ shadcn/ui | URL nguồn ghi trong các component và [upstream](https://github.com/shadcn-ui/ui) | MIT, Copyright (c) 2023 shadcn; [phạm vi và nguyên văn giấy phép](frontend/THIRD_PARTY_NOTICES-SHADCN.txt) |
| Python AI | [requirements.txt](ai/requirements.txt), [direct pins](ai/requirements.in) | [DEPENDENCIES](ai/DEPENDENCIES.md), [THIRD_PARTY_NOTICES](ai/THIRD_PARTY_NOTICES.txt) |
| Model sandbox v2 / synthetic fixtures | Manifest, checksums và nguồn gói bàn giao | [Model card](ai/artifacts/sandbox-v2/README.md), [handoff](ai/handoffs/README.md) |
| PostgreSQL / Keycloak / Node / npm | Phiên bản/digest trong cấu hình và inventory | [Runtime và services](backend/DEPENDENCIES.md#runtime-and-services) |

Model JSON và fixtures được khai báo Apache-2.0 theo gói bàn giao; checksum xác định bytes nhận được, không thay cho tái lập huấn luyện độc lập.
Không áp dụng các giấy phép riêng của repo tham khảo DX-OS lên source TraceWeaver.

Attribution shadcn/ui bao phủ các UI primitives, tiện ích `cn` và phần theme tokens được chỉnh sửa từ upstream. Đây là mã được đưa trực tiếp vào source, được ghi nhận riêng với dependency npm. Giữ [notices shadcn](frontend/THIRD_PARTY_NOTICES-SHADCN.txt) khi phân phối phần mã này; file đó được quản lý riêng để lệnh sinh inventory npm không ghi đè. Phần mã shadcn giữ MIT, mã do dự án cung cấp giữ Apache-2.0.

## Tạo và kiểm tra

Chạy tại root, sử dụng dependencies đã cài đúng lockfile:

```sh
npm run licenses
npm run licenses:check
npm run licenses:frontend
npm run licenses:frontend:check
```

Nếu chưa cài, dùng `npm ci` tại root và `npm --prefix frontend ci`.
Script xác minh version/license metadata của các package bắt buộc đã cài, lấy nguyên văn LICENSE/COPYING/NOTICE hoặc mục license trong README.
Frontend liệt kê toàn bộ lockfile; notices tổng hợp bao phủ các gói không optional.
Các gói optional theo nền tảng được ghi rõ trong bảng; khi phân phối binary/image có chứa chúng, cần kèm notices từ đúng package thực tế.

Python cần venv riêng khớp hoàn toàn `ai/requirements.txt`; thay đường dẫn interpreter cho môi trường của bạn:

```powershell
.\.venv\Scripts\python.exe -m ai.scripts.dependency_inventory
.\.venv\Scripts\python.exe -m ai.scripts.dependency_inventory --check
```

Trên Linux/macOS dùng `./.venv/bin/python`. Cách tạo môi trường tại [AI RUN](ai/RUN.md).
Không chạy bằng Python global có các gói ngoài requirements.

## Khi thay dependency hoặc phát hành

- Giữ manifest và lockfile/pins đồng bộ; tạo lại inventory rồi đọc diff license/notices.
- Giữ attribution của upstream, gói AI bàn giao và mã được sao chép.
- Khi phát hành source, kèm LICENSE, NOTICE và các notices cần thiết.
- Khi phát hành container hoặc binary, kiểm kê thêm dependency thực tế trong image, base OS, optional/native packages và tài sản được đóng gói.
- Ghi nguồn, phiên bản/hash, license và phạm vi sử dụng khi thêm model, dataset, ảnh hoặc font.

Inventory ghi nhận metadata và notices; không phải kết luận tương thích giấy phép cho mọi bản phân phối hoặc kết quả quét CVE.
Danh mục máy đọc được nằm ở [sbom/](sbom/README.md), định dạng CycloneDX 1.5 cho npm và Python. Có lệnh kiểm drift riêng; phạm vi frontend optional và Python dependency graph được ghi rõ.
