import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { event, SID } from './event-fixtures.mjs'

test('event presentation preserves identity boundaries, unknown outcomes and original evidence', async () => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/ssr-event-presentation', server: { middlewareMode: true, hmr: false, ws: false } })
  try {
    const { requestLabel, actionLabel, outcomeLabel, sourceLabel, errorLabel, eventDescription, eventTimeLabel } = await server.ssrLoadModule('/src/features/events/presentation.ts')
    const original = event()
    const before = structuredClone(original)
    assert.equal(requestLabel(original), 'example')
    assert.equal(requestLabel({ ...original, identifiers: [{ namespace: 'account', value: 'REQ-02' }] }), 'Chưa xác định')
    assert.equal(requestLabel({ ...original, identifiers: [{ namespace: 'request', value: 'REQ-01' }, { namespace: 'request', value: 'REQ-01' }, { namespace: 'request', value: 'REQ-02' }] }), 'Nhiều mã yêu cầu: REQ-01, REQ-02')
    assert.equal(sourceLabel(original, [{ id: SID, name: 'Dịch vụ tiếp nhận' }]), 'Dịch vụ tiếp nhận')
    assert.equal(sourceLabel(original, [{ id: 'other', name: 'Nguồn khác' }]), 'Chưa tải tên nguồn (intake)')
    assert.equal(actionLabel('account.created'), 'Đã tạo tài khoản')
    assert.equal(actionLabel('provision.completed'), 'Đã cấp môi trường')
    assert.equal(actionLabel('provision.failed'), 'Cấp môi trường thất bại')
    for (const action of ['new.action', 'constructor', '__proto__']) assert.equal(actionLabel(action), `Hoạt động: ${action}`)
    assert.equal(outcomeLabel('unknown'), 'Chưa xác định')
    assert.equal(outcomeLabel('failed'), 'Thất bại')
    assert.equal(errorLabel({ ...original, payload_redacted: { error_code: 'CAPACITY_EXHAUSTED' } }), 'CAPACITY_EXHAUSTED: Không đủ tài nguyên để cấp môi trường')
    for (const error_code of [null, 7, {}, '']) assert.equal(errorLabel({ ...original, payload_redacted: { error_code } }), null)
    assert.match(errorLabel({ ...original, payload_redacted: { error_code: 'NEW_ERROR' } }), /Chưa có diễn giải/)
    assert.equal(eventDescription({ ...original, action: 'new.action', message: 'Nội dung gốc' }), 'Nội dung gốc')
    assert.equal(eventTimeLabel('2026-10-27T17:30:00.123456Z'), '00:30:00 · 28/10/2026')
    assert.deepEqual(original, before)
  } finally {
    await server.close()
  }
})
