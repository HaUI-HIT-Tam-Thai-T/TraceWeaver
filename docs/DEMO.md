# Khám phá TraceWeaver

Mục tiêu: từ một log cấp môi trường thất bại, dựng lại hành trình, mở hồ sơ, sửa điều kiện trong sandbox và kiểm chứng kết quả.
Mỗi bước có kết quả cần quan sát để người mới tự đối chiếu.

## Chọn cách bắt đầu

| Mục đích | Điểm bắt đầu | Điều kiện |
|---|---|---|
| Hiểu dữ liệu, chưa cần chạy dịch vụ | `npm run sim:generate` tại root | Node 24; chỉ in manifest, không ghi DB/file |
| Chạy API local và Swagger | [INSTALL](../INSTALL.md), [Keycloak bootstrap](../backend/KEYCLOAK.md) | PostgreSQL, SSO và demo grants |
| Thử giao diện | [Frontend setup](../INSTALL.md#4-frontend) | API/Identity HTTPS và tài khoản được cấp; web dev tại localhost:5173 |
| Thử sửa lỗi và đóng hồ sơ | [Sandbox guide](../backend/LAB_SANDBOX.md) | Sandbox đã cấu hình, collector và quyền operator/reviewer/admin phù hợp |

API demo được cấu hình trong mẫu FE tại `https://api.quizlearn.tech`; Swagger tại [API docs](https://api.quizlearn.tech/docs/).
Đây là địa chỉ deployment được tài liệu dự án ghi nhận, không phải cam kết uptime hoặc quyền truy cập công khai cho mọi API.
Tài khoản demo local được sinh theo bootstrap; mật khẩu nằm ngoài Git. Hướng dẫn này không cung cấp mật khẩu dùng chung.

## Một hành trình điều tra

| Bước | Thao tác | Kết quả cần quan sát |
|---|---|---|
| 1. Tìm dấu vết | Vào Sự kiện, chọn workspace/nguồn/thời gian của dataset đang dùng, tìm request thất bại | Có request ID, source, action, timestamp và provenance; không suy từ tên người dùng |
| 2. Tái dựng | Chọn sự kiện gốc, chọn đủ intake/account/provision và tạo run | Snapshot cố định, đồ thị có bằng chứng; luật giữ unresolved khi thiếu/mâu thuẫn ID |
| 3. Đối chiếu | Mở cạnh và sự kiện; nếu bật hybrid, xem điểm scorer cùng lý do/guard | AI chỉ bổ sung thông tin cho cặp đủ điều kiện; không tự biến điểm cao thành bằng chứng |
| 4. Mở hồ sơ | Tạo hoặc mở case gắn run, bổ sung ghi chú và bằng chứng | Có trạng thái, người phụ trách, version và lịch sử; quyền được backend kiểm lại |
| 5. Sửa đúng điều kiện | Với case sandbox, đọc lỗi RAM/image/account; dùng admin sửa điều kiện liên quan | Thay đổi điều kiện chưa được coi là request đã chạy đạt |
| 6. Chạy lại | Chạy lại đúng request rồi chờ log mới được chuyển qua ingestion | Phân biệt kết quả nghiệp vụ với trạng thái giao log; chỉ thấy lỗi chuyển log không có nghĩa nghiệp vụ thất bại |
| 7. Kiểm chứng | Reviewer yêu cầu proof mới và đối chiếu request/attempt/điều kiện hiện tại | Backend quyết định proof còn phù hợp và cho phép đóng; giữ nguyên bằng chứng thất bại cũ |

Tái dựng không cấp lại tài nguyên. Chạy lại sandbox tạo lần thực thi mới; proof là bước xác minh riêng.
Nếu workspace không cấu hình sandbox, dùng các bước điều tra/review/hồ sơ mà module đó hỗ trợ.

## Ba tình huống nên thử

| Tình huống | Giá trị minh họa | Kết quả mong đợi |
|---|---|---|
| Log provision thiếu request ID | Tái dựng từ ID namespace khác có bằng chứng | Chỉ nối khi guard cho phép, giữ provenance |
| Hai tài khoản cùng request ID | Không ép kết luận khi dữ liệu mơ hồ | Giữ unresolved/abstention và đưa cho reviewer |
| Request lỗi cả tài khoản và RAM | Sửa một nguyên nhân chưa giải quyết toàn bộ | Chạy lại vẫn phản ánh lỗi còn lại; đóng case cần proof phù hợp sau khi đã xử lý |

Dataset synthetic có manifest và các scenario tại [simulator README](../simulator/README.md).
Không dựa vào ngày/ID của dataset server cũ: dùng manifest của bộ hiện có, chọn đúng time window và nguồn được cấp quyền.

## Tự sinh dataset

```sh
npm run sim:generate
# Chỉ khi cần ghi file: chọn thư mục output mới, chưa có bộ dữ liệu tương ứng.
npm run sim:generate -- --seed=profile-demo --base-time=2026-10-31T01:00:00Z --count=36 --out=.local/simulator/profile-demo
```

`observable.json` và `deliveries.json` phục vụ ingestion; `oracle.json` là đáp án đánh giá, không gửi vào scorer/runtime.
Việc upload và tạo case làm thay đổi dữ liệu trong workspace được chọn; thực hiện theo [hướng dẫn simulator](../simulator/README.md#nạp-qua-api) trên workspace demo của bạn.

Theo dõi bằng chứng tính năng tại [FEATURE_STATUS](FEATURE_STATUS.md), cách kiểm tại [TESTING](../TESTING.md) và lỗi thường gặp tại [SUPPORT](../SUPPORT.md).
