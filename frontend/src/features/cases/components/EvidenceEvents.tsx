import type { CaseEvidenceSnapshot } from "../state/state";
import type { Source } from "../../../types/workspace";
import { actionLabel, requestLabel, sourceLabel } from "../../events/presentation";
import { EventContent, EventTime, EventOutcome } from "../../events/components/EventPresentation";
import { TechnicalDetails } from "../../../components/ui/TechnicalDetails";

export function EvidenceEvents({
  ids,
  snapshot,
  sources,
}: {
  ids: string[];
  snapshot: CaseEvidenceSnapshot;
  sources: Source[];
}) {
  if (snapshot.status !== "ready")
    return (
      <p role="status">
        {snapshot.status === "loading"
          ? "Đang tải log trong ảnh chụp dữ liệu…"
          : "Chưa tải được log trong ảnh chụp dữ liệu của hồ sơ."}
      </p>
    );
  return (
    <ul className="space-y-4">
      {ids.map((id) => {
        const event = snapshot.events.find((item) => item.event_id === id);
        return (
          <li key={id} className="rounded border border-line p-3">
            {event ? (
              <>
                <p className="font-semibold">
                  {requestLabel(event)} · {actionLabel(event.action)}
                </p>
                <p>
                  {sourceLabel(event, sources)} · <EventTime value={event.occurred_at} /> (UTC+7)
                </p>
                <EventOutcome outcome={event.outcome} />
                <EventContent event={event} />
                <TechnicalDetails headingLevel={5} title="Provenance và log gốc">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(event, null, 2)}
                  </pre>
                </TechnicalDetails>
              </>
            ) : (
              <p>Không tìm thấy sự kiện tham chiếu trong ảnh chụp dữ liệu của hồ sơ.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
