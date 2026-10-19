// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import express from 'express';
import { requestContext } from './middlewares/request.middleware.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { createHealthRouter } from './routers/health.route.js';
import { createAccessRouter } from './routers/access.route.js';

export function createApp({ checkReadiness, verifyToken, access, logError = () => {} }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use('/health', createHealthRouter(checkReadiness));
  app.use('/api/v1', express.json({ limit: 1048576, strict: true }));
  app.use('/api/v1', createAccessRouter({ verifyToken, access }));
  app.use(notFound);
  app.use(errorHandler(logError));
  return app;
}
