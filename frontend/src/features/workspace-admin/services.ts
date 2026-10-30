import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import { ApiError } from '../../services/apiError.ts';
import { addMemberSchema, updateMemberSchema, sourceGrantSchema, accountCreateSchema, membersPageSchema, memberResultSchema, updateResultSchema, grantResultSchema, completedSchema, operationSchema, subjectSchema } from './schemas.ts';
import type { AddMember, UpdateMember, SourceGrant, AccountCreate } from './schemas.ts';

const invalid = () => new ApiError({ kind: 'client', code: 'INVALID_ADMIN_INPUT', message: 'Thông tin quản trị không hợp lệ.' });
const badResponse = () => new ApiError({ kind: 'client', code: 'INVALID_API_RESPONSE', message: 'Dữ liệu quản trị không đúng định dạng. Hãy đối chiếu trạng thái trước khi gửi tiếp.' });
function root(wid: string) {
  if (!z.uuid().safeParse(wid).success) throw invalid();
  return `/api/v1/workspaces/${wid}/admin`;
}
function target(subject: string) {
  if (!subjectSchema.safeParse(subject).success || subject === '.' || subject === '..') throw invalid();
  return encodeURIComponent(subject);
}
function keyHeaders(key: string) {
  if (!/^[\x21-\x7e]{1,200}$/.test(key)) throw invalid();
  return { 'Idempotency-Key': key, 'Content-Type': 'application/json' };
}
const sameRoles = (left: string[], right: string[]) => left.length === right.length && left.every(role => right.includes(role));
export function createWorkspaceAdminService(client: Pick<AxiosInstance, 'get' | 'post' | 'put'>) {
  return {
    async list(wid: string, after?: string, signal?: AbortSignal) {
      const url = root(wid);
      if (after !== undefined && !subjectSchema.safeParse(after).success) throw invalid();
      const params = new URLSearchParams({ limit: '50' });
      if (after !== undefined) params.set('after', after);
      const response = await client.get<unknown>(`${url}/members`, { params, signal });
      const result = membersPageSchema.safeParse(response.data);
      if (!result.success || result.data.workspace_id !== wid || (result.data.next_after !== null && result.data.next_after !== result.data.items.at(-1)?.subject) || (after !== undefined && result.data.next_after === after)) throw badResponse();
      return result.data;
    },
    async add(wid: string, body: AddMember, signal?: AbortSignal) {
      const parsed = addMemberSchema.safeParse(body); if (!parsed.success) throw invalid();
      const response = await client.post<unknown>(`${root(wid)}/members`, parsed.data, { signal });
      const result = memberResultSchema.safeParse(response.data);
      if (!result.success || result.data.subject !== body.subject || !result.data.active || result.data.version !== body.expected_version + 1 || !sameRoles(result.data.roles, body.roles)) throw badResponse();
      return result.data;
    },
    async update(wid: string, subject: string, body: UpdateMember, signal?: AbortSignal) {
      const parsed = updateMemberSchema.safeParse(body); if (!parsed.success) throw invalid();
      const response = await client.put<unknown>(`${root(wid)}/members/${target(subject)}`, parsed.data, { signal });
      const result = updateResultSchema.safeParse(response.data);
      if (!result.success || result.data.subject !== subject || result.data.active !== body.active || result.data.expected_version !== body.expected_version || result.data.version !== body.expected_version + 1 || !sameRoles(result.data.roles, body.roles)) throw badResponse();
      return result.data;
    },
    async grant(wid: string, subject: string, sid: string, body: SourceGrant, signal?: AbortSignal) {
      const parsed = sourceGrantSchema.safeParse(body); if (!parsed.success || !z.uuid().safeParse(sid).success) throw invalid();
      const response = await client.put<unknown>(`${root(wid)}/members/${target(subject)}/sources/${sid}`, parsed.data, { signal });
      const result = grantResultSchema.safeParse(response.data);
      if (!result.success || result.data.subject !== subject || result.data.source_id !== sid || result.data.enabled !== body.enabled || result.data.version !== body.expected_version + 1) throw badResponse();
      return result.data;
    },
    async createAccount(wid: string, body: AccountCreate, key: string, signal?: AbortSignal) {
      const parsed = accountCreateSchema.safeParse(body); if (!parsed.success) throw invalid();
      const response = await client.post<unknown>(`${root(wid)}/accounts`, parsed.data, { signal, headers: keyHeaders(key) });
      const result = completedSchema.safeParse(response.data);
      if (!result.success || result.data.username !== body.username || !sameRoles(result.data.roles, body.roles)) throw badResponse();
      return result.data;
    },
    async operation(wid: string, key: string, signal?: AbortSignal) {
      const response = await client.get<unknown>(`${root(wid)}/accounts/provisioning`, { signal, headers: keyHeaders(key) });
      const result = operationSchema.safeParse(response.data);
      if (!result.success) throw badResponse();
      return result.data;
    },
  };
}
export type WorkspaceAdminService = {
  list: (wid: string, after?: string, signal?: AbortSignal) => Promise<import('./schemas.ts').MembersPage>;
  add: (wid: string, body: AddMember, signal?: AbortSignal) => Promise<z.infer<typeof memberResultSchema>>;
  update: (wid: string, subject: string, body: UpdateMember, signal?: AbortSignal) => Promise<z.infer<typeof updateResultSchema>>;
  grant: (wid: string, subject: string, sid: string, body: SourceGrant, signal?: AbortSignal) => Promise<z.infer<typeof grantResultSchema>>;
  createAccount: (wid: string, body: AccountCreate, key: string, signal?: AbortSignal) => Promise<import('./schemas.ts').Completed>;
  operation: (wid: string, key: string, signal?: AbortSignal) => Promise<import('./schemas.ts').Operation>;
};
