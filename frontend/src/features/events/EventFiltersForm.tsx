import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useWorkspace } from '../workspace/workspaceContext'
import { useEvents } from './eventsContext'
import { eventFormSchema, formDefaults, formToFilters } from './query'
import type { EventFormValues } from './query'

export function EventFiltersForm() {
  const { state: workspace, loadMoreSources } = useWorkspace()
  const { state, setFilters } = useEvents()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema), defaultValues: formDefaults(state.filters),
  })
  useEffect(() => { reset(formDefaults(state.filters)) }, [state.filters, reset])
  const sources = workspace.sources
  const missingSource = state.filters.source_id && !sources.items.some((source) => source.id === state.filters.source_id)
  const fields = [
    { name: 'from', label: 'Từ (UTC+7)', type: 'datetime-local' },
    { name: 'to', label: 'Đến (UTC+7)', type: 'datetime-local' },
    { name: 'action', label: 'Action chính xác', type: 'text' },
    { name: 'q', label: 'Tìm trong message/action/identifier', type: 'search' },
  ] as const
  const inputClass = 'block w-full rounded border p-2 focus-visible:outline-2'
  return (
    <form className="my-6 space-y-3" onSubmit={handleSubmit((values) => setFilters(formToFilters(values)))}>
      <p>Múi giờ nhập: Asia/Ho_Chi_Minh (UTC+7). Bộ lọc chỉ áp dụng khi bấm Tìm kiếm.</p>
      <label className="block" htmlFor="event-source">Nguồn</label>
      <select id="event-source" className={inputClass} {...register('source_id')} aria-invalid={!!errors.source_id} aria-describedby={errors.source_id ? 'event-source-error' : undefined}>
        <option value="">Tất cả nguồn được phép đọc</option>
        {missingSource && <option value={state.filters.source_id}>{state.filters.source_id} (chưa có trong danh sách nguồn đã tải)</option>}
        {sources.items.map((source) => <option key={source.id} value={source.id}>{source.name} — {source.id}</option>)}
      </select>
      {errors.source_id && <p id="event-source-error" role="alert">{errors.source_id.message}</p>}
      {sources.nextCursor && <button className="rounded border px-3 py-2" type="button" disabled={sources.status === 'loading'} onClick={() => { void loadMoreSources() }}>Tải thêm nguồn cho bộ lọc</button>}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ name, label, type }) => <div key={name}>
          <label htmlFor={`event-${name}`}>{label}</label>
          <input id={`event-${name}`} type={type} step={type === 'datetime-local' ? 'any' : undefined}
            maxLength={name === 'action' ? 200 : name === 'q' ? 500 : undefined}
            className={inputClass} {...register(name)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `event-${name}-error` : undefined} />
          {errors[name] && <p role="alert" id={`event-${name}-error`}>{errors[name].message}</p>}
        </div>)}
      </div>
      <label htmlFor="event-limit">Số event mỗi trang</label>
      <select id="event-limit" className={inputClass} {...register('limit')}>
        <option value="25">25</option><option value="50">50</option><option value="100">100</option>
      </select>
      <button className="rounded border px-4 py-2 focus-visible:outline-2" type="submit" disabled={state.status === 'reauth'}>Tìm kiếm</button>
    </form>
  )
}
