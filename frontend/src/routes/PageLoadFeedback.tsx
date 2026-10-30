import { Button } from "../components/ui/Button";
import { Loader } from "../components/ui/Loader";
import { ErrorState } from "../components/ui/ErrorState";

export function PageLoading() {
  return <Loader message="Đang tải trang…" />;
}

export function PageLoadError() {
  return (
    <section
      aria-labelledby="page-load-error-title"
      className="ui-panel space-y-4"
    >
      <h1 id="page-load-error-title" className="type-h1">
        Không tải được trang
      </h1>
      <ErrorState
        message="Vui lòng kiểm tra kết nối rồi tải lại trang để thử lại."
        action={
          <Button onClick={() => window.location.reload()}>
            Tải lại trang
          </Button>
        }
      />
    </section>
  );
}
