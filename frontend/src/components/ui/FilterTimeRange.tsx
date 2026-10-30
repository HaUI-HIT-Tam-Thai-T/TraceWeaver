import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
export function FilterTimeRange({ id, expanded = false, hasError = false, children }: { id: string; expanded?: boolean; hasError?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(expanded);
  const visible = open || hasError;
  return <div className="filter-time-range min-w-0">
    <Button type="button" variant="secondary" className="w-full justify-between md:hidden" aria-expanded={visible} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {visible ? 'Bộ lọc thời gian (UTC+7)' : 'Mở bộ lọc thời gian (UTC+7)'}
    </Button>
    <div id={id} className={`${visible ? 'grid' : 'hidden'} min-w-0 grid-cols-1 gap-3 pt-3 sm:grid-cols-2 md:grid md:pt-0`}>{children}</div>
  </div>;
}
