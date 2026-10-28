import type { CaseDetail } from "../schemas";

export function CaseTime({ value }: { value: string }) {
  return (
    <span>
      <time dateTime={value}>
        {new Intl.DateTimeFormat("vi-VN", {
          dateStyle: "short",
          timeStyle: "medium",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date(value))}{" "}
        (UTC+7)
      </time>
      <br />
      <code>{value}</code>
    </span>
  );
}
export function CaseDetailView({ detail }: { detail: CaseDetail }) {
  const item = detail.case;
  return (
    <div className="space-y-5 overflow-x-auto">
      <section aria-label="Thông tin case">
        <h2 className="text-2xl font-semibold">{item.title}</h2>
        <p>
          Case: {item.id}; Workspace: {item.workspace_id}; Run: {item.run_id}
        </p>
        <p>
          Workflow: {item.workflow_instance_id}; Creator: {item.creator_subject}
        </p>
        <p>
          Owner: {item.owner_id ?? "Chưa được gán"}. State: {item.state}.
          Case.version: {item.version}.
        </p>
        <p>
          Tạo case: <CaseTime value={item.created_at} />; Cập nhật:{" "}
          <CaseTime value={item.updated_at} />
        </p>
      </section>
      <section aria-label="Lịch sử workflow">
        <h3 className="text-xl font-semibold">History (chỉ đọc)</h3>
        {detail.history.length === 0 ? (
          <p>Chưa có history.</p>
        ) : (
          <ol>
            {detail.history.map((entry, index) => (
              <li
                className="my-3"
                key={`${entry.version}:${entry.occurred_at}:${index}`}
              >
                <p>
                  {entry.action}: {entry.from_state ?? "Khởi tạo (null)"} →{" "}
                  {entry.to_state}; version {entry.version}
                </p>
                <p>
                  Actor: {entry.actor_subject}; Reason: {entry.reason}
                </p>
                <CaseTime value={entry.occurred_at} />
                <p>
                  Evidence refs (ID evidence):{" "}
                  {entry.evidence_refs.join(", ") || "Không có"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-label="Evidence của case">
        <h3 className="text-xl font-semibold">Evidence (chỉ đọc)</h3>
        {detail.evidence.length === 0 ? (
          <p>Chưa có evidence.</p>
        ) : (
          <ul>
            {detail.evidence.map((entry) => (
              <li className="my-3" key={entry.id}>
                <p>
                  Evidence: {entry.id}; Case: {entry.case_id}; Kind:{" "}
                  {entry.kind}
                </p>
                <p>
                  Event IDs:{" "}
                  {entry.event_ids.join(", ") || "Không có event tham chiếu"}
                </p>
                <pre className="whitespace-pre-wrap">{entry.note}</pre>
                <p>
                  Creator: {entry.creator_subject};{" "}
                  <CaseTime value={entry.created_at} />
                </p>
              </li>
            ))}
          </ul>
        )}
        <p>
          Evidence và history là append-only. Case.version thuộc workflow; đọc
          evidence không làm tăng version.
        </p>
      </section>
    </div>
  );
}
