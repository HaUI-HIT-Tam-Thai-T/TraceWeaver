# Định nghĩa API của TraceWeaver

Tại mốc BE-34, mã nguồn đã xử lý 21/21 thao tác: 20 API Node công khai/lõi và một API Python nội bộ chấm điểm AI. `scorePairs` chạy trên máy chủ riêng chỉ nhận kết nối từ cùng máy, không dùng địa chỉ API Node. Cấu trúc dữ liệu phiên bản 1 với 5 đặc trưng đầu vào được giữ nguyên. Dịch vụ hỗ trợ chế độ cơ bản và mô hình v2 thử nghiệm chỉ dùng khi bật cấu hình; xem [hướng dẫn chấm điểm](../SCORER.md) về cấu hình, đối chiếu đặc trưng và giới hạn. Có mã xử lý chưa chứng minh đã triển khai hoặc mô hình đạt chất lượng. Danh sách cũ bên dưới được ghi trước khi nhập dịch vụ chấm điểm.

## Các file cần dùng

`openapi.json` mô tả API công khai, API lõi và dịch vụ chấm điểm. Danh sách trước lần nhập AI ghi nhận 21 thao tác, gồm 20 đã có mã xử lý và một thao tác chấm điểm còn dự kiến. Các nhóm khi đó gồm thông tin người dùng, nguồn, tri thức, bản ghi, nhận log theo đợt, dựng hành trình, sơ đồ, duyệt/thêm liên kết, năm API hồ sơ, thống kê và ba API quy trình lõi. Đây là ghi nhận theo mốc, không phải danh mục tự cập nhật.

Cấu hình và giới hạn từng nhóm nằm ở [xác thực](../IDENTITY.md), [nhận log](../INGESTION.md), [đọc bản ghi](../EVENTS.md), [dựng hành trình](../RECONSTRUCTION.md), [hồ sơ](../CASES.md), [thống kê](../DASHBOARD.md) và [quy trình lõi](../WORKFLOW.md). Kiểm trạng thái hoạt động dùng định nghĩa riêng `health.openapi.json`.

`schemas/domain.schema.json` dùng JSON Schema 2020-12 và là nơi định nghĩa duy nhất 49 kiểu dữ liệu tại mốc tài liệu này. OpenAPI tham chiếu các định nghĩa đó thay vì sao chép cấu trúc dữ liệu sang từng API. File dùng JSON để công cụ Node đọc trực tiếp, không cần bộ phân tích YAML riêng.

## Dùng và kiểm tra

Từ thư mục gốc chạy `npm run test:contracts`; `npm test` cũng chạy nhóm kiểm tra này. Swagger Parser kiểm OpenAPI và các tham chiếu, không tải định nghĩa từ mạng. Ajv kiểm nghiêm ngặt cấu trúc, mã UUID, thời gian, dữ liệu mẫu đúng/sai và điểm số hữu hạn. Chưa công bố không gian làm việc Postman hoặc API giả lập lên dịch vụ bên ngoài.

`fixtures/valid.json` liệt kê dữ liệu theo tên cấu trúc. `fixtures/invalid.json` ghi cấu trúc được kiểm, dữ liệu đầu vào và loại lỗi mong đợi. Đây là dữ liệu giả; điểm chỉ minh họa định dạng, không phải kết quả đo chất lượng AI. Không dùng mã UUID, mã phân trang hoặc thông tin đăng nhập mẫu làm dữ liệu thật.

Mã băm khi chạy được tính từ nội dung đã chuẩn hóa và che thông tin bí mật. Bỏ event_id/source_id/received_at/provenance, giữ parser_version, sắp xếp khóa đối tượng và giữ thứ tự phần tử mảng. Thời gian giữ chính xác tới micro giây; dữ liệu độ chính xác mili giây giữ mã băm cũ. Chữ số khác 0 vượt quá 6 chữ số thập phân sẽ bị từ chối. Xem [nhận log](../INGESTION.md).

## Những quy tắc cần giữ khi viết mã xử lý

- Đối tượng đầu vào không nhận trường ngoài định nghĩa. Riêng nội dung log được phép là đối tượng JSON linh hoạt. Máy chủ tạo event_id, received_at, provenance và parser_version; bên gửi không tự gán các giá trị đó.
- BatchRequest kiểm phần bao ngoài và số lượng bản ghi. Từng phần tử, kể cả giá trị không phải đối tượng, được kiểm riêng theo EventInput: bản ghi sai bị từ chối, bản ghi đúng vẫn được xử lý. HTTP chặn nội dung lớn hơn 1 MiB. Chương trình vẫn phải kiểm số lượng, vị trí bản ghi, mã băm và chống trùng.
- Mã truy cập người dùng, mã dịch vụ nhận log, thông tin đăng nhập ứng dụng lõi và khóa AI là những danh tính riêng. Thông tin người dùng truyền vào lõi phải đến từ bước đã kiểm mã truy cập, không lấy từ header actor mà bên gửi tự đặt. Định nghĩa dữ liệu không thay việc kiểm đăng nhập và quyền nguồn.
- Me trả subject (mã tài khoản) và memberships (các nhóm làm việc đã tham gia). roles/group_ids nằm trong từng tư cách thành viên. Giá trị vai trò nhận log trên API là `ingest_service`. Quản trị viên không tự có quyền đọc hoặc gửi log.
- Phân trang dùng `{items,next_cursor}`, mặc định 50 và tối đa 100 kết quả. Mã phân trang gắn với bộ lọc, phạm vi quyền và thứ tự. Bản ghi được đọc trên bộ dữ liệu cố định; hồ sơ được đọc theo trạng thái hiện tại và mã phân trang còn gắn với giới hạn kết quả. Bản ghi sắp theo occurred_at,event_id. Đổi bộ lọc hoặc phạm vi quyền khiến mã cũ trả 400.
- Idempotency-Key giúp gửi lại yêu cầu mà không thực hiện trùng. Trên POST tạo hành trình/hồ sơ/chuyển bước, lần đầu có thể bỏ khóa nhưng cần có khóa để thử lại an toàn. Phạm vi khóa là tài khoản, nhóm làm việc và đường dẫn, trong 24 giờ; đổi nội dung với cùng khóa trả 409. Nhận log dùng source_event_id lưu bền vững để chống trùng.
- Duyệt liên kết và chuyển bước bắt buộc expected_version cùng reason không trắng. Phân công bắt buộc owner_id. Chương trình phải kiểm thành viên, người phụ trách, bằng chứng, vai trò và hồ sơ đã đóng; JSON Schema không tự kiểm được các điều kiện nghiệp vụ đó.
- Thống kê và listCases dùng from/to theo UTC, có tính hai đầu khoảng, lọc thời điểm created_at của lần dựng gắn với hồ sơ. Mã phân trang hồ sơ gắn cả hai bộ lọc. Số chưa xác định đếm lượt bản ghi theo từng lần dựng, dùng sơ đồ mới nhất; số đang chờ gồm new/assigned. Chưa có API liệt kê mọi lần dựng trên toàn hệ thống.
- Chi tiết hồ sơ trả `{case,history,evidence}`. WorkflowInstance chứa state/version/history. Bằng chứng loại `events` cần event_ids không rỗng; loại `note` cần note không trắng. KnowledgeArticle bắt buộc source_ref dạng URI, cùng version/author.
- Mỗi lần chấm tối đa 100 cặp, đặc trưng dùng cấu trúc phiên bản `1`, điểm hữu hạn từ 0 đến 1. Bên gọi phải kiểm tập pair_id trả về khớp chính xác, phiên bản mô hình/cấu trúc tương thích, thời hạn và tình trạng dịch vụ suy giảm. JSON Schema không so được mã cặp trong yêu cầu với mã trong phản hồi.
- Cần kiểm thêm from≤to, khoảng thời gian tối đa 1 giờ, tối đa 1000 bản ghi, tham chiếu và vòng liên kết trong sơ đồ, quyền nguồn vừa bị thu hồi, cũng như việc lưu nghiệp vụ và lịch sử cùng thành công hoặc cùng hủy. Kiểm cấu trúc dữ liệu chưa đủ chứng minh các hành vi này; cần kiểm nghiệp vụ và các thành phần phối hợp.

Khi thay định nghĩa API, cập nhật cấu trúc dữ liệu, mẫu kiểm thử, tài liệu và chương trình gọi API trong cùng thay đổi. Cơ sở dữ liệu có bảng không đồng nghĩa phải mở thêm chức năng tạo, đọc, sửa, xóa nguồn hoặc tri thức ngoài phạm vi bản tối thiểu.
