import { Link } from "react-router-dom";
import { AuthStatus } from "../features/auth/AuthStatus";
import { WorkspacePanel } from "../features/workspace/WorkspacePanel";
import { EventsExplorer } from "../features/events/EventsExplorer";
import { ReconstructionPanel } from "../features/reconstruction/ReconstructionPanel";

export function EventsPage() {
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold">TraceWeaver — Events</h1>
      <Link className="mb-4 block underline" to="/">
        Về trang chủ
      </Link>
      <AuthStatus />
      <WorkspacePanel />
      <EventsExplorer />
      <ReconstructionPanel />
    </>
  );
}
