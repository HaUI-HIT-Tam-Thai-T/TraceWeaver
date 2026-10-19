# Frontend

Khung giao diện TraceWeaver, dự kiến React. Chưa khởi tạo package hoặc UI.

- `app/`: bootstrap, routing và providers.
- `features/`: workspace/knowledge, events, reconstruction, cases, dashboard.
- `components/`: thành phần giao diện dùng chung.
- `services/`: HTTP client theo `../backend/contracts/openapi.json`.

OIDC Code + PKCE; không đưa client secret vào trình duyệt. Quyền truy cập được backend kiểm tra.
