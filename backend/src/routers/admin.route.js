// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { Router } from 'express';
import { authenticateAccessToken } from '../middlewares/auth.middleware.js';
import { workspaceId } from '../validations/access.validation.js';
import { adminSubject } from '../validations/admin.validation.js';
import { ApiError } from '../core/identity/api-error.js';
export function createAdminRouter({ verifyToken, access, admin }) {
  const router = Router();
  router.use('/workspaces/:wid/admin', authenticateAccessToken(verifyToken, access), (req, res, next) => {
    workspaceId(req.params.wid);
    if (!admin) throw new ApiError(503, 'ADMIN_UNAVAILABLE', 'Workspace administration unavailable');
    if (req.method !== 'GET' && !req.is('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON required');
    if (req.method !== 'GET' && Object.keys(req.query).length) throw new ApiError(400, 'INVALID_QUERY', 'Unexpected query');
    next();
  });
  const root = '/workspaces/:wid/admin';
  router.get(root + '/accounts/provisioning', async (req, res) => {
    if (Object.keys(req.query).length) throw new ApiError(400, 'INVALID_QUERY', 'Unexpected query');
    res.json(await admin.operation(req.identity.subject, req.params.wid, req.get('Idempotency-Key')));
  });
  router.get(root + '/members', async (req, res) => {
    const { limit = '50', after } = req.query;
    if (Object.keys(req.query).some(k => !['limit', 'after'].includes(k)) || typeof limit !== 'string' || !/^\d+$/.test(limit) || +limit < 1 || +limit > 100) throw new ApiError(400, 'INVALID_QUERY', 'Invalid member query');
    if (after !== undefined) adminSubject(after);
    res.json(await admin.list(req.identity.subject, req.params.wid, +limit, after));
  });
  router.post(root + '/members', async (req, res) => res.status(201).json(await admin.add(req.identity.subject, req.params.wid, req.body)));
  router.put(root + '/members/:subject', async (req, res) => res.json(await admin.member(req.identity.subject, req.params.wid, adminSubject(req.params.subject), req.body)));
  router.put(root + '/members/:subject/sources/:sid', async (req, res) => res.json(await admin.source(req.identity.subject, req.params.wid, adminSubject(req.params.subject), workspaceId(req.params.sid), req.body)));
  router.post(root + '/accounts', async (req, res) => res.status(201).json(await admin.account(req.identity.subject, req.params.wid, req.body, req.get('Idempotency-Key'))));
  return router;
}
