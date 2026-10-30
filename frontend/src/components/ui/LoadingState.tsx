import { Skeleton } from "./primitives/skeleton";

export function LoadingState({
  message = "Đang tải dữ liệu…",
  variant = "panel",
}: {
  message?: string;
  variant?: "panel" | "table" | "counters";
}) {
  return (
    <div role="status" aria-live="polite" className="ui-feedback space-y-4 text-muted">
      <p className="type-body-sm">{message}</p>
      <div
        aria-hidden="true"
        className={variant === "counters" ? "grid grid-cols-2 gap-4 lg:grid-cols-4" : "space-y-3"}
      >
        {Array.from(
          { length: variant === "table" ? 4 : variant === "counters" ? 4 : 2 },
          (_, index) => (
            <Skeleton key={index} className={variant === "counters" ? "h-24" : "h-5 w-full"} />
          ),
        )}
      </div>
    </div>
  );
}
