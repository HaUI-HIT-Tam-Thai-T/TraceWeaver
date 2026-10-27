import { Link, useLocation, useParams } from "react-router-dom";
import { useCases } from "../features/cases/casesContext";
import { CasesLayout } from "../features/cases/CasesLayout";
import { CasesFeedback } from "../features/cases/CasesFeedback";
import { CaseDetailView } from "../features/cases/CaseDetailView";

export function CaseDetailPage() {
  const { state, refresh } = useCases();
  const { caseId } = useParams();
  const location = useLocation();
  const matches = state.detail.id === caseId;
  return (
    <CasesLayout title="TraceWeaver — Chi tiết case">
      <Link className="my-4 block underline" to={`/cases${location.search}`}>
        Về danh sách với bộ lọc hiện tại
      </Link>
      <button
        type="button"
        disabled={
          state.status !== "active" || state.detail.status === "loading"
        }
        onClick={refresh}
      >
        Làm mới chi tiết
      </button>
      <CasesFeedback />
      {state.status !== "invalid" &&
        state.status !== "blocked" &&
        state.status !== "reauth" &&
        (!matches || state.detail.status === "loading") && (
          <p role="status">Đang tải case/history/evidence…</p>
        )}
      {matches && state.detail.status === "ready" && state.detail.data && (
        <CaseDetailView detail={state.detail.data} />
      )}
    </CasesLayout>
  );
}
