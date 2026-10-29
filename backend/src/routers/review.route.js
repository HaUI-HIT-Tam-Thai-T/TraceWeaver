// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { authenticateAccessToken } from '../middlewares/auth.middleware.js';
import { createReviewController } from '../controllers/review.controller.js';
export function createReviewRouter({ verifyToken, access, reviews }) {
  const router = Router(), auth = authenticateAccessToken(verifyToken, access), controller = createReviewController(reviews);
  router.post('/workspaces/:wid/runs/:rid/links/:lid/reviews', auth, controller.review);
  router.post('/workspaces/:wid/runs/:rid/links', auth, controller.manual);
  return router;
}
