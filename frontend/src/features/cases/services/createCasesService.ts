import { z } from "zod";
import type { AxiosInstance } from "axios";
import { ApiError } from "../../../services/apiError.ts";
import { caseAssigneesSchema, evidenceCreateSchema, evidenceSchema } from "../schemas.ts";
import type { CaseAssignees } from '../schemas.ts';
import type { Evidence, EvidenceCreate } from "../schemas.ts";
import { transitionSchema, transitionStates } from "../workflow.ts";
import type { CaseTransition } from "../workflow.ts";
import {
  caseCreateSchema,
  caseSchema,
  caseDetailSchema,
  casesPageSchema,
  caseFiltersSchema,
} from "../schemas.ts";
import type {
  Case,
  CaseCreate,
  CaseDetail,
  CaseFilters,
  CasesPage,
} from "../schemas.ts";

export type CaseMutationOptions = {
  idempotencyKey: string;
  signal?: AbortSignal;
};
export type CasesOptions = {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
};

export interface CasesService {
  listAssignees(workspaceId: string, caseId: string, signal?: AbortSignal): Promise<CaseAssignees>;
  createCase(
    workspaceId: string,
    body: CaseCreate,
    options: CaseMutationOptions,
  ): Promise<Case>;
  listCases(
    workspaceId: string,
    filters: CaseFilters,
    options?: CasesOptions,
  ): Promise<CasesPage>;
  getCase(
    workspaceId: string,
    caseId: string,
    signal?: AbortSignal,
  ): Promise<CaseDetail>;
  addEvidence(
    workspaceId: string,
    caseId: string,
    body: EvidenceCreate,
    signal?: AbortSignal,
  ): Promise<Evidence>;
  transitionCase(
    workspaceId: string,
    caseId: string,
    body: CaseTransition,
    options: CaseMutationOptions,
  ): Promise<Case>;
}

export const invalidCaseInput = () =>
  new ApiError({
    kind: "client",
    code: "INVALID_CASE_INPUT",
    message: "Thông tin case hoặc bộ lọc không hợp lệ.",
  });
const invalidResponse = () =>
  new ApiError({
    kind: "client",
    code: "INVALID_API_RESPONSE",
    message: "Dữ liệu case không đúng định dạng.",
  });
export function createCasesService(
  client: Pick<AxiosInstance, "get" | "post">,
): CasesService {
  function path(wid: string, cid?: string) {
    if (
      ![wid, ...(cid === undefined ? [] : [cid])].every(
        (value) => z.uuid().safeParse(value).success,
      )
    )
      throw invalidCaseInput();
    return `/api/v1/workspaces/${wid}/cases${cid === undefined ? "" : `/${cid}`}`;
  }
  async function createCase(
    wid: string,
    body: CaseCreate,
    options: CaseMutationOptions,
  ): Promise<Case> {
    const url = path(wid);
    const parsed = caseCreateSchema.safeParse(body);
    if (!parsed.success || !/^[\x21-\x7e]{1,200}$/.test(options.idempotencyKey))
      throw invalidCaseInput();
    const response = await client.post<unknown>(url, parsed.data, {
      signal: options.signal,
      headers: { "Idempotency-Key": options.idempotencyKey },
    });
    const result = caseSchema.safeParse(response.data);
    if (
      !result.success ||
      result.data.workspace_id !== wid ||
      result.data.run_id !== body.run_id
    )
      throw invalidResponse();
    return result.data;
  }
  async function listCases(
    wid: string,
    filters: CaseFilters,
    options: CasesOptions = {},
  ): Promise<CasesPage> {
    const url = path(wid);
    const parsed = caseFiltersSchema.safeParse({
      ...filters,
      limit: options.limit ?? filters.limit,
    });
    if (
      !parsed.success ||
      (options.cursor !== undefined &&
        !z.string().min(1).max(4096).safeParse(options.cursor).success)
    )
      throw invalidCaseInput();
    const params = new URLSearchParams({ limit: String(parsed.data.limit) });
    for (const key of ["state", "owner_id", "from", "to"] as const) {
      const value = parsed.data[key];
      if (value !== undefined) params.set(key, value);
    }
    if (options.cursor !== undefined) params.set("cursor", options.cursor);
    const response = await client.get<unknown>(url, {
      signal: options.signal,
      params,
    });
    const result = casesPageSchema.safeParse(response.data);
    if (
      !result.success ||
      result.data.items.some((item) => item.workspace_id !== wid)
    )
      throw invalidResponse();
    return result.data;
  }
  async function getCase(
    wid: string,
    cid: string,
    signal?: AbortSignal,
  ): Promise<CaseDetail> {
    const response = await client.get<unknown>(path(wid, cid), { signal });
    const result = caseDetailSchema.safeParse(response.data);
    if (
      !result.success ||
      result.data.case.workspace_id !== wid ||
      result.data.case.id !== cid
    )
      throw invalidResponse();
    return result.data;
  }
  async function addEvidence(
    wid: string,
    cid: string,
    body: EvidenceCreate,
    signal?: AbortSignal,
  ): Promise<Evidence> {
    const url = `${path(wid, cid)}/evidence`;
    const parsed = evidenceCreateSchema.safeParse(body);
    if (!parsed.success) throw invalidCaseInput();
    const response = await client.post<unknown>(url, parsed.data, { signal });
    const result = evidenceSchema.safeParse(response.data);
    if (
      !result.success ||
      result.data.case_id !== cid ||
      result.data.kind !== parsed.data.kind ||
      result.data.event_ids.length !== parsed.data.event_ids.length ||
      result.data.event_ids.some((id) => !parsed.data.event_ids.includes(id))
    )
      throw invalidResponse();
    return result.data;
  }
  async function transitionCase(
    wid: string,
    cid: string,
    body: CaseTransition,
    options: CaseMutationOptions,
  ): Promise<Case> {
    const url = `${path(wid, cid)}/transitions`;
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success || !/^[\x21-\x7e]{1,200}$/.test(options.idempotencyKey))
      throw invalidCaseInput();
    const response = await client.post<unknown>(url, parsed.data, {
      signal: options.signal,
      headers: { "Idempotency-Key": options.idempotencyKey },
    });
    const result = caseSchema.safeParse(response.data);
    if (
      !result.success ||
      result.data.id !== cid ||
      result.data.workspace_id !== wid ||
      result.data.version !== parsed.data.expected_version + 1 ||
      result.data.state !== transitionStates[parsed.data.action].to ||
      (parsed.data.action === "assign" &&
        result.data.owner_id !== parsed.data.owner_id)
    )
      throw invalidResponse();
    return result.data;
  }
  async function listAssignees(wid: string, cid: string, signal?: AbortSignal): Promise<CaseAssignees> {
    const response = await client.get<unknown>(`${path(wid, cid)}/assignees`, { signal });
    const result = caseAssigneesSchema.safeParse(response.data);
    if (!result.success) throw invalidResponse();
    return result.data;
  }
  return { createCase, listCases, getCase, addEvidence, transitionCase, listAssignees };
}
