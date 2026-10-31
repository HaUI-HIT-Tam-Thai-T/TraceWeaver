// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { authenticateAccessToken } from '../middlewares/auth.middleware.js';
import { createDashboardController } from '../controllers/dashboard.controller.js';
export function createDashboardRouter({ verifyToken, access, dashboard }) {
  const router = Router();
  router.get(
    '/workspaces/:wid/dashboard',
    authenticateAccessToken(verifyToken, access),
    createDashboardController(dashboard),
  );
  return router;
}
