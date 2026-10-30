import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { useCases } from "../hooks/useCases";

export function CasesFeedback() {
  const { state, refresh } = useCases();
  const { signIn } = useAuth();
  const error = state.error ?? state.list.error ?? state.detail.error;
  return (
    <div aria-live="polite">
      {state.status === "invalid" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Mã hồ sơ hoặc bộ lọc URL không hợp lệ. <Link to="/cases">Bắt đầu lại</Link>
        </Alert>
      )}
      {error && (
        <Alert className="block break-words" variant="destructive" role="alert">
          {error.message} {error.requestId && <>Request ID: {error.requestId}</>}
        </Alert>
      )}
      {state.status === "reauth" ? (
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            void signIn();
          }}
        >
          Đăng nhập lại
        </Button>
      ) : (
        error && (
          <Button variant="secondary" type="button" onClick={refresh}>
            {error.code === "INVALID_CURSOR" ? "Bắt đầu lại từ trang đầu" : "Thử tải lại hồ sơ"}
          </Button>
        )
      )}
    </div>
  );
}
