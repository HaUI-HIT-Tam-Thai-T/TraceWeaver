import { Link } from "react-router-dom";
import { useCases } from "../features/cases/state/casesContext";
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
      <button
        type="button"
        disabled={state.status !== "active" || state.list.status === "loading"}
        onClick={refresh}
      >
        Làm mới danh sách
      </button>
      <CasesFeedback />
      {state.list.status === "loading" && <p role="status">Đang tải cases…</p>}
      {state.list.status === "ready" &&
        (state.list.items.length === 0 ? (
          <p>Không có case phù hợp trong trang này.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption>Cases được phép đọc</caption>
              <thead>
                <tr>
                  <th>Tiêu đề / ID</th>
                  <th>State / version</th>
                  <th>Owner subject</th>
                  <th>Run</th>
                  <th>Ngày tạo case (không phải thời gian lọc)</th>
                </tr>
              </thead>
              <tbody>
                {state.list.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        className="underline"
                        to={`/cases/${item.id}?${writeCaseQuery(state.filters)}`}
                      >
                        {item.title}
                      </Link>
                      <p>{item.id}</p>
                    </td>
                    <td>
                      {item.state} / {item.version}
                    </td>
                    <td>{item.owner_id ?? "Chưa được gán"}</td>
                    <td>{item.run_id}</td>
                    <td>
                      <CaseTime value={item.created_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      <nav aria-label="Phân trang cases" className="my-4 space-x-4">
        <button
          type="button"
          disabled={
            state.status !== "active" ||
            state.list.status !== "ready" ||
            state.index === 0
          }
          onClick={previousPage}
        >
          Trước
        </button>
        <span>Trang {state.index + 1}</span>
        <button
          type="button"
          disabled={
            state.status !== "active" ||
            state.list.status !== "ready" ||
            !state.nextCursor
          }
          onClick={nextPage}
        >
          Tiếp
        </button>
      </nav>
    </CasesLayout>
  );
}
