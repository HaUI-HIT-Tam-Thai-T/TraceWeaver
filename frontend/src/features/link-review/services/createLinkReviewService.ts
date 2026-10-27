import { z } from "zod";
import type { AxiosInstance } from "axios";
import { ApiError } from "../../../services/apiError.ts";
import { linkSchema } from "../../reconstruction/schemas.ts";
import {
  reviewCreateSchema,
  reviewSchema,
  manualLinkCreateSchema,
} from "../schemas.ts";
import type { ReviewCreate, ManualLinkCreate } from "../schemas.ts";

const invalidInput = () =>
  new ApiError({
    kind: "client",
    code: "INVALID_LINK_INPUT",
    message: "Thông tin link hoặc lý do không hợp lệ.",
  });
const invalidResponse = () =>
  new ApiError({
    kind: "client",
    code: "INVALID_API_RESPONSE",
    message:
      "Phản hồi thao tác link không đúng định dạng; kết quả chưa được xác nhận.",
  });
export function createLinkReviewService(client: Pick<AxiosInstance, "post">) {
  const path = (wid: string, rid: string, lid?: string) => {
    if (
      ![wid, rid, ...(lid === undefined ? [] : [lid])].every(
        (id) => z.uuid().safeParse(id).success,
      )
    )
      throw invalidInput();
    return `/api/v1/workspaces/${wid}/runs/${rid}/links${lid === undefined ? "" : `/${lid}/reviews`}`;
  };
  async function reviewLink(
    wid: string,
    rid: string,
    lid: string,
    body: ReviewCreate,
    signal?: AbortSignal,
  ) {
    const url = path(wid, rid, lid);
    const parsed = reviewCreateSchema.safeParse(body);
    if (!parsed.success) throw invalidInput();
    const response = await client.post<unknown>(url, parsed.data, { signal });
    const result = reviewSchema.safeParse(response.data);
    if (
      !result.success ||
      result.data.link_id !== lid ||
      result.data.decision !== parsed.data.decision ||
      result.data.link_version !== parsed.data.expected_version + 1
    )
      throw invalidResponse();
    return result.data;
  }
  async function createManualLink(
    wid: string,
    rid: string,
    body: ManualLinkCreate,
    signal?: AbortSignal,
  ) {
    const url = path(wid, rid);
    const parsed = manualLinkCreateSchema.safeParse(body);
    if (!parsed.success) throw invalidInput();
    const response = await client.post<unknown>(url, parsed.data, { signal });
    const result = linkSchema.safeParse(response.data);
    if (
      !result.success ||
      result.data.from_event_id !== body.from_event_id ||
      result.data.to_event_id !== body.to_event_id ||
      result.data.method !== "manual" ||
      result.data.review_state !== "pending" ||
      result.data.score !== null ||
      result.data.version !== 1
    )
      throw invalidResponse();
    return result.data;
  }
  return { reviewLink, createManualLink };
}
export type LinkReviewService = ReturnType<typeof createLinkReviewService>;
