# Dependency, model và data inventory

Bảng theo dõi dự kiến, chưa phải audit hoàn tất. Trước release mọi thành phần thực dùng phải có exact version/digest, license text và nguồn tương ứng. Không dùng chữ “latest”.

| Thành phần dự kiến | Vai trò | Version/digest | Nguồn upstream | License của phiên bản đã chọn | Trạng thái |
|---|---|---|---|---|---|
| Node.js | BE/core runtime | Đã test 24.14.1; engines >=24.14.1 <25 | https://github.com/nodejs/node | Audit runtime/license distribution chưa hoàn tất | Đang dùng local |
| Express | API trung gian/domain | 5.3.0 | https://registry.npmjs.org/express/5.3.0 | MIT theo registry; LICENSE trong package đã cài | Đã pin, test |
| pg | PostgreSQL client/pool | 8.23.1 | https://registry.npmjs.org/pg/8.23.1 | MIT theo registry; LICENSE trong package đã cài | Đã pin, DB integration pass |
| ajv | Dev: JSON Schema 2020-12 validation | 8.20.0 | https://registry.npmjs.org/ajv/8.20.0 | MIT theo registry | Đã pin, strict compile/fixtures pass |
| ajv-formats | Dev: UUID/date-time/URI formats | 3.0.1 | https://registry.npmjs.org/ajv-formats/3.0.1 | MIT theo registry | Đã pin, contract tests pass |
| @apidevtools/swagger-parser | Dev: OpenAPI 3.1 validation/local refs | 13.1.0 | https://registry.npmjs.org/@apidevtools/swagger-parser/13.1.0 | MIT theo registry | Đã pin, OpenAPI pass; remote resolution tắt trong tests |
| React | Frontend | Chưa chọn | https://github.com/facebook/react | Chưa xác minh | Đề xuất |
| Thư viện graph | Graph UX | Chưa chọn | Chưa chọn | Chưa xác minh | Cần chọn |
| Keycloak | Identity | Chưa chọn | https://github.com/keycloak/keycloak | Chưa xác minh | Đề xuất |
| PostgreSQL | Data | 17.11; postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 | https://www.postgresql.org/about/licence/ | PostgreSQL upstream; audit toàn image/base còn pending | Tái sử dụng image cache; DB integration pass |
| Python | AI runtime | Chưa chọn | https://github.com/python/cpython | Chưa xác minh | Đề xuất |
| scikit-learn | Feature/model | Chưa chọn | https://github.com/scikit-learn/scikit-learn | Chưa xác minh | Đề xuất |
| AI HTTP framework | Scorer endpoint | Chưa chọn | Chưa chọn | Chưa xác minh | Cần chọn |
| Compose/runtime | Đóng gói/chạy | Chưa chọn | https://github.com/docker/compose | Kiểm từng tool/distribution | Đề xuất |
| Model do đội train | Scorer weights | Chưa tạo | Pipeline/commit đội | Chưa chọn | Chưa có |
| Dataset synthetic | Train/test/demo | Chưa tạo | Simulator/commit đội | Chưa chọn | Chưa có |

Mỗi dependency bổ sung: direct/transitive, import hay service/tool, checksum, lockfile location, notice, ngày kiểm, người kiểm. Container base image và build tools cũng nằm trong inventory. Công cụ desktop phân phối kèm runtime cần xét riêng; không suy license từ thương hiệu.


BE foundation 19/10/2026: `npm@11.11.0`, lockfile tại root `package-lock.json`, direct manifests tại root và `backend/package.json`. Registry query xác nhận Express/pg version, engines và MIT; `npm install --ignore-scripts --no-audit --no-fund` thêm 80 packages. Lockfile lưu exact resolution/integrity của transitive packages; transitive license/security audit chưa hoàn tất. Không coi inventory này là release gate đã pass. Chưa có container/base image hoặc dependency OIDC/AI được cài trong đợt này.

BE-02 cùng ngày: người dùng bật Docker; image PostgreSQL trên được inspect RepoDigests và chạy `postgres --version` (17.11). Dùng cache, không pull; Compose pin digest. Có volume/database development riêng và database integration nhỏ. Không đổi dependencies Node hoặc cài OIDC/AI. Chọn artifact có sẵn để kiểm local, không tuyên bố đây là phiên bản mới nhất hoặc audit release hoàn tất.
