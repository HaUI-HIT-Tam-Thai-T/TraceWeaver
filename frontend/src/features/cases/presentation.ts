import type { Case } from "../../types/cases";

const states: { [value: string]: string | undefined } = {
  new: "Mới tiếp nhận",
  assigned: "Đã phân công",
  investigating: "Đang điều tra",
  awaiting_verification: "Chờ xác minh",
  closed: "Đã đóng",
};
const actions: { [value: string]: string | undefined } = {
  create: "Tạo hồ sơ",
  assign: "Phân công người xử lý",
  start: "Bắt đầu điều tra",
  request_verification: "Yêu cầu xác minh",
  verify_close: "Xác minh và đóng hồ sơ",
  verification_failed: "Yêu cầu điều tra bổ sung",
  reopen: "Mở lại hồ sơ",
};
export function caseStateLabel(value: string): string {
  return Object.hasOwn(states, value) ? (states[value] ?? value) : value;
}
export function caseActionLabel(value: string): string {
  return Object.hasOwn(actions, value) ? (actions[value] ?? value) : value;
}
export function nextCaseStep(state: Case["state"]): string {
  const steps = {
    new: "Phân công người xử lý để bắt đầu điều tra.",
    assigned: "Người được phân công hoặc người xác minh có thể bắt đầu điều tra.",
    investigating: "Bổ sung bằng chứng và ghi chú xử lý, sau đó yêu cầu xác minh.",
    awaiting_verification:
      "Người có vai trò reviewer kiểm tra bằng chứng và các liên kết còn chờ duyệt trước khi đóng.",
    closed: "Hồ sơ chỉ đọc. Người có vai trò reviewer có thể mở lại khi có lý do mới.",
  };
  return steps[state];
}
