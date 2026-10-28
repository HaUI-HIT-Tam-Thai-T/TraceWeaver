import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../../components/ui/Table";
import type { Graph } from "../schemas";

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
      <Table caption="Nodes trong snapshot" className="w-full text-left">

        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>UTC gốc</TableHead>
            <TableHead>Source / service</TableHead>
            <TableHead>Action / outcome</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {graph.nodes.map((node) => (
            <TableRow key={node.event_id}>
              <TableCell>{node.event_id}</TableCell>
              <TableCell>{node.occurred_at}</TableCell>
              <TableCell>
                {node.source_id} / {node.service}
              </TableCell>
              <TableCell>
                {node.action} / {node.outcome}
              </TableCell>
              <TableCell>{node.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {graph.nodes.length === 0 && <p>Snapshot không có node.</p>}
      <Table caption="Links và bằng chứng" className="w-full text-left">

        <TableHeader>
          <TableRow>
            <TableHead>Hướng</TableHead>
            <TableHead>Method / score</TableHead>
            <TableHead>Review / version</TableHead>
            <TableHead>Evidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {graph.links.map((link) => (
            <TableRow key={link.id}>
              <TableCell>
                {link.from_event_id} → {link.to_event_id}
              </TableCell>
              <TableCell>
                {link.method} /{" "}
                {link.score === null ? "null (không có điểm)" : link.score}
              </TableCell>
              <TableCell>
                {link.review_state} / {link.version}
              </TableCell>
              <TableCell>
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(link.evidence, null, 2)}
                </pre>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
