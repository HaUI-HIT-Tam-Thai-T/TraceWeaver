import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { knowledgeFormDefaults, knowledgeFormSchema } from '../query';
import type { KnowledgeFormValues } from '../query';
import type { KnowledgeFilters } from '../schemas';
import type { KnowledgeState } from '../state/controller';

export function KnowledgeSearchForm({ filters, apply }: { filters: KnowledgeFilters; apply: (filters: KnowledgeFilters) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<KnowledgeFormValues>({ resolver: zodResolver(knowledgeFormSchema), defaultValues: knowledgeFormDefaults(filters) });
  return <form aria-label="Tìm kiếm knowledge" className="my-4 space-y-3" onSubmit={handleSubmit(values => apply({ limit: Number(values.limit), ...(values.q !== '' ? { q: values.q } : {}) }))}>
    <label className="block" htmlFor="knowledge-q">Tìm trong tiêu đề và nội dung</label>
    <input id="knowledge-q" {...register('q')} maxLength={500} aria-invalid={!!errors.q} aria-describedby="knowledge-search-help knowledge-q-error" />
    {errors.q && <p id="knowledge-q-error" role="alert">{errors.q.message}</p>}
    <p id="knowledge-search-help">Bấm Tìm kiếm để áp dụng. Tìm chuỗi con, không phân biệt hoa/thường, trên phiên bản mới nhất.</p>
    <label className="block" htmlFor="knowledge-limit">Số bài mỗi trang</label>
    <select id="knowledge-limit" {...register('limit')}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select>
    <button type="submit">Tìm kiếm</button>
  </form>;
}
export function KnowledgeResults({ state, refresh, previous, next, signIn }: {
  state: KnowledgeState; refresh: () => void; previous: () => void; next: () => void; signIn: () => void;
}) {
  const ready = state.status === 'ready';
  return <section aria-label="Kết quả knowledge" className="space-y-4">
    <p>Chỉ đọc, hiển thị phiên bản mới nhất. Dữ liệu có thể thay đổi giữa các lần tải; không có tổng số trang.</p>
    <button type="button" disabled={['loading', 'invalid', 'reauth'].includes(state.status)} onClick={refresh}>Làm mới knowledge</button>
    <div aria-live="polite">
      {state.status === 'loading' && <p role="status">Đang tải knowledge…</p>}
      {state.error && <p role="alert">{state.error.message} {state.error.requestId && <>Request ID: {state.error.requestId}</>}</p>}
      {state.status === 'reauth' ? <button type="button" onClick={signIn}>Đăng nhập lại</button> : state.error && <button type="button" onClick={refresh}>{state.error.code === 'INVALID_CURSOR' ? 'Bắt đầu lại từ trang đầu' : 'Thử tải lại knowledge'}</button>}
      {ready && state.items.length === 0 && <p>Không có bài knowledge phù hợp.</p>}
    </div>
    {ready && state.items.map(item => <article key={item.id} className="space-y-2 border-b py-4">
      <h2 className="text-xl font-semibold">{item.title}</h2>
      <p>ID: {item.id} · Version: {item.version}</p>
      <p className="break-all">source_ref: {item.source_ref}</p>
      <p>Tác giả (subject): {item.author_subject}</p>
      <p>Tạo lúc (UTC gốc): <time dateTime={item.created_at}>{item.created_at}</time></p>
      <details><summary>Đọc nội dung</summary><pre className="whitespace-pre-wrap break-words">{item.body}</pre></details>
    </article>)}
    <nav aria-label="Phân trang knowledge" className="space-x-4">
      <button type="button" disabled={!ready || state.index === 0} onClick={previous}>Trước</button>
      <span>Trang {state.index + 1}</span>
      <button type="button" disabled={!ready || state.nextCursor === null} onClick={next}>Tiếp</button>
    </nav>
  </section>;
}
