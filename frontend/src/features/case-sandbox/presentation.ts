import type { Observation, Proof, Sandbox } from './schemas.ts';
import { attemptSchema } from './schemas.ts';
type Progress = { caseState?: string; proofStatus?: 'unknown' | 'missing' | 'matched' };
export function resultLabel(result: string) {
  return result === 'passed' ? 'Đạt' : result === 'failed' ? 'Không đạt' : 'Chưa đủ kết luận';
}
export function observationLabel(observation: Observation, progress?: Progress): string {
  if (observation.reason === 'NOT_EXECUTED') return 'Chưa chạy kiểm tra';
  if (observation.reason === 'RERUN_REQUIRED') return 'Phiên bản nguồn đã thay đổi — cần chạy lại';
  if (observation.result === 'failed') return 'Chưa đạt';
  if (observation.result === 'passed') {
    if (observation.delivery?.status !== 'delivered') return 'Đã chạy đạt — chờ chuyển log';
    if (progress?.proofStatus === 'unknown') return 'Đã chạy đạt — cần đọc kiểm chứng';
    if (progress?.proofStatus === 'matched') return 'Đã lưu kiểm chứng đạt — chờ reviewer đóng hồ sơ';
    if (progress?.caseState === 'investigating') return 'Đã chạy đạt — chờ chuyển hồ sơ sang xác minh';
    if (progress?.caseState === 'new' || progress?.caseState === 'assigned') return 'Đã chạy đạt — tiếp tục xử lý hồ sơ';
    return 'Đã chạy đạt — chờ reviewer xác minh';
  }
  return 'Chưa đủ dữ liệu để kết luận';
}
export function reasonLabel(reason?: string | null): string {
  const labels: { [key: string]: string | undefined } = {
    NOT_EXECUTED: 'Chưa có lần thực thi.', RERUN_REQUIRED: 'Nguồn đã thay đổi; cần thực thi mới.',
    INSUFFICIENT_RAM: 'Không đủ RAM.', CAPACITY_EXHAUSTED: 'Không đủ RAM.', RAM_INSUFFICIENT: 'Không đủ RAM.',
    IMAGE_UNAVAILABLE: 'Image chưa khả dụng.', ACCOUNT_INACTIVE: 'Tài khoản nghiệp vụ mô phỏng chưa được kích hoạt.',
    ACCOUNT_DISABLED: 'Tài khoản nghiệp vụ mô phỏng đang bị vô hiệu hóa.',
    SOURCE_REQUEST_NOT_FOUND: 'Không tìm thấy yêu cầu trong nguồn kiểm chứng.',
    DELIVERY_PENDING: 'Chưa xác nhận chuyển đủ log.',
  };
  if (!reason) return 'Không có lý do bổ sung.';
  return Object.hasOwn(labels, reason) ? labels[reason] ?? 'Có thông tin cần đối chiếu.' : 'Có lý do từ nguồn; xem mã trong chi tiết kỹ thuật.';
}
export function nextSandboxStep(observation: Observation, closed: boolean, progress?: Progress): string {
  if (closed) return 'Hồ sơ đã đóng. Chỉ xem lịch sử; reviewer mở lại theo workflow nếu cần xử lý tiếp.';
  if (observation.result === 'inconclusive') return `${reasonLabel(observation.reason)} Đọc điều kiện và chủ động chạy lại khi phù hợp.`;
  if (observation.result === 'failed') return 'Admin sửa điều kiện còn lỗi, sau đó operator hoặc reviewer chạy lại.';
  if (observation.delivery?.status !== 'delivered') return 'Thực thi đạt; kiểm tra chuyển log trước khi lưu kiểm chứng.';
  if (progress?.proofStatus === 'unknown') return 'Làm mới lịch sử kiểm chứng để đối chiếu; chưa xác định có bản kiểm chứng khớp lần chạy này.';
  if (progress?.proofStatus === 'matched') return 'Đã có kiểm chứng đạt cho lần chạy hiện tại. Reviewer dùng tác vụ đóng hồ sơ; BE kiểm tra lại nguồn và các điều kiện đóng.';
  if (progress?.caseState === 'awaiting_verification') return 'Reviewer lưu kiểm chứng nguồn cho lần chạy hiện tại, sau đó dùng tác vụ đóng hồ sơ; BE kiểm tra lại điều kiện.';
  if (progress?.caseState === 'new' || progress?.caseState === 'assigned') return 'Tiếp tục giao và xử lý hồ sơ theo workflow, bổ sung bằng chứng rồi chuyển sang chờ xác minh.';
  return 'Log đã chuyển. Chuyển hồ sơ sang chờ xác minh, reviewer lưu kiểm chứng rồi dùng workflow đóng hồ sơ; BE kiểm tra lại điều kiện.';
}
function proofMatches(proof: Proof, current: Sandbox, caseVersion: number): boolean {
  const old = proof.observation, now = current.observation;
  const savedAttempt = attemptSchema.safeParse(old.attempt), currentAttempt = attemptSchema.safeParse(now.attempt);
  return proof.case_id === current.case_id && proof.case_version === caseVersion && current.case_version === caseVersion &&
    old.result === 'passed' && now.result === 'passed' && old.source === 'lab-sandbox' && now.source === 'lab-sandbox' &&
    old.simulated === true && now.simulated === true && old.checker_version === 'lab-state-2' && now.checker_version === old.checker_version &&
    !!old.request_id && old.request_id === now.request_id &&
    old.delivery?.status === 'delivered' && now.delivery?.status === 'delivered' &&
    savedAttempt.success && currentAttempt.success && savedAttempt.data.id === currentAttempt.data.id &&
    savedAttempt.data.source_version === currentAttempt.data.source_version &&
    savedAttempt.data.result === 'passed' && currentAttempt.data.result === 'passed' &&
    typeof old.environment?.id === 'string' && !!old.environment.id && old.environment.id === now.environment?.id;
}
export function latestMatchingProof(proofs: Proof[], current: Sandbox | null, caseVersion: number): Proof | null {
  if (!current) return null;
  // BE uses the latest proof for this case version, even when an older proof passed.
  const latest = proofs.filter(proof => proof.case_id === current.case_id && proof.case_version === caseVersion).at(-1);
  return latest && proofMatches(latest, current, caseVersion) ? latest : null;
}
export function proofNotice(proof: Proof, current: Sandbox | null, caseVersion: number, closed = false): string {
  if (closed) return 'Bản kiểm chứng lịch sử tại thời điểm lưu. Hồ sơ đã đóng; kết quả nguồn hiện tại được hiển thị riêng.';
  if (proof.case_version !== caseVersion) return 'Khác phiên bản hồ sơ hiện tại; cần kiểm chứng mới.';
  if (!current) return 'Chưa có quan sát nguồn mới để đối chiếu hiệu lực.';
  const old = proof.observation, now = current.observation;
  if (current.case_version !== caseVersion) return 'Quan sát và hồ sơ khác phiên bản; tải lại trước khi đối chiếu.';
  if (proof.case_id !== current.case_id) return 'Bản kiểm chứng thuộc hồ sơ khác; cần tải lại đúng hồ sơ.';
  if (old.delivery?.status !== 'delivered') return 'Bản kiểm chứng chưa ghi nhận đủ log. Log đến sau không tự làm proof này hợp lệ.';
  if (old.result !== 'passed') return 'Bản kiểm chứng này chưa đạt; cần xử lý nguồn và lưu kiểm chứng mới.';
  if (now.result !== 'passed') return 'Nguồn hiện tại chưa đạt hoặc cần chạy lại; bản kiểm chứng cũ không đủ để đóng hồ sơ.';
  if (now.delivery?.status !== 'delivered') return 'Lần chạy hiện tại chưa chuyển đủ log; đối chiếu nguồn trước khi kiểm chứng.';
  if (!proofMatches(proof, current, caseVersion)) return 'Lần chạy, định danh nguồn hoặc môi trường chưa khớp; cần đối chiếu và kiểm chứng mới.';
  return 'Bản kiểm chứng khớp lần chạy hiện tại. BE vẫn kiểm tra lại nguồn và các điều kiện khi đóng hồ sơ.';
}
