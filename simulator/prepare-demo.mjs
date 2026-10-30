// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';

export async function prepareDemo(dataset, upload, { sources, operatorSubject, request, sampleCount = 12, progress = () => {} }) {
  const path = `/api/v1/workspaces/${upload.workspace_id}`;
  const states = ['new', 'assigned', 'investigating', 'awaiting_verification'];
  const report = [];
  for (const scenario of dataset.scenarios.slice(0, sampleCount)) {
    const root = upload.event_ids[scenario.root_source_event_id], runs = {};
    for (const mode of ['rule_only', 'hybrid']) {
      const run = await request(`${path}/runs`, { root_event_id: root,
        source_ids: Object.values(sources), window: scenario.window, mode }, `${dataset.manifest.dataset}:${scenario.index}:${mode}`);
      assert.equal(run.status, 'completed');
      const graph = await request(`${path}/runs/${run.id}/graph`);
      assert.equal(graph.links.length, scenario.expected_rule_links, `Unexpected links in ${scenario.request_code}`);
      assert.equal(graph.nodes.length, scenario.event_ids.length, 'Expected full scenario snapshot');
      if (mode === 'hybrid') {
        assert.equal(run.effective_method, scenario.expect_ai ? 'hybrid' : 'rule_only');
        assert.equal(run.degraded, !scenario.expect_ai);
        if (scenario.expect_ai) {
          assert.ok(run.model_version);
          assert.ok(graph.links.every(link => Number.isFinite(link.score) && link.score >= 0 && link.score <= 1));
        } else assert.equal(run.degraded_reason, 'ai_no_eligible_pairs');
      }
      runs[mode] = { id: run.id, effective_method: run.effective_method, model_version: run.model_version,
        degraded_reason: run.degraded_reason, links: graph.links.length, unresolved: graph.unresolved_event_ids.length,
        scores: graph.links.map(link => link.score) };
    }
    const created = await request(`${path}/cases`, { run_id: runs.hybrid.id,
      title: `[Mô phỏng] ${scenario.title}` }, `${dataset.manifest.dataset}:${scenario.index}:case`);
    let detail = await request(`${path}/cases/${created.id}`);
    const target = (scenario.index - 1) % states.length;
    const note = `[${dataset.manifest.dataset}] Đã đối chiếu log cho ${scenario.request_code}. Tình huống kiểm thử: ${scenario.label}. Cần đọc bằng chứng, không coi điểm AI là kết luận cuối.`;
    if (target >= 2 && !detail.evidence.some(e => e.note === note)) {
      await request(`${path}/cases/${created.id}/evidence`, { kind: 'events',
        event_ids: scenario.event_ids.map(id => upload.event_ids[id]), note });
    }
    for (const [index, action] of ['assign', 'start', 'request_verification'].entries()) {
      if (index >= target || states.indexOf(detail.case.state) > index) continue;
      await request(`${path}/cases/${created.id}/transitions`, { action, expected_version: detail.case.version,
        reason: action === 'assign' ? 'Phân công trực ca kiểm tra yêu cầu lab mô phỏng.'
          : action === 'start' ? 'Bắt đầu đối chiếu log và bằng chứng của yêu cầu.'
            : 'Đã lưu bằng chứng; chuyển người xác minh kiểm tra kết quả.',
        ...(action === 'assign' ? { owner_id: operatorSubject } : {}) }, `${dataset.manifest.dataset}:${scenario.index}:${action}`);
      detail = await request(`${path}/cases/${created.id}`);
    }
    assert.equal(detail.case.state, states[target]);
    report.push({ ...scenario, root_event_id: root, runs, case_id: created.id, case_state: detail.case.state });
    progress({ request_code: scenario.request_code, kind: scenario.kind, case_state: detail.case.state,
      hybrid: runs.hybrid.effective_method, links: runs.hybrid.links });
  }
  return { dataset: dataset.manifest.dataset, workspace_id: upload.workspace_id, scenarios: report };
}
