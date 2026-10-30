// Used primitives adapted from the official shadcn Command source:
// https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/command.tsx
// MUI replaces Lucide; CommandDialog is not needed by the workspace picker.
import type { ComponentProps } from "react";
import { Command as CommandPrimitive } from "cmdk";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { cn } from "../../../lib/utils";

export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-panel text-foreground",
        className,
      )}
      {...props}
    />
  );
}
export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex min-h-11 items-center gap-2 border-b border-line px-3"
    >
      <SearchOutlined
        aria-hidden="true"
        sx={{ fontSize: "1.25rem" }}
        className="shrink-0 text-muted"
      />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "min-h-11 w-full min-w-0 bg-transparent py-3 text-base outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}
export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-[min(18rem,var(--radix-popover-content-available-height))] scroll-py-1 overflow-x-hidden overflow-y-auto p-1",
        className,
      )}
      {...props}
    />
  );
}
export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="px-3 py-6 text-center text-sm text-muted"
      {...props}
    />
  );
}
export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-control data-[selected=true]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
