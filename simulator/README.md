# Simulator TraceWeaver

Thư mục này có hai phần dùng chung ba nguồn intake, account và provision:

- **Mô phỏng nghiệp vụ có trạng thái:** kiểm tra RAM, image và tài khoản; sửa điều kiện rồi chạy lại để sinh bằng chứng mới.
- **Sinh dữ liệu kiểm thử:** tạo log tổng hợp cho ingestion, tái dựng hành trình và demo. Dữ liệu sinh sẵn không thay thế kết quả chạy lại nghiệp vụ.

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
| Nghiệp vụ RAM/image/tài khoản | [lab-state.mjs](lab-state.mjs) | BE gọi trong giao dịch; không chạy trực tiếp bằng CLI sinh log |
| API, quyền, version và lưu trạng thái | [lab-repository.js](../backend/src/core/data/lab-repository.js), bảng `core.lab_sandboxes` | Đọc/sửa/chạy lại qua API sandbox |
| Log mới và chuyển sang ingestion | [lab-collector.js](../backend/src/core/data/lab-collector.js), bảng `core.lab_outbox` | Collector dùng `LAB_INGEST_SUBJECT` khi đã cấu hình |
| Gắn hồ sơ và lưu kiểm chứng | [case-verification.js](../backend/src/core/data/case-verification.js), bảng `core.case_verifications` | Reviewer kiểm tra bằng chứng nguồn trước khi đóng |
| Dataset sinh bằng CLI | Thư mục chỉ định bằng `--out`, ví dụ `.local/simulator/demo-01` | Chỉ ghi JSON khi có `--out`; không có thư mục output mặc định; không commit dữ liệu chạy thử |
| Kiểm thử giao dịch và HTTP với PostgreSQL | [lab.test.js](../backend/tests/integration/lab.test.js) | Dùng DB test riêng, không phải DB demo |

Contract, phân quyền, cách cấu hình và ví dụ sửa/chạy lại theo hồ sơ nằm trong
[hướng dẫn sandbox của BE](../backend/LAB_SANDBOX.md).
Mô tả dataset demo phía dưới không xác nhận API sandbox mới đã được triển khai lên server.

## Bộ sinh log tổng hợp

Sinh dữ liệu tổng hợp cho TraceWeaver bằng Node.js có sẵn, không thêm dependency.
Mặc định có **36 yêu cầu / 111 sự kiện duy nhất**, thuộc ba nguồn intake, account và provision.
Mọi tài khoản, sinh viên, máy và địa chỉ mạng trong log đều là dữ liệu giả.

## Bộ test đã nạp trên server — 29/10/2026

Dataset: `LAB-SIM-20261029-9757`, workspace demo `10000000-0000-4000-8000-000000000015`.
Trên FE, tìm `SIM-261029-9757` để xem bộ mới. Thời gian sự kiện từ **08:00 đến khoảng 15:03 ngày 29/10/2026, UTC+7**.
36 yêu cầu chia thành ba vòng của 12 tình huống dưới đây. 12 yêu cầu đầu có sẵn kết quả luật/AI và hồ sơ mẫu.

| Đuôi mã yêu cầu | Tình huống | Kết quả cần quan sát |
|---|---|---|
| `001` | Thành công | 3 sự kiện, 2 liên kết; hybrid có điểm model |
| `002` | Hết RAM cụm lab | Cấp môi trường thất bại nhưng hành trình vẫn nối được |
| `003` | Tải image quá thời gian | Có lỗi `IMAGE_PULL_TIMEOUT` và thông tin image |
| `004` | Không cấp được địa chỉ mạng | Có lỗi `NETWORK_ALLOCATION_FAILED` |
| `005` | Log cấp máy thiếu request ID | Vẫn nối được qua account ID; hybrid có điểm |
| `006` | Thiếu log provision | 2 sự kiện, 1 liên kết; bước provision chưa có bằng chứng |
| `007` | Thử lại sau lỗi mạng | 4 sự kiện, 3 liên kết; giữ cả lần thất bại và thành công |
| `008` | Log tài khoản đến muộn | Tài khoản được nhận sau provision; thời gian nghiệp vụ vẫn đúng thứ tự |
| `009` | Collector gửi trùng | API ghi nhận duplicate; chỉ có 3 sự kiện duy nhất |
| `010` | Cùng ID nhưng khác nội dung | API từ chối SOURCE_EVENT_CONFLICT, giữ bản gốc |
| `011` | Hai tài khoản cùng request ID | Không tự chọn nhánh; 3 sự kiện unresolved, có abstentions |
| `012` | Thiếu mã liên kết | 2 sự kiện unresolved; AI không được gọi vì không có cặp đủ điều kiện |

Ví dụ mã đầy đủ: **`SIM-261029-9757-001`**. Các vòng sau có đuôi `013–024` và `025–036`.

## Thử trên giao diện

1. Tải lại FE, chọn workspace demo.
2. Vào **Sự kiện**, tìm `SIM-261029-9757-001`, mở **Đã tiếp nhận yêu cầu**.
3. Chọn cả ba nguồn. Khoảng mặc định quanh sự kiện phù hợp vì các yêu cầu cách nhau 12 phút.
4. Chọn **Kết hợp luật và AI**, bấm **Bắt đầu tái dựng**.
5. Kiểm tra ba sự kiện, hai liên kết và điểm AI. Điểm hỗ trợ đánh giá, không thay bằng chứng.
6. Thử `005`, `007`, rồi `011` và `012` để thấy sự khác biệt giữa có thể nối và cần giữ chưa xác định.
7. Vào **Hồ sơ**, tìm cùng mã yêu cầu. Có hồ sơ ở các trạng thái mới, đã phân công, đang điều tra và chờ xác minh.
   Đọc ghi chú, duyệt liên kết, bổ sung bằng chứng và chuyển trạng thái theo quyền đang có.

## Sinh lại bộ dữ liệu

Chạy tại root repository:

```powershell
npm.cmd run test:sim
npm.cmd run sim:generate
npm.cmd run sim:generate -- --seed=traceweaver-realistic-v3 --base-time=2026-10-29T01:00:00Z --count=36 --out=.local/simulator/my-test
```

Cùng seed, base-time và count tạo cùng dữ liệu. Đổi seed tạo namespace ID khác.
`npm run sim:generate` không có `--out` chỉ in manifest ra terminal, không lưu các file JSON.
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

Cần token của client ingest, active membership, role ingest_service và ingest grants cho cả ba nguồn.
Token người dùng operator không thay thế token ingest. Các giá trị dưới đây do môi trường cung cấp:

```powershell
$env:SIMULATOR_INGEST_TOKEN = '<access token ingest>'
$env:SIMULATOR_SOURCE_IDS = '{"intake":"<UUID>","account":"<UUID>","provision":"<UUID>"}'
npm.cmd run sim:generate -- --apply --api=https://api.quizlearn.tech --workspace=YOUR_WORKSPACE_UUID
```

Mỗi lần gửi chứa một sự kiện, nhỏ hơn giới hạn 500 bản ghi / 1 MiB, để giữ chính xác thứ tự delivery.
Nạp lại cùng bộ trả duplicate, không tạo lại sự kiện. Bản ghi cố ý xung đột phải tiếp tục bị từ chối.
Nếu mạng lỗi, công cụ dừng; có thể chạy lại để tiếp tục nhờ dedup của BE.
CLI không xóa/reset DB.

`prepare-demo.mjs` cung cấp helper tạo run bằng luật/hybrid và hồ sơ mẫu qua API user với idempotency keys.
Helper dùng runtime AI thật của API, không gọi repository với scorer mặc định.
Tình huống mơ hồ/thiếu ID chủ động giữ unresolved; không ép AI kết luận.

Đây là bộ kiểm thử chức năng tổng hợp. Kết quả trên bộ này không chứng minh chất lượng model trên dữ liệu thực.
Khi triển khai cần seed, manifest, parser/source version và tách oracle khỏi observable.
Không cấp tài nguyên thật hoặc dùng credential/dữ liệu cá nhân thật.

Vocabulary backend hiện tại: intake/request.accepted → account/account.created → provision/provision.completed|provision.failed. Map request/account/job IDs sang `{namespace,value}`; không dùng tên action giả định khác trong handoff mà chưa version policy. Ingest hiện nhận EventInput chuẩn hóa, chưa parse raw logs; timestamp phải biểu diễn chính xác tới microsecond, không tự cắt/làm tròn. Xem [tích hợp](../docs/INTEGRATION.md).
