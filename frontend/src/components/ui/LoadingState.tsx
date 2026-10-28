import { Spinner } from './primitives/spinner';

export function LoadingState({ message = 'Đang tải dữ liệu…' }: { message?: string }) {
  return <div role="status" className="ui-feedback type-body flex items-center gap-3 text-muted">
    <Spinner role="presentation" aria-hidden="true" aria-label={undefined} />
    <span className="min-w-0 break-words">{message}</span>
  </div>;
}
