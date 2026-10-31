import { z } from "zod";
import type { CaseDetail, WorkflowHistory } from "../../types/cases.ts";
import type { CasesScope } from "./state/state.ts";

export const caseActionSchema = z.enum([
  "assign",
  "start",
  "request_verification",
  "verify_close",
  "verification_failed",
  "reopen",
]);
export type CaseAction = z.infer<typeof caseActionSchema>;
export const transitionSchema = z
  .strictObject({
    action: caseActionSchema,
    expected_version: z.number().int().min(1),
    reason: z
      .string()
      .trim()
      .min(1, "Nhập lý do có nội dung.")
      .max(1000, "Lý do tối đa 1.000 ký tự."),
    owner_id: z.string().min(1).max(255).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "assign" && !value.owner_id)
      ctx.addIssue({
        code: "custom",
        path: ["owner_id"],
        message: "Chọn người xử lý hoặc Giao cho tôi từ danh sách đủ điều kiện.",
      });
    if (value.action !== "assign" && value.owner_id !== undefined)
      ctx.addIssue({
        code: "custom",
        path: ["owner_id"],
        message: "Chỉ assign được gửi owner_id.",
      });
  });
export type CaseTransition = z.infer<typeof transitionSchema>;
export const transitionStates = {
  assign: { from: "new", to: "assigned" },
  start: { from: "assigned", to: "investigating" },
  request_verification: { from: "investigating", to: "awaiting_verification" },
  verify_close: { from: "awaiting_verification", to: "closed" },
  verification_failed: { from: "awaiting_verification", to: "investigating" },
  reopen: { from: "closed", to: "investigating" },
} as const;
export function lastCloseReason(detail: CaseDetail): string | null {
  const entry = detail.history
    .filter((item) => item.action === "verify_close")
    .reduce<WorkflowHistory | null>(
      (last, item) => (!last || item.version > last.version ? item : last),
      null,
    );
  return entry?.reason ?? null;
}
export function transitionIssue(
  detail: CaseDetail,
  scope: CasesScope,
  action: CaseAction,
  reason = "",
  pendingCount: number | null = null,
): string | null {
  if (!scope.canWrite) return "Vai trò hiện tại không có quyền chuyển trạng thái.";
  if (detail.case.state !== transitionStates[action].from)
    return "Thao tác không phù hợp với trạng thái hồ sơ hiện tại.";
  const reviewer = scope.canVerify === true;
  if (["verify_close", "verification_failed", "reopen"].includes(action) && !reviewer)
    return "Thao tác này cần người có quyền xác minh (reviewer).";
  if (action !== "assign" && !detail.case.owner_id)
    return "Hồ sơ chưa được giao người xử lý. Hãy giao hồ sơ trước; hệ thống sẽ kiểm tra quyền của người nhận.";
  if (
    ["start", "request_verification"].includes(action) &&
    !reviewer &&
    detail.case.owner_id !== scope.subject
  )
    return "Chỉ người đang xử lý hồ sơ hoặc người có quyền xác minh (reviewer) được thực hiện.";
  if (["request_verification", "verify_close"].includes(action)) {
    if (detail.evidence.length === 0)
      return "Cần lưu ít nhất một bằng chứng trước khi gửi xác minh.";
    if (!detail.evidence.some((item) => /\S/.test(item.note)))
      return "Hãy lưu một ghi chú xử lý trong bằng chứng. Lý do chuyển trạng thái không thay thế ghi chú này.";
  }
  if (action === "verify_close" && pendingCount !== null && pendingCount > 0)
    return "Kết quả tái dựng còn liên kết chờ duyệt. Hãy duyệt hết trước khi đóng hồ sơ.";
  if (action === "reopen" && reason.trim() && reason.trim() === lastCloseReason(detail)?.trim())
    return "Lý do mở lại phải khác lý do đóng hồ sơ gần nhất.";
  return null;
}
