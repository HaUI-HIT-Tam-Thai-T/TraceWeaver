export function PageLoading() {
  return <p role="status">Đang tải trang…</p>;
}

export function PageLoadError() {
  return (
    <section role="alert" aria-labelledby="page-load-error-title">
      <h1 id="page-load-error-title">Không tải được trang</h1>
      <p>Vui lòng kiểm tra kết nối rồi tải lại trang để thử lại.</p>
      <button type="button" onClick={() => window.location.reload()}>
        Tải lại trang
      </button>
    </section>
  );
}
