import { Button } from "./Button";
import { Badge } from "./Badge";

export function FilterSummary({ items, onClear }: { items: string[]; onClear: () => void }) {
  return (
    <section
      aria-label="Điều kiện đang áp dụng"
      className="my-3 flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-line p-3"
    >
      <span className="type-label">Đang áp dụng:</span>
      {items.length ? (
        items.map((item) => (
          <Badge
            key={item}
            tone="info"
            className="min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
          >
            {item}
          </Badge>
        ))
      ) : (
        <span className="type-body-sm text-muted">Không giới hạn bộ lọc.</span>
      )}
      <Button variant="ghost" onClick={onClear}>
        Xóa bộ lọc
      </Button>
    </section>
  );
}
