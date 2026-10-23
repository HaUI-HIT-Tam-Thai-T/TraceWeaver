// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import express from 'express';
import { requestContext } from './middlewares/request.middleware.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { createHealthRouter } from './routers/health.route.js';
import { createAccessRouter } from './routers/access.route.js';
import { createIngestionRouter } from './routers/ingestion.route.js';
import { createEventRouter } from './routers/event.route.js';
import { createDocsRouter } from './routers/docs.route.js';
import { createRunRouter } from './routers/run.route.js';
import { createReviewRouter } from './routers/review.route.js';

export function createApp({ checkReadiness, verifyToken, verifyIngestToken, access, ingestion, events, runs, reviews, oidc, logError = () => {} }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use('/docs', createDocsRouter(oidc));
  app.use('/health', createHealthRouter(checkReadiness));
  app.use('/api/v1', express.json({ limit: 1048576, strict: true }));
  app.use('/api/v1', createAccessRouter({ verifyToken, access }));
  app.use('/api/v1', createIngestionRouter({ verifyToken: verifyIngestToken, access, ingestion }));
  app.use('/api/v1', createEventRouter({ verifyToken, access, events }));
  app.use('/api/v1', createRunRouter({ verifyToken, access, runs }));
  app.use('/api/v1', createReviewRouter({ verifyToken, access, reviews }));
  app.use(notFound);
  app.use(errorHandler(logError));
  return app;
}
