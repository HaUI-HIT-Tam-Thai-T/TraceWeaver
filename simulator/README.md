# Bộ mô phỏng TraceWeaver

Thư mục này mô phỏng ba bước: tiếp nhận yêu cầu (intake), tạo tài khoản (account) và cấp môi trường (provision). Có hai cách dùng:

- **Mô phỏng nghiệp vụ có trạng thái:** kiểm tra RAM, bản cài hệ điều hành (image) và tài khoản; sửa điều kiện rồi chạy lại để sinh bằng chứng mới.
- **Sinh dữ liệu kiểm thử:** tạo nhật ký giả để thử nhận log, dựng hành trình và trình diễn. Dữ liệu sinh sẵn không thay thế kết quả chạy lại nghiệp vụ.

## Cấu trúc mã nguồn

```text
simulator/
├── README.md                  # Hướng dẫn cấu trúc, sinh dữ liệu và demo
├── lab-state.mjs              # Logic thuần: điều kiện, sửa, chạy lại, lịch sử và kiểm tra kết quả
├── generate.mjs               # Sinh sự kiện ba nguồn, delivery, scenario và oracle riêng
├── upload.mjs                 # Gửi observable/delivery qua API ingestion, kiểm tra duplicate/conflict
├── prepare-demo.mjs           # Helper tạo run và hồ sơ mẫu qua API
├── cli.mjs                    # Điểm vào lệnh npm run sim:generate
└── tests/
    ├── lab-state.test.mjs     # Lỗi kết hợp, sửa sai, replay, tài nguyên và bằng chứng
    ├── generate.test.mjs      # Tính tái lập, schema, thứ tự gửi và tách oracle
    └── upload.test.mjs        # Gửi dữ liệu, chống trùng và giới hạn HTTP
```

Các thư mục khung `sources/`, `scenarios/`, `fixtures/` không được chương trình sử dụng nên đã bỏ.
Ba nguồn và các tình huống sinh log được định nghĩa trong `generate.mjs`; không có ba dịch vụ độc lập
hay trình thiết kế kịch bản tổng quát cần khởi động riêng.

## Phần nào chạy ở đâu?

| Phần | Mã nguồn / nơi lưu | Cách sử dụng |
|---|---|---|
| Nghiệp vụ RAM/image/tài khoản | [lab-state.mjs](lab-state.mjs) | Máy chủ gọi trong giao dịch dữ liệu; không chạy trực tiếp bằng công cụ dòng lệnh sinh log |
| API, quyền, phiên bản và lưu trạng thái | [lab-repository.js](../backend/src/core/data/lab-repository.js), bảng `core.lab_sandboxes` | Đọc, sửa và chạy lại qua API môi trường mô phỏng |
| Tạo và chuyển log mới vào hệ thống | [lab-collector.js](../backend/src/core/data/lab-collector.js), bảng `core.lab_outbox` | Bộ chuyển log dùng `LAB_INGEST_SUBJECT` khi đã cấu hình |
| Gắn hồ sơ và lưu kiểm chứng | [case-verification.js](../backend/src/core/data/case-verification.js), bảng `core.case_verifications` | Người kiểm duyệt kiểm tra bằng chứng nguồn trước khi đóng |
| Bộ dữ liệu do công cụ dòng lệnh tạo | Thư mục chỉ định bằng `--out`, ví dụ `.local/simulator/demo-01` | Chỉ ghi JSON khi có `--out`; không có thư mục đầu ra mặc định; không commit dữ liệu chạy thử |
| Kiểm thử giao dịch và HTTP với PostgreSQL | [lab.test.js](../backend/tests/integration/lab.test.js) | Dùng cơ sở dữ liệu kiểm thử riêng, không dùng dữ liệu demo |

Quy định dữ liệu trao đổi, phân quyền và cách cấu hình và ví dụ sửa/chạy lại theo hồ sơ nằm trong
[hướng dẫn sandbox của BE](../backend/LAB_SANDBOX.md).
Các dữ liệu demo bên dưới thuộc mốc riêng; chúng không chứng minh API môi trường mô phỏng mới đã chạy trên máy chủ.

## Bộ sinh log tổng hợp

Sinh dữ liệu tổng hợp cho TraceWeaver bằng Node.js có sẵn, không cần thêm thư viện.
Mặc định có **36 yêu cầu / 111 sự kiện duy nhất**, thuộc ba nguồn intake, account và provision.
Mọi tài khoản, sinh viên, máy và địa chỉ mạng trong log đều là dữ liệu giả.

## Bộ dữ liệu thử đã nạp trên máy chủ — 29/10/2026

Bộ dữ liệu: `LAB-SIM-20261029-9757`, nhóm làm việc demo `10000000-0000-4000-8000-000000000015`.
Trên giao diện, tìm `SIM-261029-9757` để xem bộ mới. Thời gian sự kiện từ **08:00 đến khoảng 15:03 ngày 29/10/2026, UTC+7**.
36 yêu cầu chia thành ba vòng của 12 tình huống dưới đây. 12 yêu cầu đầu có sẵn kết quả luật/AI và hồ sơ mẫu.

| Đuôi mã yêu cầu | Tình huống | Kết quả cần quan sát |
|---|---|---|
| `001` | Thành công | 3 sự kiện, 2 liên kết; chế độ kết hợp quy tắc/AI có điểm mô hình |
| `002` | Hết RAM cụm lab | Cấp môi trường thất bại nhưng hành trình vẫn nối được |
| `003` | Tải image quá thời gian | Có lỗi `IMAGE_PULL_TIMEOUT` và thông tin bản cài hệ điều hành |
| `004` | Không cấp được địa chỉ mạng | Có lỗi `NETWORK_ALLOCATION_FAILED` |
| `005` | Log cấp máy thiếu request ID | Vẫn nối được qua mã tài khoản; chế độ kết hợp quy tắc/AI có điểm |
| `006` | Thiếu log provision | 2 sự kiện, 1 liên kết; bước provision chưa có bằng chứng |
| `007` | Thử lại sau lỗi mạng | 4 sự kiện, 3 liên kết; giữ cả lần thất bại và thành công |
| `008` | Log tài khoản đến muộn | Tài khoản được nhận sau provision; thời gian nghiệp vụ vẫn đúng thứ tự |
| `009` | Bộ chuyển log gửi trùng | API ghi nhận duplicate; chỉ có 3 sự kiện duy nhất |
| `010` | Cùng ID nhưng khác nội dung | API từ chối SOURCE_EVENT_CONFLICT, giữ bản gốc |
| `011` | Hai tài khoản cùng request ID | Không tự chọn nhánh; 3 bản ghi chưa xác định, có lý do chưa kết luận |
| `012` | Thiếu mã liên kết | 2 bản ghi chưa xác định; AI không được gọi vì không có cặp đủ điều kiện |

Ví dụ mã đầy đủ: **`SIM-261029-9757-001`**. Các vòng sau có đuôi `013–024` và `025–036`.

## Thử trên giao diện

1. Tải lại FE, chọn nhóm làm việc demo.
2. Vào **Sự kiện**, tìm `SIM-261029-9757-001`, mở **Đã tiếp nhận yêu cầu**.
3. Chọn cả ba nguồn. Khoảng mặc định quanh sự kiện phù hợp vì các yêu cầu cách nhau 12 phút.
4. Chọn **Kết hợp luật và AI**, bấm **Bắt đầu tái dựng**.
5. Kiểm tra ba sự kiện, hai liên kết và điểm AI. Điểm hỗ trợ đánh giá, không thay bằng chứng.
6. Thử `005`, `007`, rồi `011` và `012` để thấy sự khác biệt giữa có thể nối và cần giữ chưa xác định.
7. Vào **Hồ sơ**, tìm cùng mã yêu cầu. Có hồ sơ ở các trạng thái mới, đã phân công, đang điều tra và chờ xác minh.
   Đọc ghi chú, duyệt liên kết, bổ sung bằng chứng và chuyển trạng thái theo quyền đang có.

## Tạo bộ dữ liệu trên máy cá nhân

Chạy tại root repository:

```powershell
npm.cmd run test:sim
npm.cmd run sim:generate
npm.cmd run sim:generate -- --seed=traceweaver-realistic-v3 --base-time=2026-10-29T01:00:00Z --count=36 --out=.local/simulator/my-test
```

Dùng cùng giá trị khởi tạo (seed), thời gian bắt đầu (base-time) và số yêu cầu (count) sẽ tạo cùng dữ liệu. Đổi seed tạo bộ mã định danh riêng để tránh trùng bộ cũ.
`npm run sim:generate` không có `--out` chỉ in thông tin bộ dữ liệu ra màn hình, không lưu các file JSON.
Để xuất bộ dữ liệu ra đĩa, chỉ định rõ thư mục, ví dụ:

```powershell
npm.cmd run sim:generate -- --out=.local/simulator/demo-01
```

Nếu thay giờ bắt đầu trong cùng ngày cho một bộ đã nạp, hãy dùng seed mới để không xung đột ID cũ.
Thư mục output phải chưa có các file tương ứng; công cụ không ghi đè bộ đã sinh.

- `observable.json`: sự kiện chuẩn hóa có thể nạp vào BE.
- `deliveries.json`: thứ tự gửi, gồm gửi trễ, trùng và xung đột để thử ingestion.
- `scenarios.json`: hướng dẫn từng yêu cầu, root và cửa sổ thời gian.
- `oracle.json`: đáp án nhân quả riêng để đối chiếu, **không gửi vào ingestion hoặc scorer**.
- `manifest.json`: seed, phiên bản, số lượng và thời điểm gốc.

## Nạp qua API

Cần token của client ingest, tư cách thành viên đang hoạt động, vai trò ingest_service và quyền gửi log cho cả ba nguồn.
Mã truy cập người vận hành không thay mã dịch vụ nhận log. Các giá trị dưới đây do môi trường cung cấp:

```powershell
$env:SIMULATOR_INGEST_TOKEN = '<access token ingest>'
$env:SIMULATOR_SOURCE_IDS = '{"intake":"<UUID>","account":"<UUID>","provision":"<UUID>"}'
npm.cmd run sim:generate -- --apply --api=https://api.quizlearn.tech --workspace=YOUR_WORKSPACE_UUID
```

Mỗi lần gửi chứa một sự kiện, nhỏ hơn giới hạn 500 bản ghi / 1 MiB, để giữ đúng thứ tự gửi.
Nạp lại cùng bộ báo trùng (duplicate), không tạo lại sự kiện. Bản ghi cố ý xung đột phải tiếp tục bị từ chối.
Nếu mạng lỗi, công cụ dừng; có thể chạy lại để tiếp tục nhờ cơ chế chống trùng trên máy chủ.
Công cụ dòng lệnh không xóa hoặc đặt lại cơ sở dữ liệu.

`prepare-demo.mjs` cung cấp hàm hỗ trợ tạo lần dựng hành trình bằng quy tắc hoặc chế độ kết hợp quy tắc/AI và hồ sơ mẫu qua API người dùng với khóa chống thực hiện trùng.
Hàm hỗ trợ dùng dịch vụ AI thật của API, không gọi lớp đọc/ghi dữ liệu với bộ chấm điểm mặc định.
Tình huống mơ hồ/thiếu ID giữ trạng thái chưa xác định; không ép AI kết luận.

Đây là bộ kiểm thử chức năng tổng hợp. Kết quả trên bộ này không chứng minh chất lượng mô hình trên dữ liệu thực.
Khi triển khai, giữ giá trị khởi tạo, bản kê dữ liệu và phiên bản bộ đọc/nguồn log. Tách đáp án đánh giá (oracle) khỏi bản ghi ứng dụng được phép quan sát (observable).
Không dùng bộ mô phỏng để cấp tài nguyên thật; chỉ dùng thông tin đăng nhập và dữ liệu cá nhân giả.

Tên dịch vụ/hành động máy chủ đang dùng: intake/request.accepted → account/account.created → provision/provision.completed|provision.failed. Ánh xạ mã yêu cầu/tài khoản/tác vụ sang `{namespace,value}`; không tự dùng tên hành động khác trong gói bàn giao khi chưa tạo phiên bản quy tắc tương ứng. API nhận log hiện nhận EventInput đã chuẩn hóa, chưa đọc log thô; thời gian phải biểu diễn chính xác tới micro giây, không tự cắt/làm tròn. Xem [tích hợp](../docs/integration/README.md).

## Định dạng JavaScript bằng Prettier

Từ thư mục gốc, chạy `npm run format:sim` để định dạng mã nguồn và kiểm thử;
chạy `npm run format:sim:check` để chỉ kiểm tra. Cấu hình dùng 2 dấu cách, nháy đơn,
dấu chấm phẩy và độ dài dòng mục tiêu 100 ký tự. CI kiểm trên Windows/Linux.
Dữ liệu JSON, fixture và SQL migration được giữ nguyên.
