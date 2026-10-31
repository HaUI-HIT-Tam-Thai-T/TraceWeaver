import { endpoints } from "../../services/endpoints.ts";
import type { AxiosInstance } from "axios";
import { z } from "zod";
import { ApiError } from "../../services/apiError.ts";
import { compareUtc } from "../events/schemas.ts";
import { dashboardFiltersSchema, dashboardSchema } from "./schemas.ts";
import type { Dashboard, DashboardFilters } from "./schemas.ts";

export interface DashboardService {
  getDashboard(
    workspaceId: string,
    filters?: DashboardFilters,
    signal?: AbortSignal,
  ): Promise<Dashboard>;
}

export function createDashboardService(client: Pick<AxiosInstance, "get">): DashboardService {
  async function getDashboard(
    workspaceId: string,
    filters: DashboardFilters = {},
    signal?: AbortSignal,
  ): Promise<Dashboard> {
    const parsed = dashboardFiltersSchema.safeParse(filters);
    if (!z.uuid().safeParse(workspaceId).success || !parsed.success)
      throw new ApiError({
        kind: "client",
        code: "INVALID_DASHBOARD_INPUT",
        message: "Workspace hoặc khoảng thời gian không hợp lệ.",
      });
    const response = await client.get<unknown>(endpoints.dashboard(workspaceId), {
      params: new URLSearchParams(parsed.data),
      signal,
    });
    const result = dashboardSchema.safeParse(response.data);
    if (
      !result.success ||
      (["from", "to"] as const).some((key) => {
        const expected = parsed.data[key],
          actual = result.data.filters[key];
        return expected === undefined
          ? actual !== undefined
          : actual === undefined || compareUtc(expected, actual) !== 0;
      })
    )
      throw new ApiError({
        kind: "client",
        code: "INVALID_API_RESPONSE",
        message: "Dữ liệu dashboard hoặc khoảng thời gian phản hồi không hợp lệ.",
      });
    return result.data;
  }
  return { getDashboard };
}
