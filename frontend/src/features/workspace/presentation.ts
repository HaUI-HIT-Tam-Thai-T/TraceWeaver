import type { Membership } from "../../types/workspace";
export function roleLabel(role: Membership["roles"][number]): string {
  return {
    viewer: "Người xem",
    operator: "Người xử lý",
    reviewer: "Người xác minh",
    admin: "Quản trị workspace",
    ingest_service: "Dịch vụ nhập dữ liệu",
  }[role];
}
