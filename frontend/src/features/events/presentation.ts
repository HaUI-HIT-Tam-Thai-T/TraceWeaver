import type { Event } from "./schemas";
import type { Source } from "../workspace/schemas";

const ACTION_LABELS: { [code: string]: string | undefined } = {
  "request.accepted": "Đã tiếp nhận yêu cầu",
  "account.created": "Đã tạo tài khoản",
  "provision.completed": "Đã cấp môi trường",
  "provision.failed": "Cấp môi trường thất bại",
};

const OUTCOME_LABELS = {
  success: "Thành công",
  failed: "Thất bại",
  unknown: "Chưa xác định",
};

export function requestLabel(event: Event): string {
  const refs = [
    ...new Set(
      event.identifiers
        .filter((identifier) => identifier.namespace === "request")
        .map((identifier) => identifier.value),
    ),
  ];
  if (refs.length === 0) return "Chưa xác định";
  if (refs.length > 1) return `Nhiều mã yêu cầu: ${refs.join(", ")}`;
  return refs.join("");
}

export function actionLabel(action: string): string {
  return Object.hasOwn(ACTION_LABELS, action)
    ? (ACTION_LABELS[action] ?? `Hoạt động: ${action}`)
    : `Hoạt động: ${action}`;
}

export function outcomeLabel(outcome: Event["outcome"]): string {
  return OUTCOME_LABELS[outcome];
}

export function sourceLabel(event: Event, sources: Source[]): string {
  const source = sources.find((source) => source.id === event.source_id);
  return source ? sourceName(source.name) : "Nguồn không khả dụng";
}

export function sourceName(name: string): string {
  const labels: { [code: string]: string | undefined } = {
    intake: "Tiếp nhận yêu cầu",
    account: "Quản lý tài khoản",
    provision: "Cấp môi trường",
  };
  return Object.hasOwn(labels, name) ? (labels[name] ?? name) : name;
}

export function requestIds(event: Event): string[] {
  return [
    ...new Set(
      event.identifiers.filter((item) => item.namespace === "request").map((item) => item.value),
    ),
  ];
}

export function errorLabel(event: Event): string | null {
  const code = event.payload_redacted.error_code;
  if (typeof code !== "string" || !code.trim()) return null;
  const messages: { [code: string]: string | undefined } = {
    CAPACITY_EXHAUSTED: "Không đủ tài nguyên để cấp môi trường",
    TIMEOUT: "Thao tác vượt thời gian chờ; kiểm tra các log tiếp theo để biết kết quả",
    PERMISSION_DENIED: "Tác vụ không được cấp quyền thực hiện",
    INVALID_INPUT: "Dữ liệu đầu vào của tác vụ không hợp lệ",
    DEPENDENCY_UNAVAILABLE: "Dịch vụ phụ thuộc chưa sẵn sàng",
  };
  return `${code}: ${Object.hasOwn(messages, code) ? messages[code] : "Chưa có diễn giải cho mã lỗi này; xem nội dung log và chi tiết kỹ thuật"}`;
}

export function eventDescription(event: Event): string {
  // Display the recorded message, never replace it with an inferred action summary.
  return event.message.trim()
    ? event.message
    : "Log không có thông điệp; mở chi tiết kỹ thuật để xem dữ liệu đã ghi nhận.";
}

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function eventTimeLabel(value: string): string {
  const date = new Date(value);
  return `${timeFormatter.format(date)} · ${dateFormatter.format(date)}`;
}
