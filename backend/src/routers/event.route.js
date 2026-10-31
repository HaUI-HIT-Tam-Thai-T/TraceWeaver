// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { authenticateAccessToken } from '../middlewares/auth.middleware.js';
import { createEventController } from '../controllers/event.controller.js';
export function createEventRouter({ verifyToken, access, events }) {
  const router = Router(),
    auth = authenticateAccessToken(verifyToken, access),
    controller = createEventController(events);
  router.get('/workspaces/:wid/events', auth, controller.list);
  router.get('/workspaces/:wid/events/:eid', auth, controller.detail);
  return router;
}
