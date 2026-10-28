import { Button } from "../components/ui/Button";
import { LoadingState } from "../components/ui/LoadingState";
import { EmptyState } from "../components/ui/EmptyState";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../components/ui/Table";
import { Link } from "react-router-dom";
import { useCases } from "../features/cases/hooks/useCases";
import { CasesLayout } from "../features/cases/components/CasesLayout";
import { CasesFeedback } from "../features/cases/components/CasesFeedback";
import { CaseFiltersForm } from "../features/cases/components/CaseFiltersForm";
import { CaseTime } from "../features/cases/components/CaseDetailView";
import { writeCaseQuery } from "../features/cases/query";

export function CasesPage() {
  const { state, setFilters, refresh, previousPage, nextPage } = useCases();
  return (
    <CasesLayout title="TraceWeaver — Cases">
      <CaseFiltersForm filters={state.filters} onSearch={setFilters} />
      <p>
        Phân trang theo trạng thái hiện tại (live-state); nội dung có thể thay
        đổi giữa các trang. Không có tổng số trang.
      </p>
      <Button variant="secondary"
        type="button"
        disabled={state.status !== "active" || state.list.status === "loading"}
        onClick={refresh}
      >
        Làm mới danh sách
      </Button>
      <CasesFeedback />
      {state.list.status === "loading" && <LoadingState message="Đang tải cases…" />}
      {state.list.status === "ready" &&
        (state.list.items.length === 0 ? (
          <EmptyState title="Không có case phù hợp trong trang này." />
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Cases được phép đọc" className="w-full text-left">

              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề / ID</TableHead>
                  <TableHead>State / version</TableHead>
                  <TableHead>Owner subject</TableHead>
                  <TableHead>Run</TableHead>
                  <TableHead>Ngày tạo case (không phải thời gian lọc)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.list.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        className="underline"
                        to={`/cases/${item.id}?${writeCaseQuery(state.filters)}`}
                      >
                        {item.title}
                      </Link>
                      <p>{item.id}</p>
                    </TableCell>
                    <TableCell>
                      {item.state} / {item.version}
                    </TableCell>
                    <TableCell>{item.owner_id ?? "Chưa được gán"}</TableCell>
                    <TableCell>{item.run_id}</TableCell>
                    <TableCell>
                      <CaseTime value={item.created_at} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      <nav aria-label="Phân trang cases" className="my-4 space-x-4">
        <Button variant="secondary"
          type="button"
          disabled={
            state.status !== "active" ||
            state.list.status !== "ready" ||
            state.index === 0
          }
          onClick={previousPage}
        >
          Trước
        </Button>
        <span>Trang {state.index + 1}</span>
        <Button variant="secondary"
          type="button"
          disabled={
            state.status !== "active" ||
            state.list.status !== "ready" ||
            !state.nextCursor
          }
          onClick={nextPage}
        >
          Tiếp
        </Button>
      </nav>
    </CasesLayout>
  );
}
