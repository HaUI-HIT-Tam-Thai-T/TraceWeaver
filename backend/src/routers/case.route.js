// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { authenticateAccessToken } from '../middlewares/auth.middleware.js';
import { createCaseController } from '../controllers/case.controller.js';
export function createCaseRouter({ verifyToken, access, cases }) {
  const router = Router(),
    auth = authenticateAccessToken(verifyToken, access),
    controller = createCaseController(cases);
  router.post('/workspaces/:wid/cases', auth, controller.create);
  router.get('/workspaces/:wid/cases', auth, controller.list);
  router.get('/workspaces/:wid/cases/:cid', auth, controller.get);
  router.get('/workspaces/:wid/cases/:cid/sandbox', auth, controller.sandbox);
  router.post('/workspaces/:wid/cases/:cid/sandbox/commands', auth, controller.sandbox);
  router.get('/workspaces/:wid/cases/:cid/assignees', auth, controller.assignees);
  router.post('/workspaces/:wid/cases/:cid/evidence', auth, controller.evidence);
  router.post('/workspaces/:wid/cases/:cid/transitions', auth, controller.transition);
  router.post('/workspaces/:wid/cases/:cid/verifications', auth, controller.verify);
  router.get('/workspaces/:wid/cases/:cid/verifications', auth, controller.verifications);
  return router;
}
