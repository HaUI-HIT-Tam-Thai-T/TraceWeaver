import axios, { AxiosHeaders } from "axios";
import { z } from "zod";

export type ApiErrorKind = "http" | "network" | "timeout" | "auth" | "client";

type ApiErrorOptions = {
  kind: ApiErrorKind;
  code: string;
  message: string;
  status?: number | null;
  requestId?: string | null;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly code: string;
  readonly status: number | null;
  readonly requestId: string | null;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.code = options.code;
    this.status = options.status ?? null;
    this.requestId = options.requestId ?? null;
  }
}

const errorCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/);
const requestIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/);
const errorBodySchema = z.object({
  error: z
    .object({ code: errorCodeSchema.optional().catch(undefined) })
    .optional()
    .catch(undefined),
  request_id: requestIdSchema.optional().catch(undefined),
});

function httpMessage(status: number) {
  switch (status) {
    case 401:
      return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
    case 403:
      return "Bạn không có quyền thực hiện thao tác này.";
    case 404:
      return "Không tìm thấy dữ liệu hoặc dữ liệu không còn trong phạm vi truy cập.";
    case 409:
      return "Thao tác gặp xung đột. Vui lòng tải lại dữ liệu để kiểm tra.";
    case 422:
      return "Dữ liệu hoặc điều kiện thực hiện thao tác chưa hợp lệ.";
    case 429:
      return "Có quá nhiều yêu cầu. Vui lòng thử lại sau.";
    default:
      return status >= 500
        ? "Dịch vụ đang gặp sự cố. Vui lòng thử lại sau."
        : "Không thể thực hiện yêu cầu. Vui lòng kiểm tra dữ liệu.";
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError<unknown, unknown>(error)) {
    if (error.response) {
      const { status, data, headers } = error.response;
      const body = errorBodySchema.safeParse(data);
      const headerValue =
        headers instanceof AxiosHeaders
          ? headers.get("X-Request-ID")
          : Object.entries(headers).find(([name]) => name.toLowerCase() === "x-request-id")?.[1];
      const headerId = requestIdSchema.safeParse(headerValue);
      return new ApiError({
        kind: status === 401 ? "auth" : "http",
        status,
        code: (body.success && body.data.error?.code) || `HTTP_${status}`,
        requestId:
          (body.success && body.data.request_id) || (headerId.success ? headerId.data : null),
        message: httpMessage(status),
      });
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return new ApiError({
        kind: "timeout",
        code: "TIMEOUT",
        message: "Yêu cầu đã quá thời gian chờ.",
      });
    }
    if (error.code === "ERR_NETWORK" || error.request) {
      return new ApiError({
        kind: "network",
        code: "NETWORK_ERROR",
        message: "Không thể kết nối đến dịch vụ. Vui lòng kiểm tra kết nối và thử lại.",
      });
    }
  }
  return new ApiError({
    kind: "client",
    code: "CLIENT_ERROR",
    message: "Không thể chuẩn bị yêu cầu.",
  });
}
