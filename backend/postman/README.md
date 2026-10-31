# Mô phỏng dịch vụ xác thực trên máy cá nhân

Đã kiểm với Postman CLI 1.74.0. Bộ mô phỏng không dùng tài khoản hoặc không gian làm việc trên đám mây.

## Khi không có Postman CLI

Trong môi trường kiểm thử tự động hoặc máy không cài Postman CLI, chạy `npm run test:identity:native` để kiểm cùng các điều kiện xác thực. File `tests/support/oidc-native-loader.js` chỉ chuyển phần lấy khóa kiểm chữ ký (JWKS) sang máy chủ HTTP giả lập trên máy. Máy chủ này mô phỏng phản hồi JWKS, JSON, HTML, độ trễ và lỗi 501, đồng thời ghi đường dẫn thực tế đã gọi. JOSE, Express và PostgreSQL vẫn chạy thật. Bộ kiểm này không kiểm việc định tuyến hoặc khởi động/dừng Postman. Bước PostgreSQL trong CI chạy bộ kiểm native tuần tự; `test:identity` vẫn dùng Postman. Khi đổi quy định phản hồi giả lập, phải cập nhật đồng bộ cả hai bộ dữ liệu mẫu.

## Dữ liệu và khóa xác thực

`oidc-jwks.openapi.json` định nghĩa cấu trúc phản hồi khóa công khai của Keycloak. Bộ mô phỏng được tạo từ định nghĩa đó, rồi chỉnh để nhận bộ khóa công khai tạm thời qua OIDC_TEST_JWKS. Khóa riêng chỉ nằm trong tiến trình kiểm thử Node. Lời gọi chưa được mô tả trả 501. Bộ mô phỏng chỉ dùng trên máy kiểm thử, không thay dịch vụ đăng nhập thật.

## Cách bộ kiểm thử chạy

`simulations/identity.sim.yaml` định tuyến dưới `/oidc`. `npm run test:identity` khởi động từng bản mô phỏng trên cổng còn trống, chỉ nhận kết nối từ cùng máy. Sau đó bộ kiểm trỏ JOSE thật tới địa chỉ lấy khóa, kiểm nhật ký yêu cầu và chỉ dừng các tiến trình do nó tạo. Các biến thể trả JSON, HTML hoặc trả chậm dùng OIDC_TEST_FAILURE. Độ trễ giả lập là 1000 ms, trong khi máy chủ kiểm thử đặt thời hạn 300 ms. Khi việc xác minh bị từ chối, bộ kiểm chờ nhật ký yêu cầu được ghi xong rồi mới đối chiếu.

Chưa tìm chủ sở hữu qua CLI vì công cụ dòng lệnh chưa đăng nhập. Không đẩy hoặc triển khai bộ mô phỏng lên dịch vụ bên ngoài. Kết quả chỉ xác nhận cách máy chủ xử lý việc lấy khóa qua HTTP, không chứng minh bản Keycloak hoặc đăng nhập tập trung thật đã hoạt động.
