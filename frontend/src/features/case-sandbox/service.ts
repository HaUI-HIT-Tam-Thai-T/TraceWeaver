import axios from "axios";
import type { AxiosInstance } from "axios";
import { z } from "zod";
import { ApiError, normalizeApiError } from "../../services/apiError.ts";
import { commandSchema, sandboxSchema, proofsSchema, proofSchema, labSchema } from "./schemas.ts";
import type { Command, Sandbox, Proofs, Proof, Lab } from "./schemas.ts";

const reasons: { [key: string]: string | undefined } = {
  VERSION_CONFLICT: "Phiên bản nguồn đã thay đổi. Đọc dữ liệu mới và xác nhận trước khi gửi tiếp.",
  RESOURCE_MISMATCH: "Image hoặc tài khoản không đúng tài nguyên gắn với hồ sơ.",
  ATTEMPT_LIMIT: "Yêu cầu đã đạt giới hạn số lần thực thi.",
  RAM_ALREADY_ALLOCATED: "Không thể giảm tổng RAM dưới lượng đang giữ chỗ.",
};
export function sandboxFailure(error: unknown): ApiError {
  const safe = normalizeApiError(error);
  if (axios.isAxiosError<unknown>(error) && safe.code === "LAB_COMMAND_REJECTED") {
    const body = z
      .object({ error: z.object({ message: z.string() }) })
      .safeParse(error.response?.data);
    const reason = body.success ? body.data.error.message : "";
    if (Object.hasOwn(reasons, reason))
      return new ApiError({
        kind: safe.kind,
        code: safe.code,
        status: safe.status,
        requestId: safe.requestId,
        message: reasons[reason] ?? safe.message,
      });
  }
  return safe;
}
const invalid = () =>
  new ApiError({
    kind: "client",
    code: "INVALID_API_RESPONSE",
    message: "Dữ liệu sandbox không đúng contract hoặc không khớp hồ sơ.",
  });
function root(wid: string, cid?: string) {
  if (!z.uuid().safeParse(wid).success || (cid !== undefined && !z.uuid().safeParse(cid).success))
    throw invalid();
  return `/api/v1/workspaces/${wid}${cid ? `/cases/${cid}` : ""}`;
}
export interface SandboxService {
  getSandbox(wid: string, cid: string, signal?: AbortSignal): Promise<Sandbox>;
  command(wid: string, cid: string, body: Command, signal?: AbortSignal): Promise<Sandbox>;
  getProofs(wid: string, cid: string, signal?: AbortSignal): Promise<Proofs>;
  verify(wid: string, cid: string, signal?: AbortSignal): Promise<Proof>;
  getLab(wid: string, signal?: AbortSignal): Promise<Lab>;
}
export function createSandboxService(client: Pick<AxiosInstance, "get" | "post">): SandboxService {
  return {
    async getSandbox(wid, cid, signal) {
      const response = await client.get<unknown>(`${root(wid, cid)}/sandbox`, { signal });
      const parsed = sandboxSchema.safeParse(response.data);
      if (!parsed.success || parsed.data.case_id !== cid) throw invalid();
      return parsed.data;
    },
    async command(wid, cid, body, signal) {
      const input = commandSchema.safeParse(body);
      if (!input.success) throw invalid();
      const response = await client.post<unknown>(
        `${root(wid, cid)}/sandbox/commands`,
        input.data,
        { signal },
      );
      const parsed = sandboxSchema.safeParse(response.data);
      if (
        !parsed.success ||
        parsed.data.case_id !== cid ||
        (body.action === "provision" && parsed.data.execution?.operation_id !== body.operation_id)
      )
        throw invalid();
      return parsed.data;
    },
    async getProofs(wid, cid, signal) {
      const response = await client.get<unknown>(`${root(wid, cid)}/verifications`, { signal });
      const parsed = proofsSchema.safeParse(response.data);
      if (!parsed.success || parsed.data.case_id !== cid) throw invalid();
      return parsed.data;
    },
    async verify(wid, cid, signal) {
      const response = await client.post<unknown>(
        `${root(wid, cid)}/verifications`,
        {},
        { signal },
      );
      const parsed = proofSchema.safeParse(response.data);
      if (!parsed.success || parsed.data.case_id !== cid) throw invalid();
      return parsed.data;
    },
    async getLab(wid, signal) {
      const response = await client.get<unknown>(`${root(wid)}/lab`, { signal });
      const parsed = labSchema.safeParse(response.data);
      if (!parsed.success) throw invalid();
      return parsed.data;
    },
  };
}
