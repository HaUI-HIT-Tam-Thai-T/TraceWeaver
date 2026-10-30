export const WID = '10000000-0000-4000-8000-000000000016';
export const SID = '30000000-0000-4000-8000-000000000001';
export const actor = 'fixture-workspace-admin';
export const member = (subject = 'fixture-reviewer') => ({ subject, active: true, roles: ['reviewer'], direct_source_ids: [] });
export const page = (version = 1) => ({ workspace_id: WID, version, items: [member()], next_after: null });
export const account = () => ({ username: 'fixture.new-user', temporary_password: 'SYNTHETIC-TEST-ONLY-123', roles: ['viewer'] });
export const completed = (version = 2) => ({ state: 'completed', subject: 'fixture-new-subject', username: account().username, active: true, roles: ['viewer'], version });
export const scope = () => ({ subject: actor, wid: WID, accessKey: {}, sourceIds: [SID] });
export const tick = async () => { for (let n = 0; n < 35; n++) await Promise.resolve(); };
