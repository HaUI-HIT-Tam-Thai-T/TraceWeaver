import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/primitives/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '../../../components/ui/primitives/command';
import { roleLabel } from '../../workspace/presentation';
import type { CasesState } from '../state/state';

type Props = {
  state: CasesState['assignees'];
  selected: string | undefined;
  disabled: boolean;
  load: () => Promise<void>;
  onSelect: (subject: string) => void;
};
export function CaseAssigneePicker({ state, selected, disabled, load, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const items = state.items.filter(item => item.roles.some(role => role === 'operator' || role === 'reviewer'));
  return <Popover open={open && !disabled} onOpenChange={next => {
    setOpen(next);
    if (next && !disabled) void load();
  }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="secondary" role="combobox" aria-label="Chọn người xử lý"
        aria-expanded={open && !disabled} aria-haspopup="dialog" disabled={disabled}
        className="w-full justify-start whitespace-normal break-all text-left">
        {selected || 'Chọn người xử lý'}
      </Button>
    </PopoverTrigger>
    <PopoverContent aria-label="Người đủ điều kiện nhận hồ sơ" align="start"
      className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-2">
      {state.status === 'loading' && <p role="status">Đang tải người nhận…</p>}
      {state.status === 'error' && <div role="alert"><p>{state.error?.message ?? 'Chưa tải được danh sách người nhận.'}</p>
        <Button type="button" variant="secondary" onClick={() => void load()}>Thử tải lại</Button></div>}
      {state.status === 'idle' && <p role="status">Chưa tải danh sách người nhận. Hãy mở lại khi hồ sơ sẵn sàng.</p>}
      {state.status === 'ready' && <Command label="Tìm người xử lý"
        filter={(value, search) => value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0}>
        <CommandInput aria-label="Tìm mã tài khoản" placeholder="Tìm mã tài khoản…" maxLength={255} />
        <CommandList label="Người nhận">
          <CommandEmpty>{items.length === 0 ? 'Không có người nhận đủ điều kiện.' : 'Không tìm thấy người nhận.'}</CommandEmpty>
          {items.map(item => <CommandItem key={item.subject} value={item.subject} onSelect={() => {
            if (disabled) return;
            onSelect(item.subject); setOpen(false);
          }}>
            <span className="min-w-0 break-all">{item.subject}<span className="block text-xs text-muted">{item.roles.map(roleLabel).join(' · ')}</span></span>
          </CommandItem>)}
        </CommandList>
      </Command>}
    </PopoverContent>
  </Popover>;
}
