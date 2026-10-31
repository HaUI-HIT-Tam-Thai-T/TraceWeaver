// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { authenticateAccessToken } from '../middlewares/auth.middleware.js';
import { createIngestionController } from '../controllers/ingestion.controller.js';
export function createIngestionRouter({ verifyToken, access, ingestion }) {
  const router = Router();
  router.post(
    '/workspaces/:wid/sources/:sid/events\\:batch',
    authenticateAccessToken(verifyToken, access),
    createIngestionController(ingestion),
  );
  return router;
}
