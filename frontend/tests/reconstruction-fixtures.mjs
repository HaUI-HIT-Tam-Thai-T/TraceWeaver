import { event, EID, EID2 } from './event-fixtures.mjs'
export const RID = '55555555-5555-4555-8555-555555555555'
export function run(status = 'completed', overrides = {}) {
  return { id: RID, status, mode: 'rule_only', root_event_id: EID,
    input_snapshot_id: '44444444-4444-4444-8444-444444444444', rule_version: 'v1', model_version: null,
    created_at: '2026-10-26T06:00:00Z', completed_at: status === 'completed' ? '2026-10-26T06:00:01Z' : null,
    degraded: false, degraded_reason: null, effective_method: 'rule_only', error: null, ...overrides }
}
export function graph() {
  return { run_id: RID, nodes: [event(), event(EID2)], links: [{
    id: '66666666-6666-4666-8666-666666666666', from_event_id: EID, to_event_id: EID2,
    method: 'rule', score: null, review_state: 'pending', version: 1,
    evidence: [{ reason_code: 'SHARED_STRONG_ID', event_ids: [EID, EID2], field: 'identifiers.request', observed_values: ['<script>unsafe</script>'] }],
  }], unresolved_event_ids: [EID2], missing_expected_steps: [{ step: 'provision', process_template_version: 'v1', label: 'chưa có bằng chứng' }], version: 1 }
}
