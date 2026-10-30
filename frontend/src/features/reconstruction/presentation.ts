import { actionLabel, eventTimeLabel, requestLabel } from "../events/presentation";
import { compareUtc } from "../events/schemas";
import type { Graph, Link, Run } from "./schemas";

export function modeLabel(mode: Run["mode"]): string {
  return mode === "hybrid" ? "Kết hợp luật và AI" : "Theo luật";
}
export function runStatusLabel(status: Run["status"]): string {
  return {
    queued: "Đang chờ xử lý",
    running: "Đang tái dựng",
    completed: "Phân tích hoàn tất",
    failed: "Xử lý thất bại",
  }[status];
}
export function reviewLabel(state: Link["review_state"]): string {
  return { pending: "Chờ duyệt", accepted: "Đã chấp nhận", rejected: "Đã từ chối" }[state];
}
export function orderedSteps(graph: Graph) {
  return [...graph.nodes].sort(
    (a, b) => compareUtc(a.occurred_at, b.occurred_at) || a.event_id.localeCompare(b.event_id),
  );
}
export function graphStepLabels(graph: Graph): { [id: string]: string | undefined } {
  const labels: { [id: string]: string | undefined } = {};
  orderedSteps(graph).forEach((node, index) => {
    labels[node.event_id] =
      `Bước ${index + 1}: ${actionLabel(node.action)} · ${requestLabel(node)} · ${eventTimeLabel(node.occurred_at)}`;
  });
  return labels;
}
export function graphStepLabel(graph: Graph, id: string): string {
  return graphStepLabels(graph)[id] ?? "Sự kiện không có trong ảnh chụp dữ liệu";
}
export function scoreExplanation(link: Link): string {
  if (link.score === null) return "Không có điểm đánh giá; xem bằng chứng để kiểm tra liên kết.";
  return `Điểm ${link.score.toFixed(3)} trên thang 0–1, dùng để hỗ trợ đánh giá liên kết; không phải xác suất liên kết chắc chắn đúng.`;
}

export function evidenceLabel(code: string): string {
  return code === "SHARED_STRONG_ID"
    ? "Hai bước có cùng mã định danh đối chiếu"
    : `Căn cứ được hệ thống ghi nhận: ${code}`;
}

export function abstentionLabel(code: string): string {
  const labels: { [code: string]: string | undefined } = {
    OUTCOME_UNKNOWN: "Kết quả bước chưa xác định; cần đối chiếu log nguồn.",
    OUTCOME_ACTION_MISMATCH: "Kết quả bước không phù hợp với hoạt động được ghi nhận.",
    NO_SHARED_STRONG_ID: "Không có mã định danh mạnh chung để nối hai bước.",
    AMBIGUOUS_MATCH: "Có nhiều bước phù hợp; chưa đủ căn cứ chọn liên kết.",
    CYCLE: "Liên kết tạo vòng lặp nên hệ thống không chọn.",
  };
  return Object.hasOwn(labels, code)
    ? (labels[code] ?? "Hệ thống chưa kết luận liên kết.")
    : "Hệ thống chưa kết luận liên kết; xem mã lý do trong chi tiết kỹ thuật.";
}
export function degradedLabel(code: string | null): string {
  const labels: { [code: string]: string | undefined } = {
    ai_timeout: "AI quá thời gian phản hồi; kết quả dùng luật.",
    ai_unavailable: "AI chưa sẵn sàng, kết quả dùng luật",
    ai_no_eligible_pairs: "Không có cặp đủ điều kiện gửi AI; kết quả dùng luật.",
    ai_invalid_response: "Phản hồi AI không hợp lệ; kết quả dùng luật.",
    ai_incompatible_model: "Mô hình AI không tương thích; kết quả dùng luật.",
    ai_baseline_only: "AI chỉ cung cấp kết quả nền; kết quả liên kết dùng luật.",
  };
  return code && Object.hasOwn(labels, code)
    ? (labels[code] ?? "Kết quả dùng phương án dự phòng.")
    : "Kết quả dùng phương án dự phòng; xem lý do gốc trong chi tiết kỹ thuật.";
}
