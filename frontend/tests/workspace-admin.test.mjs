import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorkspaceAdminService } from '../src/features/workspace-admin/services.ts';
import { createAdminController, initialAdminState } from '../src/features/workspace-admin/controller.ts';
import { accountFormSchema, addMemberSchema, operationSchema, memberSchema } from '../src/features/workspace-admin/schemas.ts';
import { ApiError } from '../src/services/apiError.ts';
import { WID, SID, actor, member, page, account, completed, scope, tick } from './admin-fixtures.mjs';

const err = (code, status = 422) => new ApiError({ kind: status === 401 ? 'auth' : 'http', code, status, message: 'Safe admin error' });
const deferred = () => Promise.withResolvers();
async function setup(options = {}) {
  let version = 1, rechecks = 0, keyCount = 0;
  const reads = [], posts = [], operations = [], signals = [];
  const service = {
    list: async (wid, after, signal) => { reads.push([wid, after]); signals.push(signal); return options.list ? options.list(reads.length, after, signal) : page(version); },
    add: async (...args) => { posts.push(['add', ...args]); if (options.mutate) return options.mutate(...args); version++; return {}; },
    update: async (...args) => { posts.push(['update', ...args]); if (options.mutate) return options.mutate(...args); version++; return {}; },
    grant: async (...args) => { posts.push(['grant', ...args]); if (options.mutate) return options.mutate(...args); version++; return {}; },
    createAccount: async (...args) => { posts.push(['account', ...args]); if (options.create) return options.create(posts.length, ...args); version++; return completed(version); },
    operation: async (...args) => { operations.push(args); return options.operation ? options.operation(...args) : { state: 'pending', username: account().username, current_version: version }; },
  };
  const controller = createAdminController(service, async () => { rechecks++; }, () => `synthetic-key-${++keyCount}`);
  const access = scope(); controller.sync(access); await tick();
  return { controller, access, reads, posts, operations, signals, rechecks: () => rechecks, setVersion: value => { version = value; } };
}
test('admin schemas enforce human roles, exact username/password, opaque subject, no extras and safe UTF-16', () => {
  const body = account(); assert.deepEqual(accountFormSchema.parse(body), body);
  assert.equal(addMemberSchema.parse({ subject: ' opaque/idp|subject ', roles: ['admin'], expected_version: 1 }).subject, ' opaque/idp|subject ');
  for (const patch of [{ username: 'UpperCase' }, { username: 'service-account-x' }, { username: 'ab' }, { temporary_password: 'short' }, { roles: [] }, { roles: ['viewer', 'viewer'] }, { roles: ['ingest_service'] }, { temporary_password: 'valid-password-\ud800' }, { clientSecret: 'forbidden' }]) assert.equal(accountFormSchema.safeParse({ ...body, ...patch }).success, false);
  assert.ok(accountFormSchema.safeParse({ ...body, temporary_password: 'SYNTHETIC-ONLY-😀' }).success);
  assert.ok(memberSchema.safeParse({ ...member(), roles: ['ingest_service'] }).success);
  assert.equal(operationSchema.safeParse({ state: 'pending', username: body.username, current_version: 1, marker: 'private' }).success, false);
});

test('six admin service operations send exact DTOs, paths, pagination, version and operation headers', async () => {
  const calls = []; let data = page(); const signal = new AbortController().signal;
  const call = async (...args) => { calls.push(args); return { data }; };
  const service = createWorkspaceAdminService({ get: call, post: call, put: call });
  await service.list(WID, 'opaque/?#subject', signal);
  assert.equal(calls.at(-1)[0], `/api/v1/workspaces/${WID}/admin/members`);
  assert.equal(calls.at(-1)[1].params.get('after'), 'opaque/?#subject'); assert.equal(calls.at(-1)[1].params.get('limit'), '50');
  data = { subject: member().subject, active: true, roles: ['reviewer'], version: 2 };
  const add = { subject: member().subject, roles: ['reviewer'], expected_version: 1 };
  await service.add(WID, add, signal); assert.deepEqual(calls.at(-1)[1], add);
  const subject = 'opaque/subject?#'; data = { ...data, subject, expected_version: 1 };
  await service.update(WID, subject, { active: true, roles: ['reviewer'], expected_version: 1 }, signal);
  assert.ok(calls.at(-1)[0].endsWith(`/members/${encodeURIComponent(subject)}`));
  data = { subject, source_id: SID, enabled: false, version: 2 };
  await service.grant(WID, subject, SID, { enabled: false, expected_version: 1 }, signal);
  assert.ok(calls.at(-1)[0].endsWith(`/sources/${SID}`));
  data = completed(); await service.createAccount(WID, { ...account(), expected_version: 1 }, 'synthetic-key', signal);
  assert.equal(calls.at(-1)[2].headers['Idempotency-Key'], 'synthetic-key');
  data = { ...completed(), current_version: 3 }; await service.operation(WID, 'synthetic-key', signal);
  assert.deepEqual(calls.at(-1), [`/api/v1/workspaces/${WID}/admin/accounts/provisioning`, { signal, headers: { 'Idempotency-Key': 'synthetic-key', 'Content-Type': 'application/json' } }]);
});

test('services reject wrong scope, malformed DTO, wrong echo, leaked fields, invalid ID/key and dot-segment subject', async () => {
  let data = { ...page(), workspace_id: SID };
  const service = createWorkspaceAdminService({ get: async () => ({ data }), put: async () => ({ data }), post: async () => ({ data }) });
  await assert.rejects(service.list(WID), { code: 'INVALID_API_RESPONSE' });
  data = { ...page(), next_after: 'not-last-subject' }; await assert.rejects(service.list(WID), { code: 'INVALID_API_RESPONSE' });
  data = { ...completed(), temporary_password: 'should-never-return' }; await assert.rejects(service.createAccount(WID, { ...account(), expected_version: 1 }, 'key'), { code: 'INVALID_API_RESPONSE' });
  data = { subject: member().subject, active: false, roles: ['viewer'], expected_version: 1, version: 2 };
  await assert.rejects(service.update(WID, member().subject, { active: true, roles: ['viewer'], expected_version: 1 }), { code: 'INVALID_API_RESPONSE' });
  await assert.rejects(service.list('bad'), { code: 'INVALID_ADMIN_INPUT' });
  await assert.rejects(service.operation(WID, 'bad\nkey'), { code: 'INVALID_ADMIN_INPUT' });
  await assert.rejects(service.update(WID, '..', { active: true, roles: ['viewer'], expected_version: 1 }), { code: 'INVALID_ADMIN_INPUT' });
});

test('pagination appends only same admin version, changed version/duplicate subject require restart', async () => {
  for (const changed of [true, false]) {
    const x = await setup({ list: async (n, after) => after ? { ...page(changed ? 2 : 1), items: [member(changed ? 'next' : member().subject)] } : { ...page(), next_after: member().subject } });
    await x.controller.more(); assert.equal(x.controller.getSnapshot().list.status, 'error');
    assert.deepEqual(x.controller.getSnapshot().list.items, []);
    await x.controller.refresh(); assert.equal(x.reads.at(-1)[1], undefined);
  }
  const x = await setup({ list: async (n, after) => after ? { ...page(), items: [member('second')] } : { ...page(), next_after: member().subject } });
  await x.controller.more(); assert.equal(x.controller.getSnapshot().list.items.length, 2);
});

test('mutation refreshes first page without incrementing FE version; stale body cannot POST', async () => {
  const x = await setup(); x.setVersion(8);
  await x.controller.mutate({ kind: 'add', body: { subject: 'new-human', roles: ['viewer'], expected_version: 1 } });
  assert.equal(x.controller.getSnapshot().list.version, 9);
  assert.equal(x.reads.at(-1)[1], undefined);
  await x.controller.mutate({ kind: 'add', body: { subject: 'other', roles: ['viewer'], expected_version: 1 } });
  assert.equal(x.posts.length, 1); assert.equal(x.controller.getSnapshot().mutation.status, 'conflict');
});

test('conflict and uncertain membership writes refetch once without automatic replay', async () => {
  for (const error of [err('VERSION_CONFLICT', 409), new ApiError({ kind: 'timeout', code: 'TIMEOUT', message: 'Safe' })]) {
    const x = await setup({ mutate: async () => { throw error; } });
    await x.controller.mutate({ kind: 'update', subject: member().subject, body: { roles: ['viewer'], active: true, expected_version: 1 } });
    assert.equal(x.posts.length, 1); assert.equal(x.reads.length, 2);
    assert.equal(x.controller.getSnapshot().mutation.status, error.code === 'VERSION_CONFLICT' ? 'conflict' : 'uncertain');
  }
});

test('source actions reject hidden sources, inactive membership and known service account', async () => {
  for (const item of [{ ...member(), active: false }, { ...member(), roles: ['ingest_service'] }]) {
    const x = await setup({ list: async () => ({ ...page(), items: [item] }) });
    await x.controller.mutate({ kind: 'grant', subject: item.subject, sid: SID, body: { enabled: true, expected_version: 1 } }); assert.equal(x.posts.length, 0);
  }
  const x = await setup(); await x.controller.mutate({ kind: 'grant', subject: member().subject, sid: WID, body: { enabled: true, expected_version: 1 } }); assert.equal(x.posts.length, 0);
});

test('editing caller membership/grants purges and revalidates access', async () => {
  const x = await setup({ list: async () => ({ ...page(), items: [member(actor)] }) });
  await x.controller.mutate({ kind: 'update', subject: actor, body: { roles: ['viewer'], active: true, expected_version: 1 } });
  assert.equal(x.rechecks(), 1); assert.equal(x.controller.getSnapshot().scope, null);
});

test('account pending checks GET operation, retry retains key/body and changes only explicitly selected version', async () => {
  const x = await setup({ create: async n => { if (n === 1) throw err('ACCOUNT_PROVISIONING_PENDING', 503); return completed(6); } });
  await x.controller.createAccount(account(), 1);
  assert.equal(x.controller.getSnapshot().account.status, 'pending'); assert.equal(x.operations.length, 1);
  assert.equal(JSON.stringify(x.controller.getSnapshot()).includes(account().temporary_password), false);
  x.setVersion(5); await x.controller.refresh();
  await x.controller.createAccount(account(), 1); assert.equal(x.posts.length, 1);
  await x.controller.createAccount(account(), 5); assert.equal(x.posts.length, 2);
  assert.equal(x.posts[0][3], x.posts[1][3]);
  assert.deepEqual({ ...x.posts[0][2], expected_version: 5 }, x.posts[1][2]);
  assert.equal(x.controller.getSnapshot().account.status, 'completed');
});

test('timed out committed create is resolved by GET completed without another POST', async () => {
  const x = await setup({ create: async () => { throw new ApiError({ kind: 'timeout', code: 'TIMEOUT', message: 'Safe' }); }, operation: async () => ({ ...completed(), current_version: 3 }) });
  await x.controller.createAccount(account(), 1);
  assert.equal(x.posts.length, 1); assert.equal(x.operations.length, 1); assert.equal(x.controller.getSnapshot().account.status, 'completed');
  await x.controller.createAccount(account(), 1); assert.equal(x.posts.length, 1);
});

test('disabled provider has no fake pending or automatic GET/retry; identity conflict keeps intent', async () => {
  const x = await setup({ create: async () => { throw err('ACCOUNT_PROVIDER_DISABLED', 503); } });
  await x.controller.createAccount(account(), 1);
  assert.equal(x.controller.getSnapshot().account.status, 'error'); assert.equal(x.controller.getSnapshot().account.key, null); assert.equal(x.operations.length, 0);
  const y = await setup({ create: async () => { throw err('ACCOUNT_OWNERSHIP_CONFLICT', 409); } });
  await y.controller.createAccount(account(), 1); const key = y.controller.getSnapshot().account.key;
  y.controller.resetAccount(); assert.equal(y.controller.getSnapshot().account.key, key);
  await y.controller.createAccount({ ...account(), username: 'different' }, 1); assert.equal(y.posts.length, 1);
});

test('operation wrong username cannot become success and exposes no raw secrets', async () => {
  const x = await setup({ create: async () => { throw err('ACCOUNT_PROVISIONING_PENDING', 503); }, operation: async () => ({ ...completed(), username: 'other-user', current_version: 2 }) });
  await x.controller.createAccount(account(), 1); assert.equal(x.controller.getSnapshot().account.status, 'uncertain');
  assert.equal(x.controller.getSnapshot().account.error.code, 'INVALID_API_RESPONSE');
});

test('401/403/404 purge list/operation and deny further writes until scope is revalidated', async () => {
  for (const status of [401, 403, 404]) {
    const x = await setup({ create: async () => { throw err('DENIED', status); } });
    await x.controller.createAccount(account(), 1); assert.equal(x.controller.getSnapshot().blocked, true);
    assert.equal(x.controller.getSnapshot().list.items.length, 0); assert.equal(x.controller.getSnapshot().account.key, null);
    await x.controller.createAccount(account(), 1); assert.equal(x.posts.length, 1);
    assert.equal(x.rechecks(), status === 401 ? 0 : 1);
  }
});

test('late list/create/operation responses cannot restore data after logout or workspace/account/access/grant changes', async () => {
  for (const task of ['list', 'create', 'operation']) for (const change of ['logout', 'workspace', 'account', 'access', 'grants']) {
    const gate = deferred();
    const x = await setup({ list: async n => task === 'list' && n > 1 ? gate.promise : page(), create: async () => task === 'create' ? gate.promise : Promise.reject(err('ACCOUNT_PROVISIONING_PENDING', 503)), operation: async () => gate.promise });
    const pending = task === 'list' ? x.controller.refresh() : x.controller.createAccount(account(), 1); await tick();
    if (change === 'logout') x.controller.stop();
    else x.controller.sync({ ...x.access, ...(change === 'workspace' ? { wid: SID } : change === 'account' ? { subject: 'other' } : change === 'access' ? { accessKey: {} } : { sourceIds: [] }) });
    gate.resolve(task === 'list' ? page() : task === 'create' ? completed() : { ...completed(), current_version: 2 });
    await pending; await tick();
    assert.equal(x.controller.getSnapshot().account.key, null);
    if (change === 'logout') assert.equal(x.controller.getSnapshot().scope, null);
  }
});

test('double-click writes are serialized and stop clears all state including metadata', async () => {
  const gate = deferred(); const x = await setup({ create: () => gate.promise });
  const pending = x.controller.createAccount(account(), 1); await tick();
  await x.controller.createAccount(account(), 1); assert.equal(x.posts.length, 1);
  gate.resolve(completed()); await pending;
  x.controller.stop(); assert.deepEqual(x.controller.getSnapshot(), initialAdminState(null, x.controller.getSnapshot().epoch));
});
