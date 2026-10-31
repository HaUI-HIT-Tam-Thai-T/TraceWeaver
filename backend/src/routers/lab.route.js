// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { Router } from 'express';
import { authenticateAccessToken } from '../middlewares/auth.middleware.js';
import { workspaceId } from '../validations/access.validation.js';
import { ApiError } from '../core/identity/api-error.js';
import { labCommand } from '../validations/lab.validation.js';

export function createLabRouter({ verifyToken, access, lab }) {
  const router = Router(),
    auth = authenticateAccessToken(verifyToken, access);
  router.use('/workspaces/:wid/lab', auth, (req, res, next) => {
    workspaceId(req.params.wid);
    if (!lab) throw new ApiError(503, 'LAB_UNAVAILABLE', 'Sandbox unavailable');
    if (Object.keys(req.query).length)
      throw new ApiError(400, 'INVALID_QUERY', 'No query parameters supported');
    if (req.method === 'POST' && !req.is('application/json'))
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON required');
    next();
  });
  const protect = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'LAB_UNAVAILABLE', 'Sandbox temporarily unavailable');
    }
  };
  router.get(
    '/workspaces/:wid/lab',
    protect(async (req, res) => res.json(await lab.read(req.identity.subject, req.params.wid))),
  );
  router.post(
    '/workspaces/:wid/lab/configure',
    protect(async (req, res) => {
      const body = req.body;
      if (
        !body ||
        Object.keys(body).some((k) => !['source_ids', 'ram'].includes(k)) ||
        !Array.isArray(body.source_ids)
      )
        throw new ApiError(400, 'INVALID_INPUT', 'Invalid sandbox configuration');
      body.source_ids.forEach(workspaceId);
      if (!Number.isSafeInteger(body.ram) || body.ram < 0 || body.ram > 1048576)
        throw new ApiError(400, 'INVALID_INPUT', 'Invalid RAM');
      res
        .status(201)
        .json(await lab.configure(req.identity.subject, req.params.wid, body.source_ids, body.ram));
    }),
  );
  router.post(
    '/workspaces/:wid/lab/commands',
    protect(async (req, res) => {
      const body = labCommand(req.body);
      res.json(await lab.command(req.identity.subject, req.params.wid, body));
    }),
  );
  router.get(
    '/workspaces/:wid/lab/requests/:rid/inspection',
    protect(async (req, res) =>
      res.json(await lab.inspect(req.identity.subject, req.params.wid, req.params.rid)),
    ),
  );
  return router;
}
