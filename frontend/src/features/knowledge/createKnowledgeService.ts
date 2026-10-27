import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { ApiError } from '../../services/apiError.ts';
import { knowledgeFiltersSchema, knowledgePageSchema } from './schemas.ts';
import type { KnowledgeFilters } from './schemas.ts';

export function createKnowledgeService(client: Pick<AxiosInstance, 'get'>) {
  async function listKnowledge(workspaceId: string, filters: KnowledgeFilters = { limit: 50 }, options: { cursor?: string; signal?: AbortSignal } = {}) {
    const parsed = knowledgeFiltersSchema.safeParse(filters);
    if (!z.uuid().safeParse(workspaceId).success || !parsed.success || (options.cursor !== undefined && !z.string().min(1).max(4096).safeParse(options.cursor).success)) {
      throw new ApiError({ kind: 'client', code: 'INVALID_KNOWLEDGE_INPUT', message: 'Workspace hoặc bộ lọc knowledge không hợp lệ.' });
    }
    const params = new URLSearchParams({ limit: String(parsed.data.limit) });
    if (parsed.data.q !== undefined) params.set('q', parsed.data.q);
    if (options.cursor !== undefined) params.set('cursor', options.cursor);
    const response = await client.get<unknown>(`/api/v1/workspaces/${workspaceId}/knowledge`, { params, signal: options.signal });
    const result = knowledgePageSchema.safeParse(response.data);
    if (!result.success || result.data.items.some(item => item.workspace_id !== workspaceId)) {
      throw new ApiError({ kind: 'client', code: 'INVALID_API_RESPONSE', message: 'Dữ liệu knowledge không đúng định dạng hoặc workspace.' });
    }
    return result.data;
  }
  return { listKnowledge };
}
export type KnowledgeService = ReturnType<typeof createKnowledgeService>;
