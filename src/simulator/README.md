# Simulator

Khung sinh dữ liệu giả cho yêu cầu cấp môi trường thực hành; chưa có generator chạy được.

- `sources/`: ba nguồn intake, account và provision.
- `scenarios/`: hành trình bình thường, lỗi, trễ, trùng và mơ hồ.
- `fixtures/`: observable events synthetic dùng cho demo/test.
- `tests/`: kiểm tính tái lập, provenance và schema.

Khi triển khai cần seed, manifest, parser/source version và tách oracle khỏi observable.
Không cấp tài nguyên thật hoặc dùng credential/dữ liệu cá nhân thật.
