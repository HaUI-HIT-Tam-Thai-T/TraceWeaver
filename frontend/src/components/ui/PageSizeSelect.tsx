import { Select } from './Select';
export function PageSizeSelect({ id, value, label, disabled, onChange }: { id: string; value: number; label: string; disabled: boolean; onChange: (value: 25 | 50 | 100) => void }) {
  return <div className="mr-auto flex flex-wrap items-center gap-2"><label htmlFor={id} className="type-body-sm">{label}</label>
    <Select id={id} value={value} disabled={disabled} className="w-24" onChange={event => {
      const next = Number(event.target.value); if (next === 25 || next === 50 || next === 100) onChange(next);
    }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></Select>
  </div>;
}
