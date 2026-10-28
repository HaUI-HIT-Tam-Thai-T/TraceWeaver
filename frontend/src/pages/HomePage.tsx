import { AuthStatus } from "../features/auth/components/AuthStatus";
import { WorkspacePanel } from "../features/workspace/components/WorkspacePanel";
import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold">TraceWeaver</h1>
      <AuthStatus />
      <Link className="mt-4 block underline" to="/dashboard">Mở dashboard</Link>
      <Link className="mt-4 block underline" to="/knowledge">Tra cứu knowledge</Link>
      <WorkspacePanel />
      <Link className="mt-6 block underline" to="/events">
        Mở Event explorer
      </Link>
      <Link className="mt-4 block underline" to="/cases">
        Mở danh sách cases
      </Link>
    </>
  );
}
