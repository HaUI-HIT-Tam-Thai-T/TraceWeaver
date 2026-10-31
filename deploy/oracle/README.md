# Triển khai máy chủ và AI trên Oracle

Hướng dẫn này dành cho người vận hành bản cài Oracle đã có. File cấu hình bổ sung mở rộng bản cài riêng tại `.local/oracle/compose.yaml`. Nó giữ cấu hình cơ sở dữ liệu, Keycloak, vùng lưu dữ liệu, vai trò và địa chỉ HTTPS cấp mã đăng nhập của môi trường đang chạy. Không dùng Compose dành cho phát triển để thay cấu hình máy chủ này.

Gói chạy Docker (image) Python 3.12 đã khóa phiên bản chỉ chứa mã cần chạy, thư viện đúng phiên bản, mô hình/bản kê và thông báo giấy phép. Dịch vụ chấm điểm chạy bằng tài khoản hệ điều hành có mã UID65532, chỉ đọc, có giới hạn tài nguyên và không mở cổng ra máy chủ bên ngoài. API vẫn kiểm địa chỉ theo quy tắc môi trường thực tế và kiểm chứng chỉ TLS riêng khi kết nối AI. Các tên máy được chứng chỉ cho phép (SAN) là `scorer`, `localhost`, `127.0.0.1`. Không tắt kiểm chứng chỉ TLS để xử lý lỗi kết nối.

Lưu SCORER_SERVICE_SECRET ngẫu nhiên trong `.local/oracle/.env`; hai dịch vụ phải dùng cùng giá trị bí mật. Chứng chỉ và khóa nằm trong `.local/oracle/scorer-tls/`; chỉ UID65532 của AI được đọc khóa riêng. Bản sao chứng chỉ công khai nằm trong `.local/oracle/scorer-ca/`. Không đưa các file này lên Git. Cấu hình Compose nền, env và chứng chỉ riêng được cung cấp ngoài repo.

## Áp dụng bản triển khai

Tại `.local/oracle/`, đặt TRACEWEAVER_RELEASE bằng mã commit đang triển khai, rồi chạy theo thứ tự:

```sh
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml config --quiet
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml build api scorer
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml up -d --no-deps --no-build --pull never --wait scorer
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml run --rm --no-deps migrate
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml up -d --no-deps --no-build --pull never --wait api
```

## Kiểm tra sau triển khai

Kiểm các địa chỉ HTTPS công khai về trạng thái hoạt động, trạng thái sẵn sàng và tài liệu API. Trong mạng nội bộ, kiểm TLS, trạng thái AI và điểm của dữ liệu mẫu. Thử đăng nhập Keycloak thật bằng PKCE và tạo hành trình mới ở chế độ kết hợp quy tắc/AI để kiểm điểm được lưu. Đối chiếu dữ liệu cũ vẫn đọc được và các ứng dụng khác trên máy chủ vẫn hoạt động. Triển khai thành công chưa chứng minh mô hình đạt chất lượng trên dữ liệu thực tế; xem `ai/artifacts/sandbox-v2/README.md`.

## Quay về bản API trước

Compose nền giữ image API trước đó. Nếu kiểm sau triển khai thất bại, khôi phục API bằng `docker compose -f compose.yaml up -d --no-deps --no-build --pull never --wait api` trong lúc tìm lỗi. Không cần khởi động lại cơ sở dữ liệu/Keycloak, xóa vùng dữ liệu, dọn image, đổi khóa hoặc sửa lịch sử cập nhật bảng. Những lần khởi động lại bản mới sau này phải dùng cả cấu hình bổ sung này và TRACEWEAVER_RELEASE đã ghi nhận.

## Kết nối giao diện trên máy cá nhân, không qua Vite proxy

Để giao diện đang phát triển gọi thẳng API HTTPS này, đặt
`FRONTEND_LOCAL_ORIGINS=http://localhost:5173,http://127.0.0.1:5173` trong
`.local/oracle/.env` riêng. Cấu hình bổ sung chỉ truyền biến này cho API. Triển khai mã API đã cập nhật và tạo lại container API để áp dụng; không cần cập nhật bảng dữ liệu hoặc khởi động lại AI.

Giữ nguyên danh sách địa chỉ HTTPS được phép trong `FRONTEND_ORIGINS`. Danh sách mới mặc định rỗng, chỉ nhận địa chỉ HTTP trỏ về chính máy đang chạy, khớp chính xác; không nhận ký tự đại diện, đường dẫn hoặc địa chỉ mạng LAN/công khai.

Với mỗi địa chỉ web đã cấu hình, kiểm yêu cầu thăm dò quyền kết nối (preflight) cho GET/POST/PUT. Khi chưa đăng nhập, `/api/v1/me` phải trả 401 cùng header CORS đúng; địa chỉ hoặc cổng chưa đăng ký phải bị từ chối. Kiểm cả địa chỉ quay lại sau đăng nhập, địa chỉ web và địa chỉ đăng xuất trong ứng dụng Keycloak cho từng địa chỉ web trên máy cá nhân. Cấu hình CORS của API không tự cấu hình Keycloak. Giữ cơ chế Authorization Code + PKCE và các địa chỉ đang có.

Giao diện dùng `VITE_API_BASE_URL=https://api.quizlearn.tech`; giữ các giá trị Keycloak hiện tại và khởi động lại Vite. Không cần sửa màn hình giao diện hoặc định nghĩa API.
