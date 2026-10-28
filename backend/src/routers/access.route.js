// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { authenticateAccessToken } from '../middlewares/auth.middleware.js';
import { createAccessController } from '../controllers/access.controller.js';

export function createAccessRouter({ verifyToken, access }) {
  const router = Router();
  const authenticate = authenticateAccessToken(verifyToken, access);
  const controller = createAccessController(access);
  router.get('/me', authenticate, controller.me);
  router.get('/workspaces/:wid/sources', authenticate, controller.sources);
  router.get('/workspaces/:wid/knowledge', authenticate, controller.knowledge);
  return router;
}
