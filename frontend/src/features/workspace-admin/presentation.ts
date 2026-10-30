import type { ApiError } from '../../services/apiError.ts';
export function adminError(error: ApiError): string {
  const labels: { [code: string]: string | undefined } = {
    VERSION_CONFLICT: 'Dữ liệu quản trị đã thay đổi. Đọc thông tin mới và xác nhận phiên bản trước khi gửi lại.',
    MEMBER_EXISTS: 'Subject đã có membership, kể cả đã thu hồi. Chọn thành viên để sửa hoặc kích hoạt lại.',
    IDEMPOTENCY_CONFLICT: 'Mã thao tác đã dùng với nội dung khác. Giữ nguyên intent và kiểm tra trạng thái.',
    ACCOUNT_OWNERSHIP_CONFLICT: 'Tên đăng nhập thuộc tài khoản khác. Không thể nhận quyền sở hữu hoặc đặt lại mật khẩu.',
    LAST_ADMIN_REQUIRED: 'Workspace phải còn ít nhất một quản trị viên đang hoạt động.',
    SERVICE_ACCOUNT_PROTECTED: 'Không được sửa tài khoản dịch vụ bằng chức năng này.',
    ACCOUNT_NOT_FOUND: 'Không tìm thấy tài khoản SSO người dùng phù hợp.', ACCOUNT_UNAVAILABLE: 'Tài khoản không đủ điều kiện để thêm hoặc kích hoạt.',
    MEMBER_INACTIVE: 'Thành viên đã bị thu hồi. Kiểm tra membership trước khi cấp quyền.',
    ACCOUNT_POLICY_REJECTED: 'Thông tin tài khoản hoặc mật khẩu chưa đạt chính sách Keycloak.',
    ACCOUNT_PROVIDER_DISABLED: 'Chức năng tạo/xác minh tài khoản chưa được cấu hình. Không tự thử lại.',
    ACCOUNT_PROVISIONING_PENDING: 'Việc tạo tài khoản chưa hoàn tất. Kiểm tra trạng thái hoặc thử hoàn tất bằng cùng mã thao tác.',
    ACCOUNT_PROVIDER_UNAVAILABLE: 'Dịch vụ tài khoản tạm thời không khả dụng.', ADMIN_UNAVAILABLE: 'Dịch vụ quản trị tạm thời không khả dụng.',
  };
  return Object.hasOwn(labels, error.code) ? labels[error.code] ?? error.message : error.message;
}
