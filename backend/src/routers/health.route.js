// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { createHealthController } from '../controllers/health.controller.js';
import { createHealthService } from '../services/health.service.js';

export function createHealthRouter(checkReadiness) {
  const router = Router();
  const controller = createHealthController(createHealthService(checkReadiness));
  router.get('/live', controller.live);
  router.get('/ready', controller.ready);
  return router;
}
