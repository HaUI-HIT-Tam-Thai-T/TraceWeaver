import { Link } from "react-router-dom";
import { useAuth } from "../../auth/state/authContext";
import { useCases } from "../state/casesContext";

export function CasesFeedback() {
  const { state, refresh } = useCases();
  const { signIn } = useAuth();
  const error = state.error ?? state.list.error ?? state.detail.error;
  return (
    <div aria-live="polite">
      {state.status === "invalid" && (
        <p role="alert">
          Case ID hoặc bộ lọc URL không hợp lệ.{" "}
          <Link to="/cases">Bắt đầu lại</Link>
        </p>
      )}
      {error && (
        <p role="alert">
          {error.message}{" "}
          {error.requestId && <>Request ID: {error.requestId}</>}
        </p>
      )}
      {state.status === "reauth" ? (
        <button
          type="button"
          onClick={() => {
            void signIn();
          }}
        >
          Đăng nhập lại
        </button>
      ) : (
        error && (
          <button type="button" onClick={refresh}>
            {error.code === "INVALID_CURSOR"
              ? "Bắt đầu lại từ trang đầu"
              : "Thử tải lại case"}
          </button>
        )
      )}
    </div>
  );
}
