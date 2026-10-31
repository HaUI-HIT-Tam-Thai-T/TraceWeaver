# Tài liệu TraceWeaver

TraceWeaver hỗ trợ điều tra sự cố từ nhật ký hoạt động (log) của nhiều dịch vụ, xử lý hồ sơ và kiểm chứng kết quả khắc phục. Đây là điểm bắt đầu cho người dùng, người phát triển và người đánh giá bài dự thi.

[Giới thiệu dự án](../README.md) · [English](../README_EN.md) · [Web trực tuyến](https://traceweaver.quizlearn.tech) · [Swagger API](https://api.quizlearn.tech/docs/)

## Bạn muốn làm gì?

| Nhu cầu | Bắt đầu tại đây |
|---|---|
| Hiểu sản phẩm, phạm vi và bản đang chạy | [Tổng quan](overview/README.md) |
| Thử một hành trình điều tra | [Demo có hướng dẫn](guides/demo.md) |
| Cài đặt, vận hành hoặc phát hành | [Hướng dẫn](guides/README.md) |
| Tra kiến trúc, API, dữ liệu, quy trình xử lý hoặc AI | [Tham chiếu kỹ thuật](reference/README.md) |
| Kết nối giao diện, môi trường mô phỏng và quản trị nhóm làm việc | [Tích hợp](integration/README.md) |
| Kiểm chứng tính năng hoặc chuẩn bị hồ sơ dự thi | [Ma trận tính năng](overview/features.md), [Hồ sơ dự thi](competition/README.md) |
| Tìm quyết định và bàn giao theo mốc cũ | [Lưu trữ](archive/README.md) |

## Cấu trúc thư mục

```text
docs/
├── README.md           # Mục lục và quy ước tài liệu
├── overview/           # Sản phẩm, hiện trạng và ma trận tính năng
├── guides/             # Demo, vận hành, license và phát hành
├── reference/          # Điểm tra cứu tài liệu kỹ thuật cạnh source
├── integration/        # Luồng FE, sandbox, quản trị và ví dụ API
├── competition/        # Đối chiếu đề, bằng chứng và hồ sơ nộp
└── archive/            # Kế hoạch và bàn giao lịch sử
```

Mỗi thư mục có `README.md` làm mục lục. Tên thư mục và tệp dùng tiếng Anh, chữ thường và dấu gạch nối; nội dung hướng dẫn chủ yếu bằng tiếng Việt. Ngày và mã phiên bản hoặc commit nằm trong nội dung khi cần xác định phạm vi.

## Nguồn thông tin chính

- **Quy định API:** [OpenAPI và schemas](../backend/contracts/README.md). Ví dụ trong bản bàn giao có ngày mô tả dữ liệu tại thời điểm đó. Khi viết chương trình kết nối, đối chiếu tên trường và định dạng dữ liệu trong OpenAPI.
- **Triển khai và kết quả xác minh:** [Hiện trạng](overview/status.md). Mã nguồn hoặc bài kiểm tra có trong repo chưa chứng minh chức năng đã chạy trên máy chủ hay đã được kiểm tra thành công.
- **Kỹ thuật từng thành phần:** [Backend](../backend/README.md), [Frontend](../frontend/README.md), [AI](../ai/README.md), [Simulator](../simulator/README.md). Tài liệu chi tiết giữ cạnh mã nguồn và được dẫn từ [reference](reference/README.md).
- **Cách kiểm thử:** [TESTING](../TESTING.md); bằng chứng theo tính năng ở [features](overview/features.md).
- **Cài đặt:** [INSTALL](../INSTALL.md); **kiến trúc:** [ARCHITECTURE](../ARCHITECTURE.md).

## Quy ước cập nhật

1. Đặt tài liệu vào nhóm phù hợp và thêm liên kết trong mục lục của nhóm; dùng liên kết tương đối trong repository.
2. Khi đổi tên hoặc di chuyển tệp, sửa cả liên kết đi vào và liên kết bên trong tệp. Không giữ nhiều bản nội dung giống nhau để làm đường dẫn thay thế.
3. Ghi rõ ngày, phiên bản hoặc commit và môi trường khi mô tả kết quả; giữ lịch sử nhưng đánh dấu phạm vi cũ. Đưa kế hoạch đã bị thay thế vào `archive/`.
4. Không đưa thông tin bí mật, `.env`, khóa riêng, dữ liệu thật, bộ nhớ đệm hoặc báo cáo thao tác riêng vào tài liệu công khai. Dùng `.local/` cho tài liệu làm việc riêng trên máy.
5. `.planning/` phục vụ trạng thái làm việc trên máy cá nhân. Gói AI có mã băm để kiểm tra nội dung trong `ai/handoffs/` được giữ nguyên, không dời vào docs.

## Đóng góp và liên hệ

[Đóng góp](../CONTRIBUTING.md) · [Quy tắc ứng xử](../CODE_OF_CONDUCT.md) · [Bảo mật](../SECURITY.md) · [Hỗ trợ](../SUPPORT.md) · [Giấy phép](../LICENSES.md) · [SBOM](../sbom/README.md)

## Tham khảo cách tổ chức

[SmartCity-Platform](https://github.com/Haui-HIT-H2K/SmartCity-Platform/tree/main/docs) gợi ý phân nhóm tổng quan và thành phần kỹ thuật; [DX-OS](https://github.com/HaUI-ImplSolution/DX-OS) gợi ý các điểm vào hướng dẫn, kiểm thử và minh họa. TraceWeaver áp dụng cách phân nhóm cho tài liệu của mình, giữ nguyên kiến trúc và nội dung sản phẩm.
