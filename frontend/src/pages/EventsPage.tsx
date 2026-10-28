import { EventsExplorer } from "../features/events/components/EventsExplorer";
import { ReconstructionPanel } from "../features/reconstruction/components/ReconstructionPanel";

export function EventsPage() {
  return (
    <>
      <h1 className="type-h1 mb-6">TraceWeaver — Events</h1>
      <EventsExplorer />
      <ReconstructionPanel />
    </>
  );
}
