# Phối hợp AI scorer với Backend

> Ghi chú backend 25/10/2026: giữ nguyên yêu cầu gốc bên dưới. Đọc [phản hồi backend](BACKEND_HANDOFF_RESPONSE.md) và [hiện trạng](CURRENT_STATUS.md). Policy đang dùng `request.accepted → account.created → provision.completed|failed`; tên action trong phần giả định dưới đây chưa được runtime hỗ trợ. Chưa coi các câu hỏi outcome/retry/features là đã chốt.

Mình đang làm phần AI scorer cho TraceWeaver. Luồng dự kiến:

```text
Node.js chọn cặp event + tính feature
→ FastAPI AI trả score
→ Node.js dùng score để dựng graph, audit và fallback
```

AI hiện có baseline chạy độc lập qua HTTP, nhưng chưa train model vì cần chốt
nghiệp vụ trước.

## Cần backend xác nhận

### 1. Ý nghĩa label `1`

`label = 1` nghĩa là hai event có **cạnh nối trực tiếp A → B**, hay chỉ cần
thuộc cùng một journey?

### 2. Transition hợp lệ

Hiện mình đang giả sử:

```text
intake/request.received → account/account.created
account/account.created → provision/environment.provisioned
```

Có cho phép bỏ bước không?

Ví dụ: Intake → Provision cùng `request_id`, nhưng không có Account ở giữa,
có được xem là nối trực tiếp không?

### 3. Ý nghĩa ID

- Cùng `request_id` có luôn là bằng chứng mạnh để nối không?
- Cùng `user_id` nhưng khác `request_id` có chắc chắn không nối không?
- Cùng `request_id` nhưng khác `account_id` có thể là retry/thay thế hợp lệ không?
- Một event thiếu ID thì cần điều kiện gì để vẫn có thể nối?

### 4. Timestamp và outcome

- Timestamp B sớm hơn A do clock skew/log đến trễ có được nối không?
- Account `failed` nhưng Provision `success` có thể thuộc cùng luồng do retry/log thiếu không?
- Outcome `unknown` có được coi là transition hợp lệ không?

## API AI hiện tại

Backend gửi tối đa 100 cặp feature:

```json
{
  "schema_version": "1",
  "pairs": [
    {
      "pair_id": "pair-001",
      "features": {
        "delta_seconds": 20,
        "shared_id_count": 1,
        "text_similarity": 0.33,
        "transition_allowed": true,
        "conflicting_id": false
      }
    }
  ]
}
```

AI trả kết quả:

```json
{
  "model_version": "baseline-rule-v1",
  "feature_schema_version": "1",
  "predictions": [
    {
      "pair_id": "pair-001",
      "score": 0.665833
    }
  ]
}
```

Endpoint:

```text
POST http://127.0.0.1:8000/internal/v1/score-pairs
Authorization: Bearer <SCORER_SERVICE_SECRET>
```

## Đề xuất tích hợp

1. Node.js kiểm quyền và redact event.
2. Node.js chọn candidate pairs, tính 5 feature.
3. Node.js gọi FastAPI AI.
4. AI chỉ trả score.
5. Node.js quyết định dựng graph, audit và fallback khi AI lỗi.

Cần chốt thêm:

- Ai chịu trách nhiệm tính feature?
- Timeout/fallback khi AI trả lỗi sẽ xử lý thế nào?
- Máy demo chạy Node.js và Python service ra sao?
- Cách quản lý `SCORER_SERVICE_SECRET`.

Sau khi chốt, mình sẽ duyệt 24 mẫu, tạo dữ liệu synthetic, train model và đưa
model vào API.
