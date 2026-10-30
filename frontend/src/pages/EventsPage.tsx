import { PageHeading } from "../components/layout/PageHeading";
import { EventsExplorer } from "../features/events/components/EventsExplorer";

export function EventsPage() {
  return (
    <>
      <PageHeading title="Sự kiện" />
      <EventsExplorer />
    </>
  );
}
