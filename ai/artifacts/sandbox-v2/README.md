# Mô hình sandbox v2 thử nghiệm

Mô hình được nhập nguyên vẹn từ gói `AI_BE_RUNTIME_V2/ai-be-runtime-v2` do người dùng cung cấp ngày 28/10/2026. Mã nguồn, mô hình và mẫu dữ liệu tự sinh dùng Apache-2.0; xem LICENSE/NOTICE của repo và ai/DEPENDENCIES.md / THIRD_PARTY_NOTICES.txt. Lần nhập này không thêm thư viện hoặc dữ liệu huấn luyện.

- Mô hình: `logistic-regression-sandbox-features-2-experiment-1`.
- SHA-256: `f06fc43f8784cb93e1d4b52b230e8ca7ec4fc846d9cd068a97a75f6145e76420`.
- Đặc trưng đầu vào: `sandbox-observable-features-2`; cấu trúc dữ liệu phiên bản `1`; chính sách huấn luyện `sandbox-rules-1`.
- Mã băm SHA-256 của bản kê gói: `0c6b9f83ee779bf54541c503cd877deec340524aed671287a9ab1583aab4b82f`.
- Mã phiên bản nguồn do bên gửi khai báo: `5a22086a0873034ce60920f600ba215a9a9a5f04`, thư mục làm việc còn thay đổi chưa commit. Các mã băm xác nhận nội dung đã nhận; chưa chứng minh có thể tái tạo việc huấn luyện từ một commit độc lập hoặc xác minh chữ ký.
- Bộ nạp đã nhập `ai/app/model_scorer.py` SHA-256: `209320adad103e27e9ee89d6829091e2c941741c486363ecee19859d7ab3f035`.
- 42 mẫu đặc trưng gốc nằm tại `backend/tests/fixtures/scorer-v2/features-v2.json`; 23 cặp yêu cầu/phản hồi gốc nằm tại `ai/tests/fixtures/scorer-v2/`.

Mô hình này chỉ được dùng khi chọn rõ trong cấu hình. Đặt `SCORER_MODE=model` và `SCORER_MODEL_PATH=ai/artifacts/sandbox-v2/model_sandbox_v2.json` để chọn mô hình. Xem [thiết lập máy chủ](../../../backend/SCORER.md).

Kết quả bên gửi báo cáo trên 288 cặp dữ liệu tự sinh: tỷ lệ dự đoán liên kết đúng (precision) 0.7273, tỷ lệ tìm được liên kết đúng (recall) 1.0 và F1 0.8421. F1, chỉ số tổng hợp precision và recall, bằng kết quả của quy tắc dùng hai cờ trên bộ thử này. Precision chưa đạt mục tiêu ít nhất 95% của dự án. Một số mẫu lặp lại giữa các phần chia dữ liệu; trọng số độ giống văn bản bằng 0. Ngưỡng 0.20 chỉ dùng khi đánh giá ngoại tuyến. Chưa chạy lại việc huấn luyện/đánh giá tại đây; bản kê và báo cáo là bằng chứng được bàn giao. Phần gọi mô hình qua HTTP và đối chiếu đặc trưng đã được kiểm độc lập.

Máy chủ giữ `sandbox-rules-2`: ba bước chuyển và các loại mã liên kết mạnh hiện có, kèm kiểm kết quả nghiệp vụ độc lập chặt hơn. Điểm AI chỉ bổ sung cho liên kết do quy tắc tạo, đã đủ điều kiện và đang chờ duyệt. Không dùng điểm để tự chọn nhánh mơ hồ hoặc tự chấp nhận liên kết. Chưa chứng minh tìm được thêm liên kết đúng và chưa phê duyệt mô hình cho dữ liệu thực tế.
