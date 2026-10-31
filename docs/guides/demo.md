# Khám phá TraceWeaver

Mục tiêu: từ nhật ký (log) của một yêu cầu cấp môi trường thất bại, tìm bước gây lỗi, mở hồ sơ và kiểm tra kết quả sau khi sửa. Phần sửa và chạy lại dùng môi trường mô phỏng, gọi là sandbox.
Mỗi bước có kết quả cần quan sát để người mới tự đối chiếu.

## Chọn cách bắt đầu

| Mục đích | Điểm bắt đầu | Điều kiện |
|---|---|---|
| Thử bản web đã triển khai | [TraceWeaver trực tuyến](https://traceweaver.quizlearn.tech), [tài khoản demo](../../README.md#chọn-vai-trò-để-trải-nghiệm) | Chọn nhóm làm việc Sandbox và vai trò phù hợp |
| Hiểu dữ liệu, chưa cần chạy dịch vụ | `npm run sim:generate` tại thư mục gốc dự án | Node 24; chỉ in thông tin bộ dữ liệu ra màn hình, không ghi cơ sở dữ liệu hoặc file |
| Chạy API local và Swagger | [INSTALL](../../INSTALL.md), [Keycloak bootstrap](../../backend/KEYCLOAK.md) | PostgreSQL, dịch vụ đăng nhập và quyền truy cập demo |
| Thử giao diện | [Frontend setup](../../INSTALL.md#4-frontend) | Địa chỉ HTTPS của máy chủ/dịch vụ đăng nhập và tài khoản được cấp quyền; web trên máy cá nhân tại localhost:5173 |
| Thử sửa lỗi và đóng hồ sơ | [Sandbox guide](../../backend/LAB_SANDBOX.md) | Môi trường mô phỏng và bộ chuyển log đã cấu hình; quyền điều tra, kiểm duyệt hoặc quản trị phù hợp |

Địa chỉ máy chủ demo được cấu hình trong mẫu giao diện tại `https://api.quizlearn.tech`; Swagger tại [API docs](https://api.quizlearn.tech/docs/).
Máy chủ có thể cần bảo trì; việc biết địa chỉ không cấp quyền đọc hoặc sửa mọi dữ liệu qua API.
Tài khoản demo trực tuyến và mật khẩu công khai được ghi tại [README](../../README.md#chọn-vai-trò-để-trải-nghiệm). Tài khoản trên máy cá nhân được tạo riêng khi thiết lập môi trường; mật khẩu của chúng không đưa lên Git.

## Một hành trình điều tra

| Bước | Thao tác | Kết quả cần quan sát |
|---|---|---|
| 1. Tìm dấu vết | Vào Sự kiện, chọn nhóm làm việc, nguồn log và khoảng thời gian của bộ dữ liệu đang dùng, tìm yêu cầu thất bại | Xem được mã yêu cầu, nguồn, hành động, thời gian và thông tin bản ghi gốc; không ghép yêu cầu chỉ vì cùng tên người dùng |
| 2. Tái dựng | Chọn sự kiện gốc, chọn đủ nguồn tiếp nhận yêu cầu (intake), tạo tài khoản (account), cấp môi trường (provision), rồi tạo một lần dựng hành trình (run) | Lần dựng lưu cố định bộ log đã dùng. Mỗi liên kết có căn cứ; bản ghi thiếu hoặc mâu thuẫn mã liên kết được đánh dấu chưa xác định |
| 3. Đối chiếu | Mở liên kết và bản ghi. Nếu dùng chế độ kết hợp quy tắc và AI (hybrid), xem điểm chấm cùng lý do và điều kiện liên kết | AI chỉ chấm các cặp đã qua điều kiện kiểm tra; điểm cao chưa chứng minh hai bản ghi thuộc cùng yêu cầu |
| 4. Mở hồ sơ | Tạo hoặc mở hồ sơ (case) gắn với hành trình vừa dựng, bổ sung ghi chú và bằng chứng | Có trạng thái, người phụ trách, số phiên bản và lịch sử. Máy chủ kiểm lại quyền mỗi khi thao tác |
| 5. Sửa đúng điều kiện | Với hồ sơ mô phỏng, đọc lỗi RAM, bản cài hệ điều hành hoặc tài khoản; dùng tài khoản quản trị sửa điều kiện gây lỗi | Sửa điều kiện chưa chứng minh yêu cầu đã chạy thành công |
| 6. Chạy lại | Chạy lại đúng yêu cầu rồi chờ log mới được nhận vào hệ thống | Phân biệt kết quả nghiệp vụ với trạng thái giao log; chỉ thấy lỗi chuyển log không có nghĩa nghiệp vụ thất bại |
| 7. Kiểm chứng | Người kiểm duyệt lấy kết quả kiểm chứng mới (proof), đối chiếu đúng yêu cầu, lần thực thi và điều kiện hiện tại | Máy chủ kiểm bằng chứng có còn phù hợp trước khi cho đóng hồ sơ; bằng chứng thất bại cũ vẫn được giữ |

Tái dựng không cấp lại tài nguyên. Chạy lại trong môi trường mô phỏng tạo một lần thực thi mới. Sau đó cần lấy kết quả kiểm chứng riêng.
Nếu nhóm làm việc không có môi trường mô phỏng, chỉ thực hiện các bước điều tra, duyệt liên kết và xử lý hồ sơ mà nhóm đó hỗ trợ.

## Ba tình huống nên thử

| Tình huống | Giá trị minh họa | Kết quả mong đợi |
|---|---|---|
| Log cấp môi trường thiếu mã yêu cầu | Ghép dựa vào mã khác cùng loại, chẳng hạn mã tài khoản, khi có đủ căn cứ | Chỉ nối khi thỏa điều kiện; giữ nguồn gốc bản ghi |
| Hai tài khoản cùng mã yêu cầu | Không ép kết luận khi dữ liệu mơ hồ | Để trạng thái chưa xác định và chuyển người kiểm duyệt xem xét |
| Yêu cầu lỗi cả tài khoản và RAM | Sửa một nguyên nhân chưa giải quyết toàn bộ | Chạy lại vẫn phản ánh lỗi còn lại; đóng hồ sơ cần bằng chứng phù hợp sau khi đã xử lý |

Bộ dữ liệu giả có thông tin cách sinh và tình huống thử tại [simulator README](../../simulator/README.md).
Dùng thông tin của bộ dữ liệu hiện có để chọn đúng thời gian và nguồn được cấp quyền. Mã yêu cầu hoặc ngày trong bộ dữ liệu cũ trên máy chủ có thể đã khác.

## Tự tạo bộ dữ liệu thử

```sh
npm run sim:generate
# Chỉ khi cần ghi file: chọn thư mục output mới, chưa có bộ dữ liệu tương ứng.
npm run sim:generate -- --seed=profile-demo --base-time=2026-10-31T01:00:00Z --count=36 --out=.local/simulator/profile-demo
```

`observable.json` chứa bản ghi, còn `deliveries.json` mô tả thứ tự gửi để thử chức năng nhận log. `oracle.json` là đáp án phục vụ đánh giá; không gửi file này vào dịch vụ AI hoặc chương trình đang xử lý dữ liệu.
Việc gửi dữ liệu lên máy chủ và tạo hồ sơ làm thay đổi dữ liệu trong nhóm làm việc được chọn; thực hiện theo [hướng dẫn simulator](../../simulator/README.md#nạp-qua-api) trên nhóm làm việc demo của bạn.

Theo dõi bằng chứng tính năng tại [FEATURE_STATUS](../overview/features.md), cách kiểm tại [TESTING](../../TESTING.md) và lỗi thường gặp tại [SUPPORT](../../SUPPORT.md).
