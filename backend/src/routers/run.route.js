// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { authenticateAccessToken } from '../middlewares/auth.middleware.js';
import { createRunController } from '../controllers/run.controller.js';
export function createRunRouter({ verifyToken, access, runs }) {
  const router = Router(),
    auth = authenticateAccessToken(verifyToken, access),
    controller = createRunController(runs);
  router.post('/workspaces/:wid/runs', auth, controller.create);
  router.get('/workspaces/:wid/runs/:rid', auth, controller.get);
  router.get('/workspaces/:wid/runs/:rid/graph', auth, controller.graph);
  return router;
}
