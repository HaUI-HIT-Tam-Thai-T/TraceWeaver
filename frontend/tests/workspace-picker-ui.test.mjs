import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('workspace picker exposes a short label, complete accessible UUID and safe disabled states without selecting on render', async () => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/ssr-workspace-picker', server: { middlewareMode: true, hmr: false, ws: false } });
  try {
    const { WorkspacePicker } = await server.ssrLoadModule('/src/features/workspace/components/WorkspacePicker.tsx');
    const id = '10000000-0000-4000-8000-000000000001';
    let selected = 0;
    const render = (patch = {}) => renderToStaticMarkup(createElement(WorkspacePicker, {
      workspaceIds: [id], selectedId: id, disabled: false, initializing: false,
      onSelect() { selected++; return true; }, ...patch,
    }));
    const html = render();
    assert.match(html, /role="combobox"/);
    assert.match(html, /aria-label="Chọn workspace"/);
    assert.match(html, /aria-haspopup="dialog"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /Workspace · 10000000…0001/);
    assert.match(html, new RegExp(`title="[^" ]*[^"<>]*${id}"`));
    assert.match(html, /aria-describedby="workspace-picker-current"/);
    assert.doesNotMatch(html, /data-slot="popover-content"/);
    const named = render({ workspaceNames: { [id]: "Nhóm điều tra" } });
    assert.match(named, /Nhóm điều tra/);
    assert.match(named, new RegExp(id));
    const loading = render({ workspaceIds: [], selectedId: null, disabled: true, initializing: true });
    assert.match(loading, /disabled=""/);
    assert.match(loading, /Đang kiểm tra workspace/);
    assert.doesNotMatch(loading, new RegExp(id));
    const unselected = render({ selectedId: 'outside-memberships' });
    assert.doesNotMatch(unselected, /outside-memberships|workspace-picker-current/);
    assert.match(render({ workspaceIds: [], selectedId: null, disabled: true }), /disabled=""/);
    assert.equal(selected, 0);
  } finally { await server.close(); }
});
