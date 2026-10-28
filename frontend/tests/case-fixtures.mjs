import { WID } from './event-fixtures.mjs'
import { RID } from './reconstruction-fixtures.mjs'
export const CID = '88888888-8888-4888-8888-888888888888'
export const CID2 = '88888888-8888-4888-8888-888888888889'
export const EVID = '99999999-9999-4999-8999-999999999999'
export function caseItem(id = CID) {
  return { id, workspace_id: WID, run_id: RID, workflow_instance_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: '<script>case</script>', creator_subject: 'operator-subject', owner_id: null, state: 'new', version: 1,
    created_at: '2026-10-27T07:00:00.000001Z', updated_at: '2026-10-27T07:00:00.000001Z' }
}
export function caseDetail(id = CID) {
  return { case: caseItem(id), history: [{ action: 'create', from_state: null, to_state: 'new', actor_subject: 'operator-subject', reason: '<img src=x>', version: 1, occurred_at: '2026-10-27T07:00:00.000001Z', evidence_refs: [EVID] }],
    evidence: [{ id: EVID, case_id: id, kind: 'note', event_ids: [], note: '<script>note</script>', creator_subject: 'operator-subject', created_at: '2026-10-27T07:00:01.123456Z' }] }
}
