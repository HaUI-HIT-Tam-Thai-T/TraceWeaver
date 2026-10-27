import type { AxiosInstance } from "axios";
import { ApiError } from "../../services/apiError.ts";
import { meSchema, sourcesPageSchema, sourcesQuerySchema } from "./schemas.ts";
import type { Me, SourcesPage } from "./schemas.ts";

export type SourcesOptions = {
  signal?: AbortSignal;
  cursor?: string;
  limit?: number;
};

function invalidResponse() {
  return new ApiError({
    kind: "client",
    code: "INVALID_API_RESPONSE",
    message: "Dữ liệu dịch vụ không đúng định dạng. Vui lòng thử lại.",
  });
}

export function createWorkspaceService(client: Pick<AxiosInstance, "get">) {
  async function getMe(signal?: AbortSignal): Promise<Me> {
    const response = await client.get<unknown>("/api/v1/me", { signal });
    const result = meSchema.safeParse(response.data);
    if (!result.success) throw invalidResponse();
    return result.data;
  }

  async function listSources(
    workspaceId: string,
    options: SourcesOptions = {},
  ): Promise<SourcesPage> {
    const query = sourcesQuerySchema.safeParse({
      workspaceId,
      cursor: options.cursor,
      limit: options.limit ?? 50,
    });
    if (!query.success) {
      throw new ApiError({
        kind: "client",
        code: "INVALID_SOURCE_QUERY",
        message: "Tham số tải nguồn không hợp lệ.",
      });
    }
    const params = new URLSearchParams({ limit: String(query.data.limit) });
    if (query.data.cursor) params.set("cursor", query.data.cursor);
    const response = await client.get<unknown>(
      `/api/v1/workspaces/${query.data.workspaceId}/sources`,
      {
        params,
        signal: options.signal,
      },
    );
    const result = sourcesPageSchema.safeParse(response.data);
    if (
      !result.success ||
      result.data.items.some((source) => source.workspace_id !== workspaceId)
    )
      throw invalidResponse();
    return result.data;
  }

  return { getMe, listSources };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
