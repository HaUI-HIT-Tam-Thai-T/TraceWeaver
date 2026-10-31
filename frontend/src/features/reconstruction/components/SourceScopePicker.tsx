import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { sourceName } from "../../events/presentation";

type Props = {
  rootSource: string;
  selected: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
  onBusy: (busy: boolean) => void;
};

export function SourceScopePicker({ rootSource, selected, disabled, onChange, onBusy }: Props) {
  const { state, loadMoreSources, refreshAccess } = useWorkspace();
  const sources = state.sources;
  const [all, setAll] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const cursors = useRef(new Set<string>());
  useEffect(() => {
    if (!all || disabled || sources.status === "loading") return;
    let canceled = false;

    async function selectLoadedSources() {
      await Promise.resolve();
      if (canceled) return;
      if (sources.status === "error" || sources.status === "idle") {
        setAll(false);
        onBusy(false);
        setIssue("Chưa tải đủ nguồn. Lựa chọn cũ được giữ; thử tải lại hoặc chọn nguồn đã tải.");
        return;
      }
      if (sources.nextCursor) {
        if (cursors.current.has(sources.nextCursor)) {
          setAll(false);
          onBusy(false);
          setIssue(
            "Danh sách nguồn chưa tải xong vì cursor bị lặp. Hãy kiểm tra quyền trước khi thử lại.",
          );
          return;
        }
        cursors.current.add(sources.nextCursor);
        void loadMoreSources();
        return;
      }
      onChange([...new Set([rootSource, ...sources.items.map((source) => source.id)])]);
      setAll(false);
      onBusy(false);
    }
    void selectLoadedSources();
    return () => {
      canceled = true;
    };
  }, [all, disabled, sources, rootSource, loadMoreSources, onChange, onBusy]);
  const missingRoot = !sources.items.some((item) => item.id === rootSource);
  return (
    <section aria-label="Phạm vi nguồn" className="space-y-3">
      <p>
        Chọn các nguồn có thể ghi nhận những bước liên quan, không chỉ nguồn của sự kiện bắt đầu.
        Chỉ log trong nguồn và khoảng thời gian đã chọn được dùng để tái dựng.
      </p>
      <fieldset disabled={disabled || all} className="space-y-2">
        <legend className="type-label">Nguồn được phép đọc — đã chọn {selected.length}</legend>
        {missingRoot && (
          <label className="flex items-center gap-2 break-all">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={selected.includes(rootSource)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, rootSource]
                    : selected.filter((id) => id !== rootSource),
                )
              }
            />
            Nguồn của sự kiện bắt đầu (chưa tải được tên): {rootSource}
          </label>
        )}
        {sources.items.map((source) => (
          <label key={source.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-primary"
              checked={selected.includes(source.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, source.id]
                    : selected.filter((id) => id !== source.id),
                )
              }
            />
            <span>
              {sourceName(source.name)}
              {source.id === rootSource && " · nguồn của sự kiện bắt đầu"}
            </span>
          </label>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              cursors.current.clear();
              setIssue(null);
              setAll(true);
              onBusy(true);
            }}
          >
            Chọn tất cả nguồn được phép đọc
          </Button>
          <Button variant="ghost" onClick={() => onChange([rootSource])}>
            Chỉ nguồn của sự kiện bắt đầu
          </Button>
        </div>
      </fieldset>
      {all && (
        <p role="status">
          Đang tải đủ các trang nguồn trước khi chọn tất cả…{" "}
          <Button
            variant="ghost"
            onClick={() => {
              setAll(false);
              onBusy(false);
            }}
          >
            Dừng chọn tất cả
          </Button>
        </p>
      )}
      {sources.nextCursor && !all && (
        <Button
          variant="secondary"
          disabled={disabled || sources.status === "loading"}
          onClick={() => {
            void loadMoreSources();
          }}
        >
          Tải thêm nguồn
        </Button>
      )}
      {issue && (
        <p role="alert" className="text-danger">
          {issue}
        </p>
      )}
      {sources.status === "error" && (
        <div>
          <p role="alert" className="text-danger">
            Không tải được nguồn. Lựa chọn hiện tại chưa đại diện cho toàn bộ nguồn được cấp quyền.
          </p>
          <Button
            disabled={disabled || all}
            variant="secondary"
            onClick={() => {
              if (sources.nextCursor) void loadMoreSources();
              else void refreshAccess();
            }}
          >
            {sources.nextCursor ? "Thử tải lại nguồn" : "Kiểm tra lại quyền và nguồn"}
          </Button>
        </div>
      )}
    </section>
  );
}
