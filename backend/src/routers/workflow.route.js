// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { ApiError } from '../core/identity/api-error.js';
import { workspaceId } from '../validations/access.validation.js';
export function createWorkflowRouter({ verifyAppToken, verifyToken, workflows }) {
  const router = Router();
  async function context(req, res, next) {
    // Reject duplicates explicitly; Node normally discards duplicate Authorization headers.
    function bearer(name) {
      const occurrences = req.rawHeaders.filter((_, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === name).length;
      const header = req.headers[name];
      if (occurrences !== 1 || typeof header !== 'string' || header.length > 16384 || !/^Bearer [A-Za-z0-9_.-]+$/i.test(header)) {
        throw new ApiError(401, 'INVALID_TOKEN', 'App and end-user Bearer tokens are required');
      }
      return header.slice(7);
    }
    const appToken = bearer('authorization'), userToken = bearer('x-end-user-authorization');
    if (!verifyAppToken || !verifyToken || !workflows) throw new ApiError(503, 'CORE_NOT_READY', 'Core workflow is temporarily unavailable');
    req.appIdentity = await verifyAppToken(appToken); req.identity = await verifyToken(userToken);
    req.workspace = workspaceId(req.get('X-Workspace-Id'));
    if (Object.keys(req.query).length) throw new ApiError(400, 'INVALID_QUERY', 'Workflow query parameters are invalid');
    if (req.method === 'POST' && !req.is('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    if (req.get('Idempotency-Key') !== undefined) throw new ApiError(400, 'INVALID_QUERY', 'Core workflow does not support Idempotency-Key');
    res.set('Cache-Control', 'no-store'); next();
  }
  router.post('/instances', context, async (req, res) => {
    const result = await workflows.create(req.appIdentity.subject, req.identity.subject, req.workspace, req.body);
    res.location(`/core/v1/instances/${result.id}`).status(201).json(result);
  });
  router.get('/instances/:id', context, async (req, res) => {
    res.json(await workflows.get(req.appIdentity.subject, req.identity.subject, req.workspace, workspaceId(req.params.id)));
  });
  router.post('/instances/:id/transitions', context, async (req, res) => {
    res.json(await workflows.transition(req.appIdentity.subject, req.identity.subject, req.workspace, workspaceId(req.params.id), req.body));
  });
  return router;
}
