import { cn } from "../../lib/utils";

type LoaderProps = { message?: string; className?: string };

export function Loader({ message = "Đang tải…", className }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex min-h-48 w-full flex-col items-center justify-center gap-4 px-4 py-8 text-center text-muted",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-9 shrink-0 rounded-full border-[3px] border-primary/20 border-t-primary motion-safe:animate-spin motion-reduce:animate-none"
      />
      <p className="type-body-sm">{message}</p>
    </div>
  );
}
