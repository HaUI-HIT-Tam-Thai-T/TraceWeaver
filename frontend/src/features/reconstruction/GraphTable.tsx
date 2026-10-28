import type { Graph } from "./schemas";

export function GraphTable({ graph }: { graph: Graph }) {
  return (
    <section
      aria-label="Graph reconstruction"
      className="mt-4 space-y-3 overflow-x-auto"
    >
      <h3 className="text-xl font-semibold">
        Graph — revision {graph.version}
      </h3>
      <p>Run: {graph.run_id}</p>
      <table className="w-full text-left">
        <caption>Nodes trong snapshot</caption>
        <thead>
          <tr>
            <th>Event</th>
            <th>UTC gốc</th>
            <th>Source / service</th>
            <th>Action / outcome</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {graph.nodes.map((node) => (
            <tr key={node.event_id}>
              <td>{node.event_id}</td>
              <td>{node.occurred_at}</td>
              <td>
                {node.source_id} / {node.service}
              </td>
              <td>
                {node.action} / {node.outcome}
              </td>
              <td>{node.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {graph.nodes.length === 0 && <p>Snapshot không có node.</p>}
      <table className="w-full text-left">
        <caption>Links và bằng chứng</caption>
        <thead>
          <tr>
            <th>Hướng</th>
            <th>Method / score</th>
            <th>Review / version</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {graph.links.map((link) => (
            <tr key={link.id}>
              <td>
                {link.from_event_id} → {link.to_event_id}
              </td>
              <td>
                {link.method} /{" "}
                {link.score === null ? "null (không có điểm)" : link.score}
              </td>
              <td>
                {link.review_state} / {link.version}
              </td>
              <td>
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(link.evidence, null, 2)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {graph.links.length === 0 && <p>Chưa có link trong graph.</p>}
      <h4>Events chưa nối root component</h4>
      <ul>
        {graph.unresolved_event_ids.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
      <h4>Bước kỳ vọng</h4>
      <ul>
        {graph.missing_expected_steps.map((step, index) => (
          <li key={`${step.step}:${index}`}>
            {step.step} — {step.label} ({step.process_template_version})
          </li>
        ))}
      </ul>
    </section>
  );
}
