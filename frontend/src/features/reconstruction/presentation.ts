import { actionLabel, eventTimeLabel, requestLabel } from '../events/presentation';
import { compareUtc } from '../events/schemas';
import type { Graph, Link, Run } from './schemas';

export function modeLabel(mode: Run['mode']): string { return mode === 'hybrid' ? 'Kết hợp luật và AI' : 'Theo luật'; }
export function runStatusLabel(status: Run['status']): string {
  return { queued: 'Đang chờ xử lý', running: 'Đang tái dựng', completed: 'Đã hoàn tất', failed: 'Xử lý thất bại' }[status];
}
export function reviewLabel(state: Link['review_state']): string { return { pending: 'Chờ duyệt', accepted: 'Đã chấp nhận', rejected: 'Đã từ chối' }[state]; }
export function orderedSteps(graph: Graph) {
  return [...graph.nodes].sort((a, b) => compareUtc(a.occurred_at, b.occurred_at) || a.event_id.localeCompare(b.event_id));
}
export function graphStepLabels(graph: Graph): { [id: string]: string | undefined } {
  const labels: { [id: string]: string | undefined } = {};
  orderedSteps(graph).forEach((node, index) => {
    labels[node.event_id] = `Bước ${index + 1}: ${actionLabel(node.action)} · ${requestLabel(node)} · ${eventTimeLabel(node.occurred_at)}`;
  });
  return labels;
}
export function graphStepLabel(graph: Graph, id: string): string {
  return graphStepLabels(graph)[id] ?? 'Sự kiện không có trong ảnh chụp dữ liệu';
}
export function scoreExplanation(link: Link): string {
  if (link.score === null) return 'Không có điểm đánh giá; xem bằng chứng để kiểm tra liên kết.';
  return `Điểm ${link.score.toFixed(3)} trên thang 0–1, dùng để hỗ trợ đánh giá liên kết; không phải xác suất liên kết chắc chắn đúng.`;
}

export function evidenceLabel(code: string): string {
  return code === 'SHARED_STRONG_ID' ? 'Hai bước có cùng mã định danh đối chiếu' : `Căn cứ được hệ thống ghi nhận: ${code}`;
}
