import type { Observation, Proof, Sandbox } from './schemas.ts';
export function resultLabel(result: string) {
  return result === 'passed' ? 'Đạt' : result === 'failed' ? 'Không đạt' : 'Chưa đủ kết luận';
}
export function reasonLabel(reason?: string | null): string {
  const labels: { [key: string]: string | undefined } = {
    NOT_EXECUTED: 'Chưa có lần thực thi.', RERUN_REQUIRED: 'Nguồn đã thay đổi; cần thực thi mới.',
    INSUFFICIENT_RAM: 'Không đủ RAM.', CAPACITY_EXHAUSTED: 'Không đủ RAM.', RAM_INSUFFICIENT: 'Không đủ RAM.',
    IMAGE_UNAVAILABLE: 'Image chưa khả dụng.', ACCOUNT_INACTIVE: 'Tài khoản nghiệp vụ mô phỏng chưa được kích hoạt.',
    SOURCE_REQUEST_NOT_FOUND: 'Không tìm thấy yêu cầu trong nguồn kiểm chứng.',
    DELIVERY_PENDING: 'Chưa xác nhận chuyển đủ log.',
  };
  if (!reason) return 'Không có lý do bổ sung.';
  return Object.hasOwn(labels, reason) ? labels[reason] ?? 'Có thông tin cần đối chiếu.' : 'Có lý do từ nguồn; xem mã trong chi tiết kỹ thuật.';
}
export function nextSandboxStep(observation: Observation, closed: boolean): string {
  if (closed) return 'Hồ sơ đã đóng. Chỉ xem lịch sử; reviewer mở lại theo workflow nếu cần xử lý tiếp.';
  if (observation.result === 'inconclusive') return `${reasonLabel(observation.reason)} Đọc điều kiện và chủ động chạy lại khi phù hợp.`;
  if (observation.result === 'failed') return 'Admin sửa điều kiện còn lỗi, sau đó operator hoặc reviewer chạy lại.';
  if (observation.delivery?.status !== 'delivered') return 'Thực thi đạt; kiểm tra chuyển log trước khi lưu kiểm chứng.';
  return 'Log đã chuyển. Chuyển hồ sơ sang chờ xác minh, reviewer lưu kiểm chứng rồi dùng workflow đóng hồ sơ; BE kiểm tra lại điều kiện.';
}
export function proofNotice(proof: Proof, current: Sandbox | null, caseVersion: number): string {
  if (proof.case_version !== caseVersion) return 'Khác phiên bản hồ sơ hiện tại; cần kiểm chứng mới.';
  if (!current) return 'Chưa có quan sát nguồn mới để đối chiếu hiệu lực.';
  const old = proof.observation, now = current.observation;
  if (current.case_version !== caseVersion) return 'Quan sát và hồ sơ khác phiên bản; tải lại trước khi đối chiếu.';
  if (old.source_version !== now.source_version || old.checker_version !== now.checker_version || old.request_id !== now.request_id) return 'Phiên bản hoặc định danh nguồn đã thay đổi; cần kiểm chứng mới.';
  if (old.delivery?.status !== 'delivered') return 'Bản kiểm chứng chưa ghi nhận đủ log. Log đến sau không tự làm proof này hợp lệ.';
  return 'BE vẫn kiểm tra lại hiệu lực nguồn, attempt, môi trường và các guard khi đóng hồ sơ.';
}
