import { TechnicalDetails } from "../../../components/ui/TechnicalDetails";
import { Badge } from "../../../components/ui/Badge";
import type { Event } from "../schemas";
import { errorLabel, eventDescription, eventTimeLabel, outcomeLabel } from "../presentation";

export function EventTime({ value }: { value: string }) {
  return (
    <time dateTime={value} className="whitespace-nowrap">
      {eventTimeLabel(value)}
    </time>
  );
}

export function EventOutcome({ outcome }: { outcome: Event["outcome"] }) {
  const tones = { success: "success", failed: "danger", unknown: "neutral" } as const;
  return (
    <Badge tone={tones[outcome]} className="whitespace-nowrap">
      {outcomeLabel(outcome)}
    </Badge>
  );
}

export function EventContent({ event }: { event: Event }) {
  const error = errorLabel(event);
  return (
    <div className="space-y-1 break-words">
      <p className="whitespace-pre-wrap">{eventDescription(event)}</p>
      {error && <p className="text-sm text-danger">Lỗi ghi nhận: {error}</p>}
    </div>
  );
}

export function EventTechnicalDetails({
  event,
  headingLevel = 3,
}: {
  event: Event;
  headingLevel?: 3 | 4;
}) {
  const Subheading = headingLevel === 4 ? "h5" : "h4";
  return (
    <TechnicalDetails
      headingLevel={headingLevel}
      title="Chi tiết kỹ thuật"
      className="rounded-md border border-line px-4"
    >
      <dl className="mt-3 space-y-2 break-all text-sm">
        <dt>Event ID</dt>
        <dd>{event.event_id}</dd>
        <dt>Source ID</dt>
        <dd>{event.source_id}</dd>
        <dt>Source event ID</dt>
        <dd>{event.source_event_id}</dd>
        <dt>Service</dt>
        <dd>{event.service}</dd>
        <dt>Thời điểm xảy ra (ISO gốc)</dt>
        <dd>{event.occurred_at}</dd>
        <dt>Thời điểm nhận (ISO gốc)</dt>
        <dd>{event.received_at}</dd>
        <dt>Action / Outcome gốc</dt>
        <dd>
          {event.action} / {event.outcome}
        </dd>
        <dt>Thông điệp gốc</dt>
        <dd className="whitespace-pre-wrap">{event.message || "Không có"}</dd>
        <dt>Parser version</dt>
        <dd>{event.parser_version}</dd>
        <dt>Batch ID</dt>
        <dd>{event.provenance.batch_id}</dd>
        <dt>Locator</dt>
        <dd>{event.provenance.locator}</dd>
        <dt>SHA-256 redacted</dt>
        <dd>{event.provenance.sha256_redacted}</dd>
      </dl>
      <Subheading className="mt-3 font-semibold">Mã định danh</Subheading>
      <pre className="overflow-x-auto text-sm">{JSON.stringify(event.identifiers, null, 2)}</pre>
      <Subheading className="mt-3 font-semibold">Dữ liệu đã che thông tin nhạy cảm</Subheading>
      <pre className="overflow-x-auto text-sm">
        {JSON.stringify(event.payload_redacted, null, 2)}
      </pre>
    </TechnicalDetails>
  );
}
