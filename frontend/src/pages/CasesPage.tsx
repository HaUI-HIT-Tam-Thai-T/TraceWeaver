import { caseStateLabel, nextCaseStep } from "../features/cases/presentation";
import { Button } from "../components/ui/Button";
import { LoadingState } from "../components/ui/LoadingState";
import { EmptyState } from "../components/ui/EmptyState";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/Table";
import { DetailLink } from "../components/ui/DetailLink";
import { useCases } from "../hooks/useCases";
import { CasesLayout } from "../features/cases/components/CasesLayout";
import { CasesFeedback } from "../features/cases/components/CasesFeedback";
import { CaseFiltersForm } from "../features/cases/components/CaseFiltersForm";
import { CaseTime } from "../features/cases/components/CaseDetailView";
import { writeCaseQuery } from "../features/cases/query";
import { PageSizeSelect } from "../components/ui/PageSizeSelect";

export function CasesPage() {
  const { state, setFilters, refresh, previousPage, nextPage } = useCases();
  return (
    <CasesLayout
      title="Hồ sơ"
      actions={
        <Button
          variant="tertiary"
          type="button"
          disabled={state.status !== "active" || state.list.status === "loading"}
          onClick={refresh}
        >
          Làm mới danh sách
        </Button>
      }
    >
      <CaseFiltersForm filters={state.filters} onSearch={setFilters} />

      <CasesFeedback />
      {state.list.status === "loading" && (
        <LoadingState message="Đang tải hồ sơ…" variant="table" />
      )}
      {state.list.status === "ready" &&
        (state.list.items.length === 0 ? (
          <EmptyState
            title={
              state.filters.state ||
              state.filters.owner_id ||
              state.filters.from ||
              state.filters.to
                ? "Không có hồ sơ phù hợp với bộ lọc."
                : state.index > 0
                  ? "Trang này không có hồ sơ."
                  : "Chưa có hồ sơ trong phạm vi được phép đọc."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Hồ sơ được phép đọc" className="w-full text-left">
              <TableHeader>
                <TableRow>
                  <TableHead>Hồ sơ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Người xử lý</TableHead>
                  <TableHead>Việc tiếp theo</TableHead>
                  <TableHead>Ngày tạo hồ sơ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.list.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-56 p-2 font-medium">
                      <DetailLink
                        label={item.title}
                        accessibleLabel={`Xem hồ sơ ${item.title}`}
                        to={`/cases/${item.id}?${writeCaseQuery(state.filters)}`}
                      />
                    </TableCell>
                    <TableCell>{caseStateLabel(item.state)}</TableCell>
                    <TableCell>{item.owner_id ?? "Chưa được gán"}</TableCell>
                    <TableCell>{nextCaseStep(item.state)}</TableCell>
                    <TableCell>
                      <CaseTime value={item.created_at} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      <nav
        aria-label="Phân trang cases"
        className="my-4 flex flex-wrap items-center justify-end gap-4"
      >
        <PageSizeSelect
          id="case-limit"
          value={state.filters.limit}
          label="Số hồ sơ mỗi trang"
          disabled={state.status !== "active" || state.list.status === "loading"}
          onChange={(limit) => setFilters({ ...state.filters, limit })}
        />
        <Button
          variant="secondary"
          type="button"
          disabled={state.status !== "active" || state.list.status !== "ready" || state.index === 0}
          onClick={previousPage}
        >
          Trước
        </Button>
        <span>Trang {state.index + 1}</span>
        <Button
          variant="secondary"
          type="button"
          disabled={state.status !== "active" || state.list.status !== "ready" || !state.nextCursor}
          onClick={nextPage}
        >
          Tiếp
        </Button>
      </nav>
    </CasesLayout>
  );
}
