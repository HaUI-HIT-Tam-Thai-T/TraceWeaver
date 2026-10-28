import { Badge } from '../../../components/ui/Badge';
import type { Event } from "../schemas";
import { errorLabel, eventDescription, eventTimeLabel, outcomeLabel } from "../presentation";

export function EventTime({ value }: { value: string }) {
  return <time dateTime={value} className="whitespace-nowrap">{eventTimeLabel(value)}</time>;
}

export function EventOutcome({ outcome }: { outcome: Event["outcome"] }) {
  const tones = { success: 'success', failed: 'danger', unknown: 'neutral' } as const;
  return <Badge tone={tones[outcome]} className="whitespace-nowrap">{outcomeLabel(outcome)}</Badge>;
}

export function EventContent({ event }: { event: Event }) {
  const error = errorLabel(event);
  return <div className="space-y-1 break-words">
    <p>{eventDescription(event)}</p>
    {error && <p className="text-sm text-danger">Lỗi ghi nhận: {error}</p>}
  </div>;
}

export function EventTechnicalDetails({ event }: { event: Event }) {
  return <details className="rounded border p-3">
    <summary className="cursor-pointer font-medium focus-visible:outline-2">Chi tiết kỹ thuật</summary>
    <dl className="mt-3 space-y-2 break-all text-sm">
      <dt>Event ID</dt><dd>{event.event_id}</dd>
      <dt>Source ID</dt><dd>{event.source_id}</dd>
      <dt>Source event ID</dt><dd>{event.source_event_id}</dd>
      <dt>Service</dt><dd>{event.service}</dd>
      <dt>Thời điểm xảy ra (ISO gốc)</dt><dd>{event.occurred_at}</dd>
      <dt>Thời điểm nhận (ISO gốc)</dt><dd>{event.received_at}</dd>
      <dt>Action / Outcome gốc</dt><dd>{event.action} / {event.outcome}</dd>
      <dt>Thông điệp gốc</dt><dd className="whitespace-pre-wrap">{event.message || "Không có"}</dd>
      <dt>Parser version</dt><dd>{event.parser_version}</dd>
      <dt>Batch ID</dt><dd>{event.provenance.batch_id}</dd>
      <dt>Locator</dt><dd>{event.provenance.locator}</dd>
      <dt>SHA-256 redacted</dt><dd>{event.provenance.sha256_redacted}</dd>
    </dl>
    <h4 className="mt-3 font-semibold">Identifiers</h4>
    <pre className="overflow-x-auto text-sm">{JSON.stringify(event.identifiers, null, 2)}</pre>
    <h4 className="mt-3 font-semibold">Payload đã redacted</h4>
    <pre className="overflow-x-auto text-sm">{JSON.stringify(event.payload_redacted, null, 2)}</pre>
  </details>;
}
