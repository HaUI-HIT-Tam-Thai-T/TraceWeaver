import type { AxiosInstance } from "axios";
import { z } from "zod";
import { ApiError } from "../../../services/apiError.ts";
import { graphSchema, runCreateSchema, runSchema } from "../schemas.ts";
import type { RunCreate } from "../schemas.ts";

const idSchema = z.uuid();
const keySchema = z.string().regex(/^[\x21-\x7e]{1,200}$/);
export const invalidRunResponse = () =>
  new ApiError({
    kind: "client",
    code: "INVALID_API_RESPONSE",
    message: "Dữ liệu reconstruction không đúng định dạng.",
  });
export function createReconstructionService(
  client: Pick<AxiosInstance, "get" | "post">,
) {
  const path = (workspaceId: string, runId?: string) => {
    if (
      !idSchema.safeParse(workspaceId).success ||
      (runId !== undefined && !idSchema.safeParse(runId).success)
    )
      throw invalidRunResponse();
    return `/api/v1/workspaces/${workspaceId}/runs${runId ? `/${runId}` : ""}`;
  };
  async function createRun(
    workspaceId: string,
    body: RunCreate,
    options: { idempotencyKey: string; signal?: AbortSignal },
  ) {
    const url = path(workspaceId);
    const parsed = runCreateSchema.safeParse(body);
    if (!parsed.success || !keySchema.safeParse(options.idempotencyKey).success)
      throw new ApiError({
        kind: "client",
        code: "INVALID_RUN_INPUT",
        message: "Thông tin tạo run không hợp lệ.",
      });
    const response = await client.post<unknown>(url, parsed.data, {
      signal: options.signal,
      headers: { "Idempotency-Key": options.idempotencyKey },
    });
    const result = runSchema.safeParse(response.data);
    if (
      !result.success ||
      result.data.root_event_id !== body.root_event_id ||
      result.data.mode !== body.mode
    )
      throw invalidRunResponse();
    // Poll only our canonical endpoint. Never follow untrusted Location, even if absolute.
    return result.data;
  }
  async function getRun(
    workspaceId: string,
    runId: string,
    signal?: AbortSignal,
  ) {
    const response = await client.get<unknown>(path(workspaceId, runId), {
      signal,
    });
    const result = runSchema.safeParse(response.data);
    if (!result.success || result.data.id !== runId) throw invalidRunResponse();
    return result.data;
  }
  async function getGraph(
    workspaceId: string,
    runId: string,
    signal?: AbortSignal,
  ) {
    const response = await client.get<unknown>(
      `${path(workspaceId, runId)}/graph`,
      { signal },
    );
    const result = graphSchema.safeParse(response.data);
    if (!result.success || result.data.run_id !== runId)
      throw invalidRunResponse();
    return result.data;
  }
  return { createRun, getRun, getGraph };
}
export type ReconstructionService = ReturnType<
  typeof createReconstructionService
>;
