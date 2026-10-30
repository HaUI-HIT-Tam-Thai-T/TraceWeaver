import { usePageTitle } from "../../hooks/usePageTitle";
import { Outlet } from "react-router-dom";

export function PublicLayout() {
  usePageTitle();
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center p-4 sm:p-8"
    >
      <div className="content-panel space-y-4">
        <Outlet />
      </div>
    </main>
  );
}
