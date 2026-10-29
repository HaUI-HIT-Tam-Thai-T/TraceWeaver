import { useState } from 'react';
import WorkspacesOutlined from '@mui/icons-material/WorkspacesOutlined';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Check from '@mui/icons-material/Check';
import { Button } from '../../../components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/primitives/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '../../../components/ui/primitives/command';

type WorkspacePickerProps = {
  workspaceIds: string[];
  selectedId: string | null;
  disabled: boolean;
  initializing: boolean;
  onSelect: (id: string) => boolean;
};

export function WorkspacePicker({ workspaceIds, selectedId, disabled, initializing, onSelect }: WorkspacePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = selectedId !== null && workspaceIds.includes(selectedId) ? selectedId : null;
  let label = 'Chọn workspace';
  if (initializing) label = 'Đang kiểm tra workspace…';
  else if (selected) label = `Workspace · ${selected.slice(0, 8)}…${selected.slice(-4)}`;
  return <Popover open={open && !disabled} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button id="workspace-picker" role="combobox" aria-label="Chọn workspace" aria-haspopup="dialog"
        aria-expanded={open && !disabled} aria-describedby={selected ? 'workspace-picker-current' : undefined}
        disabled={disabled} variant="secondary" title={selected ?? label}
        className="w-full justify-start gap-2 border border-white/30 bg-chrome-active text-white hover:bg-white hover:text-chrome focus-visible:ring-white/60">
        <WorkspacesOutlined aria-hidden="true" sx={{ fontSize: '1.25rem' }} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <KeyboardArrowDown aria-hidden="true" sx={{ fontSize: '1.25rem' }} className="shrink-0" />
      </Button>
    </PopoverTrigger>
    {selected && <span id="workspace-picker-current" className="sr-only">Workspace hiện tại: {selected}</span>}
    <PopoverContent aria-label="Chọn workspace" align="start" collisionPadding={16}
      className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
      <Command label="Tìm workspace" filter={(value, search) => value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0}>
        <CommandInput aria-label="Tìm workspace" placeholder="Tìm theo UUID workspace…" maxLength={255} />
        <CommandList label="Workspaces được cấp">
          <CommandEmpty>Không tìm thấy workspace.</CommandEmpty>
          {workspaceIds.map(id => <CommandItem key={id} value={id} data-current={id === selected || undefined}
            onSelect={() => {
              if (disabled) return;
              if (id === selected || onSelect(id)) setOpen(false);
            }}>
            <Check aria-hidden="true" sx={{ fontSize: '1.25rem' }} className={id === selected ? 'shrink-0 text-primary' : 'shrink-0 opacity-0'} />
            <span className="min-w-0 break-all font-mono text-xs leading-5">{id}</span>
            {id === selected && <span className="sr-only">Workspace hiện tại</span>}
          </CommandItem>)}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
