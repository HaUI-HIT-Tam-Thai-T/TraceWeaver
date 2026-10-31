# Cài đặt TraceWeaver

Hướng dẫn này dành cho người muốn chạy TraceWeaver từ mã nguồn trên máy cá nhân. Nếu chỉ muốn dùng thử, mở [bản web trực tuyến](https://traceweaver.quizlearn.tech) và chọn tài khoản demo trong README.

Cài máy chủ trước, sau đó thiết lập đăng nhập để truy cập dữ liệu. Giao diện web cài thư viện riêng và cần kết nối tới máy chủ, dịch vụ đăng nhập qua HTTPS. Dịch vụ AI là phần cài thêm. Triển khai lên máy chủ Oracle theo [hướng dẫn vận hành](deploy/oracle/README.md).

## 1. Yêu cầu

| Thành phần | Yêu cầu |
|---|---|
| Máy chủ / bộ mô phỏng | Node.js 24.14.1, npm 11.11.0 |
| Cơ sở dữ liệu | PostgreSQL 17 hoặc Docker và Compose v2 |
| Web | Cùng Node/npm, trình duyệt hỗ trợ cơ chế đăng nhập của Keycloak (OIDC/PKCE) |
| AI tùy chọn | Python và môi trường cài thư viện riêng (venv) theo [AI RUN](ai/RUN.md); tài liệu chạy AI ghi nhận đã kiểm trên Python 3.10 |

Tải mã nguồn bằng Git và chuyển vào thư mục dự án:

```sh
git clone https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver.git
cd TraceWeaver
```

## 2. Chạy máy chủ và cơ sở dữ liệu

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

Các lệnh trên cài thư viện, tạo cấu hình, chạy PostgreSQL trong Docker và tạo các bảng dữ liệu. Nếu đã có PostgreSQL riêng, đặt địa chỉ kết nối trong `DATABASE_URL` và bỏ bước chạy cơ sở dữ liệu bằng Docker Compose.
Nếu đã có file cấu hình `.env`, giữ tài khoản, mật khẩu hiện tại; bổ sung `CURSOR_SECRET` ngẫu nhiên tối thiểu 32 ký tự nếu thiếu.
Xem tên biến và chú thích tại [.env.example](.env.example); không đưa `.env`, tài khoản hoặc mật khẩu lên Git.

Máy chủ mặc định chỉ nhận kết nối từ chính máy đang chạy tại `http://127.0.0.1:8080`:

- `GET /health/live`: tiến trình đang hoạt động.
- `GET /health/ready`: cơ sở dữ liệu và các bảng cần thiết đã sẵn sàng. Bạn vẫn cần kiểm tra riêng dịch vụ đăng nhập và AI.
- `npm run start:be`: chạy máy chủ mà không tự khởi động lại khi sửa mã.
- `npm run db:stop`: dừng PostgreSQL, giữ dữ liệu đã lưu.

Cổng PostgreSQL Compose mặc định 55432; có thể đổi trong file cấu hình.
PowerShell dùng `npm.cmd` nếu execution policy chặn npm.ps1.
Không sửa script SQL đã dùng để tạo hoặc cập nhật bảng dữ liệu (migration). Hãy thêm script mới; hệ thống kiểm mã băm của script cũ để phát hiện nội dung bị thay đổi.

## 3. Thiết lập đăng nhập và thử API

Muốn đọc hoặc sửa dữ liệu qua API, bạn cần đăng nhập và được cấp quyền trong nhóm làm việc, kể cả quyền đọc từng nguồn log. Sau đăng nhập, ứng dụng gửi mã truy cập có chữ ký (JWT); máy chủ kiểm chữ ký, nơi cấp mã và ứng dụng nhận mã. Các biến `OIDC_ISSUER`, audience/client và địa chỉ lấy khóa kiểm chữ ký (JWKS) được giải thích trong [hướng dẫn xác thực](backend/IDENTITY.md).

Để tạo bản demo trên máy cá nhân, làm đầy đủ mục **Fresh checkout/bootstrap** (thiết lập từ mã nguồn mới tải) trong [KEYCLOAK.md](backend/KEYCLOAK.md):
tạo tài khoản demo, chạy Keycloak, đăng ký ứng dụng gọi lõi xử lý và địa chỉ web được phép kết nối, sau đó chạy máy chủ và công cụ kiểm tra.
Làm theo thứ tự trong hướng dẫn để các tài khoản, quyền và cấu hình kết nối khớp nhau.

Swagger, giao diện xem và thử API trên máy cá nhân: `http://localhost:8080/docs/`, đăng nhập **Authorize → keycloakLogin** sau khi hoàn tất thiết lập đăng nhập.
Mật khẩu demo được sinh ngẫu nhiên và lưu tại `demo-credentials.local.json` được Git bỏ qua.
Không xóa vùng dữ liệu Docker hoặc file nhập cấu hình, cũng không tạo lại mật khẩu để sửa lỗi đăng nhập của vùng tài khoản (realm) đang dùng.

## 4. Frontend: chạy giao diện web

Chạy tại thư mục gốc dự án, nơi có file `package.json`:

```sh
npm --prefix frontend ci
```

PowerShell, tạo cấu hình khi chưa có:

```powershell
Copy-Item frontend/.env.example frontend/.env.development.local
npm --prefix frontend run dev
```

Linux/macOS dùng `cp` thay `Copy-Item`.
Mở `http://localhost:5173`; Vite là công cụ chạy web khi phát triển. Nếu cổng này đã có chương trình dùng, Vite dừng để bạn xử lý thay vì tự đổi cổng.

Mẫu cấu hình giao diện dùng máy chủ và dịch vụ đăng nhập HTTPS tại `api.quizlearn.tech`; bạn cần tài khoản và quyền trên bản triển khai đó.
Để kết nối tới máy chủ khác, sửa các biến công khai trong file vừa tạo:

| Biến | Ý nghĩa |
|---|---|
| `VITE_API_BASE_URL` | Địa chỉ HTTPS của máy chủ, không kèm `/api/v1` |
| `VITE_KEYCLOAK_URL` | Địa chỉ HTTPS của dịch vụ đăng nhập Keycloak, có thể gồm đường dẫn `/identity` |
| `VITE_KEYCLOAK_REALM` | Tên vùng tài khoản |
| `VITE_KEYCLOAK_CLIENT_ID` | Mã ứng dụng web đã đăng ký với Keycloak để đăng nhập bằng Code + PKCE |

Máy chủ cần cho phép chính xác địa chỉ `http://localhost:5173` trong `FRONTEND_ORIGINS`. Ứng dụng web đăng ký trong Keycloak cần có địa chỉ quay lại sau đăng nhập (callback) là `http://localhost:5173/auth/callback` và địa chỉ web được phép sử dụng tương ứng.
Máy chủ demo vừa chạy bằng HTTP chưa đáp ứng yêu cầu HTTPS của giao diện hiện tại. Nếu muốn giao diện gọi máy chủ tự chạy, bạn cần thiết lập HTTPS cho cả máy chủ và dịch vụ đăng nhập.
Không đưa khóa ứng dụng hoặc mật khẩu vào `VITE_*`. Khởi động lại Vite sau khi thay file cấu hình.

Để đóng gói bản web, dùng `.env.production.local` hoặc biến môi trường tương ứng:

```sh
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run preview
```

Bản xem thử sau khi đóng gói thường dùng cổng 4173; cần đăng ký riêng địa chỉ web và địa chỉ quay lại sau đăng nhập cho cổng này.
Cách quản lý phiên đăng nhập và gửi yêu cầu tới máy chủ nằm tại [frontend README](frontend/README.md).

## 5. AI và dữ liệu demo

- AI dùng quy tắc cơ bản (baseline): tạo môi trường Python riêng, cài đúng phiên bản thư viện được liệt kê và chạy theo [ai/RUN.md](ai/RUN.md).
- Muốn dùng mô hình AI thử nghiệm, bạn phải chủ động bật cấu hình theo [backend/SCORER.md](backend/SCORER.md) và đọc [giới hạn model](ai/artifacts/sandbox-v2/README.md).
- Bộ mô phỏng: xem [simulator/README.md](simulator/README.md) để tạo bộ dữ liệu giả có thể tái tạo bằng cùng giá trị khởi đầu (seed), hoặc thao tác môi trường mô phỏng qua API.
- Môi trường mô phỏng cần quyền người dùng, cấu hình bộ chuyển log và bằng chứng kiểm chứng theo [LAB_SANDBOX.md](backend/LAB_SANDBOX.md).

File đáp án dùng để đánh giá (oracle) không được đưa vào chương trình đang xử lý dữ liệu hoặc dùng làm đầu vào cho AI.
Không coi dữ liệu demo có sẵn hoặc việc tái dựng log là kết quả nghiệp vụ vừa chạy lại.

## 6. Kiểm tra sau cài đặt

```sh
npm run check:base
npm run licenses:check
npm run licenses:frontend:check
npm test
npm run test:sim
```

Cách kiểm tra cơ sở dữ liệu, đăng nhập, AI và thao tác thật trên trình duyệt được mô tả trong [TESTING.md](TESTING.md).
Công cụ kiểm giấy phép và những phần công cụ đó kiểm được nằm tại [LICENSES.md](LICENSES.md).
Gặp lỗi xem [SUPPORT.md](SUPPORT.md); hiện trạng và bằng chứng triển khai theo từng phiên bản tại [CURRENT_STATUS](docs/overview/status.md).
