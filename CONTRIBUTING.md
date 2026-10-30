# Đóng góp

Tạo thay đổi nhỏ, nêu mục tiêu và cách kiểm tra trong issue/PR. Dùng `backend/contracts/` làm hợp đồng chung cho backend, frontend và AI.

Đọc [quy tắc ứng xử](CODE_OF_CONDUCT.md), [kiến trúc](ARCHITECTURE.md) và [cài đặt](INSTALL.md).
Fork repo hoặc tạo branch cho thay đổi; gửi PR vào nhánh đích phù hợp với module đang phát triển.
PR cần nêu vấn đề, hành vi sau sửa, thay đổi contract/migration/dependency và kết quả kiểm thật.
Bug và feature có mẫu tại [Issues](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues/new/choose).

- Node.js ES modules; import nội bộ có đuôi `.js`.
- Router khai báo endpoint; controller xử lý HTTP; service giữ nghiệp vụ; model/repository truy cập dữ liệu.
- Core không phụ thuộc Express. Dùng transaction cho nghiệp vụ và audit.
- Không mở endpoint nghiệp vụ trước xác thực và kiểm quyền nguồn.
- Thêm migration mới, không sửa migration đã áp dụng.
- Chạy `npm test`; chạy integration khi thay SQL hoặc hành vi DB.
- Không commit `.env`, token, dữ liệu cá nhân hoặc oracle.

Commit theo Conventional Commits. PR ghi hành vi thay đổi, lệnh kiểm thử và giới hạn còn lại.

Mã mới dùng Apache-2.0 và SPDX header. Thay dependency cần chạy `npm run licenses`, `npm run licenses:check` và `npm run check:base`. Giữ nguyên attribution/license của mã bên thứ ba. Không thêm SPDX trực tiếp vào SQL đã migrate; dùng file `.sql.license` đi kèm để giữ checksum.

## Dependency và license

Chạy lệnh license tại root; không cần DB hoặc secrets. Nếu dependencies đã khớp lockfile thì không cài lại. Khi thêm/nâng dependency, commit manifest và lockfile, chạy `npm run licenses`, đọc diff [inventory](backend/DEPENDENCIES.md)/[notices](backend/THIRD_PARTY_NOTICES.txt), rồi chạy hai lệnh check ở trên. Không sửa metadata trong node_modules hoặc bỏ qua license thiếu để làm check pass.

Backend dùng `npm run licenses` / `npm run licenses:check`. Frontend có lockfile riêng: dùng `npm run licenses:frontend` / `npm run licenses:frontend:check` từ root. Python dùng `python -m ai.scripts.dependency_inventory` và `--check` trong venv đúng pins. Commit inventory/notices cùng thay đổi dependency; xem [LICENSES.md](LICENSES.md) về optional/native packages, model, dataset và container/base OS.

Khi đóng góp, bạn xác nhận có quyền cung cấp nội dung theo [Apache-2.0](LICENSE), đồng thời giữ giấy phép/attribution gốc của phần bên thứ ba. Không đổi giấy phép của mã được sao chép thành giấy phép dự án.

## Kiểm tra trước PR

Chọn kiểm tra theo [TESTING.md](TESTING.md). UI cần frontend tests/lint; nghiệp vụ backend cần unit/contracts, thay DB/quyền cần integration. Ghi rõ kiểm tra chưa chạy và điều kiện còn thiếu. Không lấy số lượng test lịch sử làm kết quả của PR mới.

## Mở rộng nghiệp vụ mà giữ ranh giới core

1. Xác định hành vi dùng chung và hành vi riêng của TraceWeaver theo [ARCHITECTURE](ARCHITECTURE.md). Luật nguồn log, run scope hoặc proof sandbox không tự động trở thành policy chung cho mọi ứng dụng.
2. Với workflow, định nghĩa state/transition/role/guard ở server; core HTTP không nhận definition tùy ý do browser gửi. Giữ kiểm current DB grants và business write/audit cùng transaction.
3. Nếu thay HTTP, sửa OpenAPI/JSON Schema/fixtures trong cùng PR và cập nhật consumer tương ứng.
4. Viết test cho role bị từ chối, version conflict, rollback/audit và replay liên quan; xem [bảng tính năng](docs/FEATURE_STATUS.md) để chọn bộ kiểm.
5. Cập nhật demo và giới hạn nếu hành vi người dùng thay đổi. Ghi rõ source mới đã tích hợp/deploy ở đâu; working tree không tự cập nhật container.

Ví dụ đăng ký workflow headless và tình trạng refactor tại [core README](backend/src/core/README.md).

## Cập nhật dependency

Dependabot được cấu hình cho root/backend npm, frontend npm và GitHub Actions; PR cập nhật vẫn cần maintainer review.
Python requirements.in/requirements.txt được giữ đồng bộ thủ công và kiểm bằng venv riêng. Không chỉ đổi pins trong một file.
Thay dependency cần tạo lại license/notices và `npm run sbom`, sau đó chạy `npm run sbom:check`; Python generator đồng thời cập nhật SBOM của AI.
Lỗi optional/WASM frontend đã biết nằm ở [SBOM README](sbom/README.md); không dùng force hoặc bỏ kiểm để che lỗi resolution.
Chuẩn bị release theo [RELEASING](docs/RELEASING.md).
