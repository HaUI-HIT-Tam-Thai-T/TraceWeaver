// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { ApiError } from './api-error.js';

export function createAccountProvider(
  { oidcIssuer, accountClientId, accountClientSecret, accountAdminBaseUrl },
  fetcher = fetch,
) {
  if (!accountClientId || !accountClientSecret) return null;
  const issuer = new URL(oidcIssuer),
    at = issuer.pathname.lastIndexOf('/realms/');
  if (at < 0) throw new Error('Invalid account realm');
  const base =
    accountAdminBaseUrl ||
    issuer.origin + issuer.pathname.slice(0, at) + '/admin/realms/' + issuer.pathname.slice(at + 8);
  const unavailable = () =>
    new ApiError(503, 'ACCOUNT_PROVIDER_UNAVAILABLE', 'Account provider temporarily unavailable');
  async function session(work) {
    const signal = AbortSignal.timeout(10000);
    try {
      const auth = await fetcher(`${oidcIssuer}/protocol/openid-connect/token`, {
        method: 'POST',
        redirect: 'error',
        signal,
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: accountClientId,
          client_secret: accountClientSecret,
        }),
      });
      if (!auth.ok) throw unavailable();
      const token = (await auth.json()).access_token;
      if (typeof token !== 'string' || !token) throw unavailable();
      const request = (path, options = {}) =>
        fetcher(base + path, {
          ...options,
          redirect: 'error',
          signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      return await work(request);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw unavailable();
    }
  }
  async function user(request, id) {
    const r = await request('/users/' + encodeURIComponent(id));
    if (r.status === 404) throw new ApiError(422, 'ACCOUNT_NOT_FOUND', 'Account not found');
    if (!r.ok) throw unavailable();
    const u = await r.json();
    if (
      u.id !== id ||
      u.serviceAccountClientId ||
      u.username?.startsWith('service-account-') ||
      u.enabled !== true
    )
      throw new ApiError(422, 'ACCOUNT_UNAVAILABLE', 'Active human account required');
    return u;
  }
  return {
    async existing(id) {
      return session(async (request) => {
        const u = await user(request, id);
        return { subject: u.id, username: u.username };
      });
    },
    async create(username, password, marker) {
      return session(async (request) => {
        const r = await request('/users', {
          method: 'POST',
          body: JSON.stringify({
            username,
            enabled: true,
            attributes: { traceweaverProvisioningKey: [marker] },
            credentials: [{ type: 'password', value: password, temporary: true }],
            requiredActions: ['UPDATE_PASSWORD'],
          }),
        });
        if (![201, 409].includes(r.status)) {
          if (r.status === 400)
            throw new ApiError(
              422,
              'ACCOUNT_POLICY_REJECTED',
              'Account profile or password policy rejected',
            );
          throw unavailable();
        }
        const found = await request(
          '/users?' + new URLSearchParams({ username, exact: 'true', max: '2' }),
        );
        if (!found.ok) throw unavailable();
        const matches = await found.json();
        if (!Array.isArray(matches) || matches.length !== 1 || matches[0].username !== username)
          throw unavailable();
        const u = await user(request, matches[0].id);
        if (u.attributes?.traceweaverProvisioningKey?.[0] !== marker)
          throw new ApiError(
            409,
            'ACCOUNT_OWNERSHIP_CONFLICT',
            'Existing account is not owned by this provisioning operation',
          );
        return { subject: u.id, username: u.username };
      });
    },
  };
}
