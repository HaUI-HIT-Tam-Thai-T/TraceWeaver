import { useRef, useState } from 'react';
import type { Ref } from 'react';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import { Input } from './Input';
import { dateString, replaceCalendarDate, replaceCalendarTime, calendarDate } from './dateTimeCalendar';
import { Button } from './Button';
import { Popover, PopoverTrigger, PopoverContent } from './primitives/popover';

type Props = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
};

function TimeNumberInput({ label, value, max, onChange }: {
  label: string; value: string; max: number; onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className="type-caption block min-w-0 space-y-1 text-center">
    <span>{label}</span>
    <Input type="number" inputMode="numeric" min={0} max={max} step={1}
      aria-label={label} value={draft ?? value} className="px-2 text-center tabular-nums"
      onFocus={event => { setDraft(event.currentTarget.value); event.currentTarget.select(); }}
      onChange={event => {
        const next = event.target.value;
        setDraft(next);
        if (/^\d{1,2}$/.test(next) && Number(next) <= max) onChange(next.padStart(2, '0'));
      }}
      onBlur={() => {
        if (draft && /^\d+$/.test(draft)) onChange(String(Math.min(max, Number(draft))).padStart(2, '0'));
        setDraft(null);
      }} />
  </label>;
}

export function DateTimeCalendar({ value, month, onMonthChange, onChange, onClose }: {
  value: string; month: Date; onMonthChange: (month: Date) => void;
  onChange: (value: string) => void; onClose: () => void;
}) {
  const first = calendarDate(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const count = calendarDate(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const [time = ''] = (value.split('T')[1] ?? '').split('.');
  const [hour = '00', minute = '00', second = '00'] = time ? time.split(':') : [];
  const fraction = value.split('.')[1] ?? '';
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" className="h-8 min-h-8 py-1" aria-label="Tháng trước" disabled={month.getFullYear() === 1 && month.getMonth() === 0}
        onClick={() => onMonthChange(calendarDate(month.getFullYear(), month.getMonth() - 1, 1))}>‹</Button>
      <p className="type-label" aria-live="polite">Tháng {month.getMonth() + 1} / {month.getFullYear()}</p>
      <Button variant="ghost" className="h-8 min-h-8 py-1" aria-label="Tháng sau" disabled={month.getFullYear() === 9999 && month.getMonth() === 11}
        onClick={() => onMonthChange(calendarDate(month.getFullYear(), month.getMonth() + 1, 1))}>›</Button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center">
      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <span className="type-caption text-muted" key={day}>{day}</span>)}
      {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
      {Array.from({ length: count }, (_, index) => {
        const day = dateString(calendarDate(month.getFullYear(), month.getMonth(), index + 1));
        const selected = value.slice(0, 10) === day;
        return <Button key={day} className="h-8 min-h-8 min-w-0 px-1 py-1" variant={selected ? 'primary' : 'ghost'}
          aria-label={`Chọn ngày ${day}`} aria-pressed={selected}
          onClick={() => onChange(replaceCalendarDate(value, day))}>{index + 1}</Button>;
      })}
    </div>
    <fieldset className="min-w-0 space-y-3 border-0 p-0" disabled={!value}>
      <legend className="type-label mb-2">Thời gian (UTC+7)</legend>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2">
        <TimeNumberInput label="Giờ" value={hour} max={23} onChange={next => onChange(replaceCalendarTime(value, 'hour', next))} />
        <span className="pb-2 text-muted" aria-hidden="true">:</span>
        <TimeNumberInput label="Phút" value={minute} max={59} onChange={next => onChange(replaceCalendarTime(value, 'minute', next))} />
        <span className="pb-2 text-muted" aria-hidden="true">:</span>
        <TimeNumberInput label="Giây" value={second} max={59} onChange={next => onChange(replaceCalendarTime(value, 'second', next))} />
      </div>
      <details>
        <summary className="type-caption cursor-pointer text-muted">Phần giây thập phân{fraction ? ` (.${fraction})` : ' (tùy chọn)'}</summary>
        <label className="type-caption block space-y-1 pt-2">
        <span>Chữ số sau dấu thập phân</span>
        <Input aria-label="Phần giây thập phân" inputMode="numeric" maxLength={6} placeholder="Ví dụ: 000001" value={fraction}
          onChange={event => onChange(replaceCalendarTime(value, 'fraction', event.target.value))} />
        </label>
      </details>
    </fieldset>
    {!value && <p className="type-caption text-muted">Chọn một ngày để chỉnh thời gian.</p>}
    <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t border-line bg-panel pt-3">
      <Button variant="ghost" onClick={() => onChange('')}>Xóa</Button>
      <Button variant="secondary" onClick={() => {
        const today = new Date();
        onMonthChange(calendarDate(today.getFullYear(), today.getMonth(), 1));
        onChange(replaceCalendarDate(value, dateString(today)));
      }}>Hôm nay</Button>
      <Button onClick={onClose}>Xong</Button>
    </div>
  </div>;
}

export function DateTimePicker({ id, name, label, value, onChange, onBlur, invalid, describedBy, inputRef }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const field = useRef<HTMLDivElement>(null);
  return <Popover open={open} onOpenChange={next => {
    if (next) {
      if (field.current && window.innerHeight - field.current.getBoundingClientRect().bottom < 480) {
        field.current.scrollIntoView({ block: 'start' });
      }
      const selected = value ? new Date(`${value.slice(0, 10)}T12:00:00`) : new Date();
      setMonth(Number.isFinite(selected.getTime()) ? selected : new Date());
    } else onBlur();
    setOpen(next);
  }}>
    <div ref={field} className="relative min-w-0 scroll-mt-24">
      <Input ref={inputRef} id={id} name={name} type="datetime-local" step="any" value={value}
        aria-invalid={invalid} aria-describedby={describedBy} onBlur={onBlur}
        onChange={event => onChange(event.target.value)}
        className="pr-14 [&::-webkit-calendar-picker-indicator]:hidden" />
      <PopoverTrigger asChild>
        <Button variant="ghost" className="absolute right-1 top-1/2 size-9 min-h-9 -translate-y-1/2 p-2"
          aria-label={`Mở lịch ${label}`}><CalendarMonthOutlined aria-hidden="true" fontSize="small" /></Button>
      </PopoverTrigger>
    </div>
    <PopoverContent align="end" side="bottom" avoidCollisions={false} sideOffset={8} aria-label={`Chọn ngày ${label}`}
      className="max-h-[min(36rem,var(--radix-popover-content-available-height))] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain">
      <DateTimeCalendar value={value} month={month} onMonthChange={setMonth} onChange={onChange} onClose={() => setOpen(false)} />
    </PopoverContent>
  </Popover>;
}
