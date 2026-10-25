# Simulator

Khung sinh dữ liệu giả cho yêu cầu cấp môi trường thực hành; chưa có generator chạy được.

- `sources/`: ba nguồn intake, account và provision.
- `scenarios/`: hành trình bình thường, lỗi, trễ, trùng và mơ hồ.
- `fixtures/`: observable events synthetic dùng cho demo/test.
- `tests/`: kiểm tính tái lập, provenance và schema.

Khi triển khai cần seed, manifest, parser/source version và tách oracle khỏi observable.
Không cấp tài nguyên thật hoặc dùng credential/dữ liệu cá nhân thật.

Vocabulary backend hiện tại: intake/request.accepted → account/account.created → provision/provision.completed|provision.failed. Map request/account/job IDs sang `{namespace,value}`; không dùng tên action giả định khác trong handoff mà chưa version policy. Ingest hiện nhận EventInput chuẩn hóa, chưa parse raw logs; timestamp phải biểu diễn chính xác tới microsecond, không tự cắt/làm tròn. Xem [tích hợp](../docs/02-TICH-HOP-BE-FE-AI.md).
