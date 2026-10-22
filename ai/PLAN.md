# Kế hoạch hoàn thiện AI để thi ngày 27/10/2026

Cập nhật: 23/10/2026, múi giờ Asia/Saigon. Thay lịch 7 ngày và lịch demo 8 giờ trước đây.

Phương án người phụ trách AI đã duyệt: **một model nhỏ + API FastAPI hiện có + baseline dự phòng**.
Mục tiêu đóng gói bản thi vào **tối 26/10**; ngày 27/10 dành cho kiểm tra nhanh và trình bày.
Đây là kế hoạch phần AI; tích hợp toàn hệ thống còn phụ thuộc tiến độ backend và thống nhất của team.

## 1. Mình đang làm gì và hoàn thành nghĩa là gì?

AI nhận thông tin của hai sự kiện và trả điểm trong khoảng 0–1 để hỗ trợ backend quyết định cách nối chúng.
Ví dụ: sự kiện “nhận yêu cầu” và “tạo tài khoản” có thuộc một bước nối hợp lệ hay không.
Điểm số chưa được mặc định hiểu là xác suất đúng; AI không tự ghi liên kết vào cơ sở dữ liệu.

- Bạn phụ trách dữ liệu, model, dịch vụ chấm điểm và báo cáo đánh giá.
- Backend Node.js sử dụng điểm số, phụ trách quyền truy cập, nghiệp vụ, dựng luồng và lưu kết quả.
- Phần AI hoàn thành khi có model tái tạo được, API chạy được, kết quả đánh giá và hướng dẫn bàn giao.
- Tích hợp hoàn thành khi Node.js thực sự gọi được AI và xử lý được cả thành công lẫn lỗi.
- Bạn cần giải thích được dữ liệu đầu vào, cách học, ý nghĩa kết quả và giới hạn của model.
- Chatbot, RAG, LLM, GPU, tự động retrain và thử nhiều thuật toán nằm ngoài bản thi này.

## 2. Điểm xuất phát

| Thành phần | Trạng thái khi lập lại kế hoạch | Ý nghĩa |
|---|---|---|
| 24 cặp sự kiện mẫu | Đã có; nhãn chính thức vẫn chờ duyệt | Giúp thống nhất bài toán, chưa phải bộ dữ liệu đánh giá |
| Cách tính 5 đặc trưng | Đã có bản đề xuất | Team cần thống nhất ý nghĩa và nơi chạy |
| Baseline — chấm điểm bằng luật viết tay | Đã có | Mốc so sánh và phương án demo dự phòng |
| API FastAPI, kiểm schema/xác thực và tests | Đã có cho baseline | Thử được dịch vụ độc lập; chưa phục vụ model đã train |
| Kiểm nhãn null/0/1 | Đã có | Không biến trường hợp chưa biết thành nhãn sai |
| Dữ liệu huấn luyện, model và báo cáo chất lượng | Chưa có | Phần việc chính tiếp theo |
| Nạp model có kiểm checksum | Chưa có | Chế độ model hiện trả 503 khi chưa khả dụng |
| Tích hợp với Node.js | Chưa có | Cần phối hợp với teammate |
| Hướng dẫn chạy và inventory license Python | Đã có bản hiện tại | Cập nhật khi thêm model/dependency |

Trạng thái trên dựa trên source và tài liệu hiện có, không phải kết quả chạy lại tests trong lần sửa kế hoạch này.

## 3. Giả định và những điểm cần chốt

**Quỹ giờ của bạn chưa được xác nhận.** Các khoảng giờ dưới đây là ước tính công việc có hỗ trợ,
không phải cam kết hoàn thành. Cần thêm thời gian học và sửa lỗi nếu một bước chưa rõ.
Cuối mỗi ngày đối chiếu đầu ra thực tế; nếu trễ, dùng phương án giảm phạm vi ở mục 7.

| Nội dung | Giả định hoặc yêu cầu để lập lịch |
|---|---|
| Quy mô | Demo chạy CPU, 1–100 cặp/lần theo contract; chưa cam kết tải nhiều người dùng |
| Hiệu năng | Đo trên máy demo sau warm-up; mục tiêu thử nghiệm p95 dưới 1 giây cho batch 100 ở một request đồng thời, để chừa thời gian trong timeout 5 giây của caller; chưa có số đo |
| Dữ liệu/bảo mật | Ưu tiên dữ liệu synthetic của dự án; credential nội bộ; không đưa đáp án vào feature/runtime |
| Độ tin cậy | Model thiếu/hỏng báo lỗi rõ; backend sở hữu fallback và audit; baseline chỉ bật rõ trong development/test |
| Bảo trì | Bạn sở hữu Python service và hướng dẫn chạy; teammate sở hữu caller Node.js; cùng kiểm tích hợp |
| Chất lượng | Chưa có ngưỡng nghiệm thu từ team; báo kết quả thực đo, không hứa model chắc chắn tốt hơn baseline |

Các điểm còn mở, cần giải quyết trong ngày 23/10:

- Nhãn 1 nghĩa là **cạnh nối trực tiếp A→B hợp lệ** hay chỉ cùng hành trình? Đề xuất hiện tại là cạnh trực tiếp; duyệt kế hoạch chưa thay thế quyết định nghiệp vụ này.
- Khi thiếu bước, timestamp ngược, retry hoặc outcome lỗi thì gán nhãn thế nào?
- Team có đồng ý chạy Python service riêng, ai chạy trên máy demo và ai viết caller Node.js?
- Ai tính feature, chạy ở đâu, và kiểm nhất quán giữa Python/Node bằng cách nào?
- Nếu có docs03–05 hoặc tiêu chí cuộc thi chưa nằm trong checkout, đối chiếu sớm để điều chỉnh phạm vi.

## 4. Timeline từ 23 đến 27/10

| Ngày | Thời lượng dự trù | Việc ưu tiên | Đầu ra để kết thúc mốc |
|---|---|---|---|
| **23/10 — chốt bài toán** | 3–5 giờ | Hiểu luồng hiện tại; thống nhất nhãn/feature; duyệt bộ mẫu; thống nhất phối hợp backend | Quy tắc có ví dụ; nhãn duyệt kèm lý do, ca chưa rõ giữ null; xác định người phụ trách tích hợp |
| **24/10 — dữ liệu và model** | 4–6 giờ | Mở rộng dữ liệu; tách tập; train một model nhỏ; so với baseline | Dữ liệu tạo lại được, model đầu tiên, metadata/checksum và báo cáo ban đầu |
| **25/10 — API và tích hợp** | 4–6 giờ | Nạp model; kiểm lỗi; đo tốc độ; cùng backend thử gọi thật | API model chạy được; bằng chứng tích hợp nếu backend sẵn, hoặc demo độc lập kèm phụ thuộc còn thiếu |
| **26/10 — ổn định và bàn giao** | 3–5 giờ | Sửa lỗi; chạy lại hướng dẫn; hoàn thiện báo cáo/license; tập trình bày | Bản thi đóng gói, demo chính và dự phòng đã chạy thử |
| **27/10 — đi thi** | Kiểm tra nhanh trước buổi thi | Khởi động bản đã kiểm tra; kiểm credential, model và request mẫu | Demo và trình bày; tránh đổi model/dependency sát giờ |

Tổng dự trù **14–22 giờ**, chưa tính thời gian chờ teammate và phát sinh học/debug.
Nếu quỹ giờ thấp hơn, ưu tiên đầu ra tối thiểu và báo rõ phần chưa hoàn thành.

### Ngày 23/10: hiểu và chốt trước khi train

1. Chạy demo theo [RUN.md](RUN.md), giải thích một request và một response.
2. Đi qua ba ví dụ: cặp có khả năng nối, cặp có ID mâu thuẫn, cặp thiếu thông tin.
3. Cùng backend chốt ý nghĩa nhãn và feature; ưu tiên các ca khó trong [START_HERE.md](START_HERE.md).
4. Duyệt 24 mẫu: điền nhãn, người duyệt và lý do khi đủ cơ sở; giữ null cho ca chưa quyết định.
5. Thống nhất service AI riêng và lịch tích hợp 25/10. Teammate không cần viết Python để gọi HTTP, nhưng cần thống nhất cách chạy hai service.

**Điều kiện qua bước:** có quy tắc đủ rõ cho các kịch bản sẽ sinh dữ liệu và ví dụ đúng/sai đã duyệt.
Không ép cả 24 mẫu thành 0/1. Khi chưa thống nhất, vẫn có thể thử API và chuẩn bị tài liệu; chưa train trên nhãn suy đoán.

### Ngày 24/10: dữ liệu và model đầu tiên

1. Tạo dữ liệu synthetic từ quy tắc đã duyệt, có seed, version và nguồn để tái tạo.
   Nhãn chuẩn lấy từ cấu trúc hành trình/cạnh của bộ sinh, tách khỏi feature; không lấy điểm baseline làm đáp án.
2. Bắt đầu khoảng 200 hành trình và khoảng 1.000 cặp nếu bộ sinh cho phép; đây là ngân sách thử nghiệm, không bảo đảm đủ chất lượng.
   Kiểm thủ công 30–50 cặp, gồm ca dễ nhầm, trước khi mở rộng.
3. Chia theo hành trình trước khi tạo cặp, dự kiến 70% học / 15% chọn cấu hình / 15% kiểm tra cuối.
   Một event/hành trình không xuất hiện ở nhiều tập; cả hai event của cặp âm phải cùng tập.
4. Thử một model nhỏ. Logistic Regression là ứng viên đầu tiên từ kế hoạch cũ, cần giải thích và kiểm dependency trước khi triển khai.
5. So với baseline trên cùng dữ liệu. Chọn ngưỡng trên validation; giữ test riêng để đánh giá cuối.

**Điều kiện qua bước:** có lệnh tạo lại dữ liệu/train, model có version/checksum, kết quả ban đầu và ví dụ lỗi.
24 mẫu bootstrap dùng để thảo luận và kiểm quy ước; không dùng riêng bộ đó để tuyên bố chất lượng tổng quát.

### Ngày 25/10: dùng model qua API

1. Nạp model do dự án tạo sau khi kiểm checksum; dùng đúng thứ tự feature và preprocessing lúc train.
2. Giữ nguyên contract. Kiểm batch 1/100, input sai, model thiếu/hỏng và response sai ID/score.
3. Đo thời gian xử lý trên máy demo; ghi cấu hình máy, warm-up và cách đo.
4. Cùng teammate thử Node.js → AI → Node.js bằng dữ liệu mẫu đã thống nhất.
5. Kiểm AI không sẵn sàng, timeout, fallback và audit với backend khi các phần đó đã có.

**Điều kiện qua bước:** API trả kết quả từ model, có kiểm lỗi và số đo.
Client mô phỏng chỉ chứng minh scorer hoạt động độc lập; không tính là tích hợp backend hoặc dựng graph hoàn chỉnh.

### Ngày 26/10: đóng gói và tập demo

1. Hoàn thiện báo cáo trên test giữ riêng: precision (độ chính xác các cặp dự đoán nối), recall (mức tìm đủ cặp cần nối),
   F1 (kết hợp hai chỉ số), số nối sai/bỏ sót và nhóm tình huống còn yếu. Không chỉnh theo test rồi gọi đó là đánh giá độc lập.
2. Chạy lại cài → tạo dữ liệu → train → start → gọi API theo hướng dẫn; ưu tiên môi trường sạch hoặc máy demo.
3. Rà dependencies, license, version model, cấu hình và tài liệu bàn giao.
4. Tập trình bày: bài toán → dữ liệu → baseline/model → kết quả → hạn chế.
   Chuẩn bị một ca đúng, một ca sai và một ca chưa đủ bằng chứng.
5. Lưu bản source/model đã kiểm tra cùng checksum và lệnh chạy; kiểm demo dự phòng.

**Điều kiện hoàn tất:** bạn chạy lại và giải thích được bản thi; ghi đúng trạng thái tích hợp và giới hạn còn lại.

## 5. Phân công và luồng dữ liệu

Luồng đích: **Node.js chọn cặp và chuẩn bị feature → AI trả score → Node.js xử lý nghiệp vụ**.
Theo contract hiện tại, API AI nhận feature đã tính, không nhận raw log.

| Người/phần | Trách nhiệm |
|---|---|
| Bạn — AI | Dữ liệu offline, model, đánh giá, API scorer, hướng dẫn Python và artifact |
| Teammate — backend | Quyền truy cập/redaction, chọn cặp, gọi scorer, dựng graph, DB, fallback và audit |
| Cùng thống nhất | Nhãn, feature, process template, nơi tính feature, credential và cách demo |
| Cách làm cùng trợ lý | Giải thích mục tiêu và ví dụ trước code; làm từng phần nhỏ, kiểm tra rồi giải thích kết quả |

Nếu có hai bản tính feature Python/Node.js, kiểm trên cùng ví dụ chuẩn để tránh train một kiểu và chạy một kiểu.
Năm feature hiện chưa thể hiện đầy đủ outcome hoặc độ mạnh của từng loại ID; phân tích lỗi cần ghi nhận giới hạn này.

## 6. Quy tắc kỹ thuật và điều kiện bàn giao

Nguồn chuẩn: [OpenAPI](../backend/contracts/openapi.json), [domain schema](../backend/contracts/schemas/domain.schema.json),
[contract semantics](../backend/contracts/README.md) và [SECURITY](../SECURITY.md).

- API: `POST /internal/v1/score-pairs`, Bearer credential nội bộ, `schema_version: "1"`, 1–100 cặp.
- Năm feature: `delta_seconds`, `shared_id_count`, `text_similarity`, `transition_allowed`, `conflicting_id`.
- Response có `model_version`, `feature_schema_version: "1"`, đúng một score hữu hạn [0,1] cho mỗi `pair_id` đầu vào.
- Sai schema: 422 toàn batch; model không khả dụng: 503. Không âm thầm trả baseline dưới tên model.
- `null` là chưa có nhãn, loại khỏi dữ liệu học; `0` là nhãn âm hợp lệ. Không dùng `suggested_label` thay nhãn đã duyệt.
- Không dùng đáp án ẩn, tên kịch bản hoặc ID hành trình ẩn làm feature. Chỉ fit preprocessing trên train.
- Có negative dễ nhầm và kịch bản giữ riêng; báo kết quả synthetic đúng phạm vi, không suy thành hiệu quả trên dữ liệu thật.
- Chất lượng chấm điểm cặp và chất lượng graph là hai phép đánh giá khác nhau; graph cần pipeline backend thật.

Checklist nghiệm thu bản AI:

- [ ] Nhãn/feature đã thống nhất, các giả định còn lại được ghi rõ.
- [ ] Dữ liệu có nguồn, seed/version, chia tập không trùng hành trình và lệnh tạo lại.
- [ ] Có model, metadata/checksum, lệnh train và kiểm nhất quán feature khi chạy.
- [ ] Có so sánh baseline/model, báo cáo test, lỗi điển hình và số đo tốc độ.
- [ ] API kiểm auth/schema/batch/ID/score; model thiếu, hỏng hoặc sai checksum không được load.
- [ ] Hướng dẫn cài, train, test, chạy và gọi API được kiểm lại.
- [ ] License/dependency inventory cập nhật; artifact/data có nguồn rõ ràng.
- [ ] Demo chính và dự phòng đã diễn tập; bạn giải thích được kết quả.
- [ ] Tích hợp Node.js và xử lý lỗi đã kiểm thực tế, hoặc đánh dấu rõ còn chờ.

Theo [LICENSE](../LICENSE), [NOTICE](../NOTICE) và [CONTRIBUTING](../CONTRIBUTING.md),
giữ license/attribution cần thiết, dùng SPDX cho source mới và ghi nhận thay đổi khi phân phối.
Dependency/dataset/model bên ngoài giữ điều khoản riêng. Cập nhật [DEPENDENCIES.md](DEPENDENCIES.md)
và [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) khi thêm thư viện; kiểm npm không thay thế kiểm Python.
Không commit `.env`, secret, dữ liệu cá nhân hoặc oracle/đáp án review; generator và hướng dẫn tái tạo có thể bàn giao.

## 7. Nếu tiến độ hoặc kết quả không như dự kiến

| Tình huống / mốc kiểm | Cách xử lý |
|---|---|
| Hết 23/10 chưa chốt nhãn | Tiếp tục demo API, ghi câu hỏi nghiệp vụ; thu hẹp về kịch bản đã xác nhận. Chưa train trên nhãn tự suy đoán |
| Hết 24/10 chưa có model dùng được | Ưu tiên một pipeline nhỏ; bỏ thử thuật toán khác. Chuẩn bị baseline dự phòng, ghi rõ chưa có model nếu vẫn chưa xong |
| Model không tốt hơn baseline | Báo kết quả thật, xem lỗi dữ liệu/feature; không tăng độ phức tạp chỉ để có con số đẹp |
| Hết 25/10 backend chưa sẵn | Đóng gói demo AI độc lập và request/response mẫu; ghi tích hợp còn thiếu, phối hợp tiếp nếu kịp |
| Team chưa đồng ý Python service | Giữ demo độc lập, chốt phương án với team; đánh giá lại lịch trước khi chuyển sang Node.js |
| Ngày 26/10 còn lỗi lớn | Dùng bản gần nhất đã kiểm tra; baseline phải bật rõ development/test và trình bày là luật, không phải model đã train |
| Quỹ giờ ít hơn dự trù | Cắt mở rộng ngoài kịch bản cần thiết, thử nhiều model và tính năng mới; giữ kiểm dữ liệu, đánh giá trung thực và demo tái lập |

Baseline dự phòng là lựa chọn demo có chủ đích; khác với fallback `rule_only` mà backend xử lý khi gọi AI thất bại.
Các phương án dự phòng không được dùng để đánh dấu phần ML hoặc tích hợp là đã hoàn thành.

## 8. Nhật ký quyết định

| Ngày | Quyết định / trạng thái | Phương án đã cân nhắc | Lý do |
|---|---|---|---|
| 23/10 | Người phụ trách AI duyệt model nhỏ + FastAPI hiện tại | Chỉ baseline; chuyển phục vụ AI sang Node.js | Tận dụng code, có ML để đánh giá và trình bày; còn cần team thống nhất triển khai |
| 23/10 | Đóng gói tối 26/10, thi 27/10 | Tiếp tục thêm tính năng sát ngày thi | Dành thời gian kiểm tra và tập demo |
| 23/10 | Giữ baseline so sánh và dự phòng | Bỏ baseline sau train | Có mốc kiểm chứng và bản demo khi model chưa đạt |
| 23/10 | Giữ nhãn chưa biết là null | Ép thành 0 | Tránh nhãn âm sai trong dữ liệu học |
| 23/10 | Làm từng phần nhỏ, giải thích trước code | Triển khai nhiều phần một lượt | Bạn cần hiểu và tự trình bày được |
| Chờ chốt | Cạnh trực tiếp hay cùng hành trình; nơi tính feature; triển khai cùng backend | Ghi tại mục 3 | Cần quyết định nghiệp vụ và phối hợp team, chưa được coi là đã duyệt |

**Việc đầu tiên khi bắt đầu triển khai:** cùng đọc ba cặp mẫu dễ hiểu, giải thích nhãn 1/0/null,
rồi chốt quy tắc với backend trước khi mở rộng dữ liệu. Hướng dẫn hiện có: [START_HERE.md](START_HERE.md).
