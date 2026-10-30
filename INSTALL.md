# Cài đặt TraceWeaver

Repo gồm backend, frontend, AI và simulator. Cài backend trước; SSO cần cho API nghiệp vụ.
Frontend dùng lockfile riêng, mặc định gọi API/Identity qua HTTPS. AI là tùy chọn.
Các hướng dẫn dưới đây dành cho development; triển khai máy chủ theo [Oracle guide](deploy/oracle/README.md).

## 1. Yêu cầu

| Thành phần | Yêu cầu |
|---|---|
| Backend / simulator | Node.js 24.14.1, npm 11.11.0 |
| Database | PostgreSQL 17 hoặc Docker và Compose v2 |
| Web | Cùng Node/npm, trình duyệt hỗ trợ OIDC/PKCE |
| AI tùy chọn | Python và venv theo [AI RUN](ai/RUN.md); Python 3.10 là phiên bản được tài liệu runtime kiểm trước đây |

Clone repo và chuyển vào thư mục:

```sh
git clone https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver.git
cd TraceWeaver
```

## 2. Backend và PostgreSQL

```sh
npm ci
# Chỉ chạy setup khi chưa có .env:
npm run db:setup
# Chỉ tải nếu chưa có pinned image:
docker compose -f compose.dev.yaml pull postgres
npm run db:up
npm run db:migrate
npm run dev:be
```

Nếu dùng PostgreSQL riêng, cấu hình `DATABASE_URL` và bỏ bước Compose.
Với env cũ, giữ credentials hiện tại và bổ sung `CURSOR_SECRET` ngẫu nhiên tối thiểu 32 ký tự nếu thiếu.
Xem tên biến và chú thích tại [.env.example](.env.example); không commit .env hoặc credentials.

API mặc định bind loopback `http://127.0.0.1:8080`:

- `GET /health/live`: tiến trình đang hoạt động.
- `GET /health/ready`: DB và migrations sẵn sàng; không chứng minh IdP/scorer sẵn sàng.
- `npm run start:be`: chạy không watch.
- `npm run db:stop`: dừng PostgreSQL, giữ volume.

Cổng PostgreSQL Compose mặc định 55432; env có thể ghi đè.
PowerShell dùng `npm.cmd` nếu execution policy chặn npm.ps1.
Không sửa SQL migration đã áp dụng; thêm migration mới để giữ checksum.

## 3. Identity và demo API

API nghiệp vụ cần JWT cùng membership/roles/source grants. Cấu hình `OIDC_ISSUER`, audience/client và trusted JWKS theo [Identity](backend/IDENTITY.md).

Cho local demo, thực hiện đầy đủ mục **Fresh checkout/bootstrap** trong [KEYCLOAK.md](backend/KEYCLOAK.md):
tạo identity demo, chạy Keycloak, đăng ký core client và frontend origins, sau đó chạy API và verifier.
Hướng dẫn này bao gồm các lệnh bootstrap theo đúng thứ tự, không chỉ bước chạy container.

Swagger local: `http://localhost:8080/docs/`, đăng nhập **Authorize → keycloakLogin** sau bootstrap.
Mật khẩu demo được sinh ngẫu nhiên và lưu tại `demo-credentials.local.json` bị Git ignore.
Không xóa volume/import hoặc sinh lại credentials để sửa lỗi đăng nhập của realm đang có.

## 4. Frontend

Chạy tại root:

```sh
npm --prefix frontend ci
```

PowerShell, tạo cấu hình khi chưa có:

```powershell
Copy-Item frontend/.env.example frontend/.env.development.local
npm --prefix frontend run dev
```

Linux/macOS dùng `cp` thay `Copy-Item`.
Mở `http://localhost:5173`; Vite dùng strictPort và dừng nếu cổng đã bận.

Mẫu FE trỏ tới API/Identity HTTPS tại `api.quizlearn.tech`; cần tài khoản và quyền trên deployment đó.
Để dùng deployment khác, sửa các biến công khai trong file vừa tạo:

| Biến | Ý nghĩa |
|---|---|
| `VITE_API_BASE_URL` | HTTPS origin API, không kèm `/api/v1` |
| `VITE_KEYCLOAK_URL` | HTTPS base của Keycloak, có thể gồm path `/identity` |
| `VITE_KEYCLOAK_REALM` | Realm |
| `VITE_KEYCLOAK_CLIENT_ID` | Public client cho Code + PKCE |

Backend cần exact origin `http://localhost:5173` trong `FRONTEND_ORIGINS`; public client cần callback `http://localhost:5173/auth/callback` và Web Origin tương ứng.
Bootstrap backend demo HTTP không tự đáp ứng yêu cầu HTTPS của frontend hiện tại:
muốn FE gọi backend tự host cần endpoint HTTPS và Identity cấu hình phù hợp.
Không đưa client secret/password vào `VITE_*`. Khởi động lại Vite sau thay env.

Build dùng `.env.production.local` hoặc biến môi trường tương ứng:

```sh
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run preview
```

Preview thường dùng cổng 4173 và cần đăng ký origin/callback riêng.
Chi tiết phiên auth và API client tại [frontend README](frontend/README.md).

## 5. AI và dữ liệu demo

- AI baseline: tạo venv, cài pinned requirements và chạy theo [ai/RUN.md](ai/RUN.md).
- Model opt-in: cấu hình theo [backend/SCORER.md](backend/SCORER.md) và đọc [giới hạn model](ai/artifacts/sandbox-v2/README.md).
- Simulator: xem [simulator/README.md](simulator/README.md) để sinh dataset có seed hoặc thao tác sandbox qua API.
- Sandbox cần quyền, cấu hình collector và bằng chứng riêng theo [LAB_SANDBOX.md](backend/LAB_SANDBOX.md).

Oracle đáp án sinh để đánh giá không được đưa vào runtime.
Không coi dữ liệu demo có sẵn hoặc việc tái dựng log là kết quả nghiệp vụ vừa chạy lại.

## 6. Kiểm tra sau cài đặt

```sh
npm run check:base
npm run licenses:check
npm run licenses:frontend:check
npm test
npm run test:sim
```

DB/identity/AI và browser UAT theo [TESTING.md](TESTING.md).
Script license và phạm vi bao phủ tại [LICENSES.md](LICENSES.md).
Gặp lỗi xem [SUPPORT.md](SUPPORT.md); hiện trạng và bằng chứng triển khai theo revision tại [CURRENT_STATUS](docs/CURRENT_STATUS.md).
