// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { createHmac } from 'node:crypto';
import { ApiError } from '../core/identity/api-error.js';
import { adminInput } from '../validations/admin.validation.js';
import { digest, canonical } from '../core/data/event-normalizer.js';
export function createAdminService(repo, provider, secret) {
  const protect = async work => { try { return await work(); } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(503, 'ADMIN_UNAVAILABLE', 'Workspace administration temporarily unavailable'); } };
  const identityProvider = () => { if (!provider) throw new ApiError(503, 'ACCOUNT_PROVIDER_DISABLED', 'Account administration is not configured'); return provider; };
  return {
    operation: (actor, wid, key) => protect(() => {
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(key)) throw new ApiError(400, 'IDEMPOTENCY_REQUIRED', 'Idempotency-Key required');
      return repo.operation(actor, wid, digest(key));
    }),
    list: (...args) => protect(() => repo.list(...args)),
    member: (actor, wid, subject, input) => protect(async () => {
      adminInput('member', input); await repo.authorize(actor, wid);
      if (input.active) await identityProvider().existing(subject);
      return repo.member(actor, wid, subject, input);
    }),
    source: (actor, wid, subject, sid, input) => protect(async () => {
      adminInput('source', input); await repo.authorize(actor, wid);
      if (input.enabled) await identityProvider().existing(subject);
      return repo.source(actor, wid, subject, sid, input);
    }),
    add: (actor, wid, input) => protect(async () => {
      adminInput('add', input); await repo.authorize(actor, wid);
      const account = await identityProvider().existing(input.subject);
      if (account.subject !== input.subject) throw new ApiError(503, 'ACCOUNT_PROVIDER_UNAVAILABLE', 'Account identity mismatch');
      return repo.add(actor, wid, input);
    }),
    account: (actor, wid, input, key) => protect(async () => {
      adminInput('account', input); await repo.authorize(actor, wid);
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(key)) throw new ApiError(400, 'IDEMPOTENCY_REQUIRED', 'Idempotency-Key required');
      const { expected_version, ...body } = input;
      const hash = createHmac('sha256', secret).update(canonical(body)).digest('hex');
      const operation = await repo.reserve(actor, wid, digest(key), hash, input, { allowCreate: Boolean(provider) });
      if (operation.state === 'completed') return operation;
      const configuredProvider = identityProvider();
      try {
        const account = await configuredProvider.create(input.username, input.temporary_password, operation.marker);
        return await repo.finish(actor, wid, digest(key), account, input);
      } catch (e) {
        if (e instanceof ApiError && e.status < 500) throw e;
        throw new ApiError(503, 'ACCOUNT_PROVISIONING_PENDING', 'Creation may have succeeded; check operation and retry same key/body with current version');
      }
    }),
  };
}
