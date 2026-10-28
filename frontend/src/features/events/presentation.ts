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
  const refs = [...new Set(event.identifiers
    .filter((identifier) => identifier.namespace === "request")
    .map((identifier) => identifier.value))];
  if (refs.length === 0) return "Chưa xác định";
  if (refs.length > 1) return `Nhiều mã yêu cầu: ${refs.join(", ")}`;
  return refs.join("");
}

export function actionLabel(action: string): string {
  return Object.hasOwn(ACTION_LABELS, action)
    ? ACTION_LABELS[action] ?? "Hoạt động chưa có nhãn"
    : "Hoạt động chưa có nhãn";
}

export function outcomeLabel(outcome: Event["outcome"]): string {
  return OUTCOME_LABELS[outcome];
}

export function sourceLabel(event: Event, sources: Source[]): string {
  return sources.find((source) => source.id === event.source_id)?.name
    ?? "Chưa tải được tên nguồn";
}

export function errorLabel(event: Event): string | null {
  const code = event.payload_redacted.error_code;
  if (typeof code !== "string" || !code.trim()) return null;
  return code === "CAPACITY_EXHAUSTED"
    ? "Không đủ tài nguyên để cấp môi trường"
    : "Có mã lỗi chưa có mô tả; xem chi tiết kỹ thuật";
}

export function eventDescription(event: Event): string {
  // Outcome is displayed independently; an action label never determines success.
  if (Object.hasOwn(ACTION_LABELS, event.action)) return actionLabel(event.action);
  return event.message.trim() || "Chưa có nội dung mô tả";
}

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit", month: "2-digit", year: "numeric",
});

export function eventTimeLabel(value: string): string {
  const date = new Date(value);
  return `${timeFormatter.format(date)} · ${dateFormatter.format(date)}`;
}
