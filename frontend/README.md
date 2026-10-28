# Frontend

Khung giao diện TraceWeaver, dự kiến React. Chưa khởi tạo package hoặc UI.

- `app/`: bootstrap, routing và providers.
- `features/`: workspace/knowledge, events, reconstruction, cases, dashboard.
- `components/`: thành phần giao diện dùng chung.
- `services/`: HTTP client theo `../backend/contracts/openapi.json`.

OIDC Code + PKCE; không đưa client secret vào trình duyệt. Quyền truy cập được backend kiểm tra.

Backend đã có20 operations; xem [hiện trạng](../docs/CURRENT_STATUS.md). Origin development mặc định localhost/127.0.0.1:3000, callback `/auth/callback`; dùng FRONTEND_ORIGINS khi đổi origin và provision theo [Keycloak guide](../backend/KEYCLOAK.md). API/health hỗ trợ preflight Authorization/Content-Type/Idempotency-Key và expose Location/X-Request-ID; core HTTP chỉ dành cho app server. CORS không thay token/DB permissions. Chưa có frontend runtime/E2E.
