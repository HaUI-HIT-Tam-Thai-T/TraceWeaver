// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import contract from '../../contracts/openapi.json' with { type: 'json' };
const require = createRequire(import.meta.url);
const assets = dirname(require.resolve('swagger-ui-dist/package.json'));
const contracts = fileURLToPath(new URL('../../contracts/', import.meta.url));
const publicContract = structuredClone(contract);
// Swagger UI supports the OAS default dialect; retain the source schema unchanged.
delete publicContract.jsonSchemaDialect;
publicContract.servers = [{ url: '/' }];
for (const methods of Object.values(publicContract.paths)) for (const operation of Object.values(methods)) {
  operation.summary = `${operation.summary} [${operation['x-implementation-status']}]`;
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TraceWeaver Swagger UI</title><link rel="stylesheet" href="/docs/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="/docs/swagger-ui-bundle.js"></script><script src="/docs/swagger-ui-standalone-preset.js"></script><script src="/docs/initializer.js"></script></body></html>`;
const initializer = `window.ui=SwaggerUIBundle({urls:[{url:'/docs/openapi.json',name:'TraceWeaver API'},{url:'/docs/health.openapi.json',name:'Health'}],dom_id:'#swagger-ui',presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],layout:'StandaloneLayout',validatorUrl:null,persistAuthorization:false,queryConfigEnabled:false});`;

export function createDocsRouter() {
  const router = Router();
  router.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
  router.get('/', (req, res) => res.type('html').send(html));
  router.get('/initializer.js', (req, res) => res.type('js').send(initializer));
  router.get('/openapi.json', (req, res) => res.json(publicContract));
  router.get('/health.openapi.json', (req, res) => res.sendFile(join(contracts, 'health.openapi.json')));
  router.get('/schemas/domain.schema.json', (req, res) => res.sendFile(join(contracts, 'schemas/domain.schema.json')));
  for (const file of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js']) {
    router.get(`/${file}`, (req, res) => res.sendFile(join(assets, file)));
  }
  return router;
}
