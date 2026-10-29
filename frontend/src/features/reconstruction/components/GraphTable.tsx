import { TechnicalDetails } from "../../../components/ui/TechnicalDetails";
import type { Graph } from "../schemas";
import { orderedSteps, graphStepLabels, reviewLabel, scoreExplanation, evidenceLabel } from "../presentation";
import { actionLabel, eventDescription, eventTimeLabel, sourceName } from "../../events/presentation";

export function GraphTable({ graph, rootId }: { graph: Graph; rootId?: string }) {
  const labels = graphStepLabels(graph);
  function stepLabel(id: string) { return labels[id] ?? 'Sự kiện không có trong ảnh chụp dữ liệu'; }
  return <section aria-label="Graph reconstruction" className="mt-4 space-y-5 break-words">
    <h3 className="type-h3">Dòng thời gian và liên kết</h3>
    <p>{graph.nodes.length} sự kiện · {graph.links.length} liên kết · {graph.links.filter(link => link.review_state === 'pending').length} liên kết chờ duyệt · {graph.unresolved_event_ids.length} sự kiện chưa nối với điểm bắt đầu.</p>
    <p className="type-body-sm text-muted">Thứ tự thời gian không chứng minh quan hệ nguyên nhân. Các liên kết bên dưới là kết quả tái dựng cần đối chiếu với bằng chứng.</p>
    <ol className="space-y-3 border-l-2 border-primary pl-5">
      {orderedSteps(graph).map((node, index) => <li key={node.event_id} className="rounded-md border border-line bg-panel p-4">
        <h4 className="type-h4">Bước {index + 1}: {actionLabel(node.action)}</h4>{node.event_id === rootId && <p className="font-semibold text-primary">Sự kiện bắt đầu đã chọn</p>}
        <p>{eventTimeLabel(node.occurred_at)} (UTC+7) · {sourceName(node.service)}</p>
        <p className="whitespace-pre-wrap">{eventDescription(node)}</p>
        <TechnicalDetails headingLevel={5} title="Thông tin log gốc"><pre className="overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(node, null, 2)}</pre></TechnicalDetails>
      </li>)}
    </ol>
    {graph.nodes.length === 0 && <p>Ảnh chụp dữ liệu không có sự kiện.</p>}
    <h4 className="type-h4">Liên kết và bằng chứng</h4>
    {graph.links.map(link => <article key={link.id} className="space-y-2 rounded-md border border-line bg-panel p-4">
      <p className="font-semibold">{stepLabel(link.from_event_id)} → {stepLabel(link.to_event_id)}</p>
      <p>{reviewLabel(link.review_state)} · {link.method === 'model' ? 'Gợi ý AI' : link.method === 'manual' ? 'Đề xuất thủ công' : 'Quy tắc'}</p>
      <p>{scoreExplanation(link)}</p>
      {link.evidence.length === 0 ? <p>Chưa có bằng chứng được đính kèm.</p> : <ul className="space-y-2">{link.evidence.map((entry, index) => <li key={index}>
        <p>Bằng chứng: {evidenceLabel(entry.reason_code)} · Trường đối chiếu: {entry.field}</p>
        <p>{entry.event_ids.map(id => stepLabel(id)).join('; ')}</p>
        <p className="whitespace-pre-wrap break-all">Giá trị đối chiếu: {JSON.stringify(entry.observed_values)}</p>
      </li>)}</ul>}
      <TechnicalDetails headingLevel={5} title="ID và phiên bản liên kết"><p>{link.id} · version {link.version} · {link.from_event_id} → {link.to_event_id}</p></TechnicalDetails>
    </article>)}
    {graph.links.length === 0 && <p>Chưa xác định được liên kết; điều này không khẳng định hệ thống thiếu log.</p>}
    <h4 className="type-h4">Sự kiện chưa liên kết với điểm bắt đầu</h4>
    {graph.unresolved_event_ids.length === 0 ? <p>Không có sự kiện chưa liên kết trong kết quả này.</p> : <ul>{graph.unresolved_event_ids.map(id => <li key={id}>{stepLabel(id)}</li>)}</ul>}
    <h4 className="type-h4">Bước còn thiếu bằng chứng log</h4>
    <p className="type-body-sm text-muted">Thiếu bằng chứng trong phạm vi nguồn và thời gian đã chọn không có nghĩa bước đó chắc chắn chưa diễn ra.</p>
    <ul>{graph.missing_expected_steps.map((step, index) => <li key={`${step.step}:${index}`}>{sourceName(step.step)} — {step.label}<TechnicalDetails headingLevel={5} title="Phiên bản quy trình">{step.process_template_version}</TechnicalDetails></li>)}</ul>
    <TechnicalDetails headingLevel={4} title="Thông tin kỹ thuật và ảnh chụp dữ liệu"><p>Run: {graph.run_id} · Graph revision {graph.version}</p><pre className="overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(graph, null, 2)}</pre></TechnicalDetails>
  </section>;
}
