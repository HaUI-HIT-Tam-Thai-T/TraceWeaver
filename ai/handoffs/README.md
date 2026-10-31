# Các gói bàn giao AI

Các gói bàn giao AI được lưu theo phiên bản trong thư mục này và đi cùng mã nguồn khi phát hành. Giữ nguyên nội dung gói gốc để đối chiếu mã băm và nguồn gốc do bên gửi cung cấp.

`AI_BE_RUNTIME_V2/` là toàn bộ gói sandbox-v2 đã nhận: mã nguồn, thư viện, mô hình, bản kê file/kết quả đánh giá, 23 cặp mẫu HTTP và 42 mẫu đặc trưng. Xem [README gốc](AI_BE_RUNTIME_V2/README.md) và [bản kê của gói](AI_BE_RUNTIME_V2/bundle-manifest.json). README bên trong gói được giữ nguyên ngôn ngữ khi bàn giao để đối chiếu, không phải hướng dẫn sử dụng tiếng Việt hiện hành.

Chương trình đang tích hợp được sửa tại `ai/app/`, mô hình tại `ai/artifacts/`, đặc trưng tại `ai/features/` và kiểm thử tại `ai/tests/`. Khi đổi cách ứng dụng hoạt động, sửa các thư mục này; không sửa bản bàn giao đã lưu. Thông tin đăng nhập trên máy, môi trường Python, log và kết quả kiểm tra riêng nằm ngoài thư mục gói được quản lý trong Git này.
