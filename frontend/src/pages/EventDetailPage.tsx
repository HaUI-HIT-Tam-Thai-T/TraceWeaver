import { PageHeading } from "../components/layout/PageHeading";
import { EventDetailView } from "../features/events/components/EventDetailView";

export function EventDetailPage() {
  return (
    <>
      <PageHeading title="Chi tiết sự kiện" />
      <EventDetailView />
    </>
  );
}
