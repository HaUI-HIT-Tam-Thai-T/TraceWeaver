// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
// Local-only fixture. Only ephemeral PUBLIC keys arrive via this environment.
const http = require('node:http');
const keys = JSON.parse(process.env.OIDC_TEST_JWKS || '{"keys":[]}');
http.createServer((req, res) => {
  if (req.method !== 'GET' || new URL(req.url, 'http://localhost').pathname !== '/realms/traceweaver/protocol/openid-connect/certs') {
    res.writeHead(501); return res.end('Endpoint outside this dependency contract');
  }
  const mode = process.env.OIDC_TEST_FAILURE;
  if (mode === 'hang') {
    setTimeout(() => { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify(keys)); }, 1000);
    return;
  }
  if (mode === 'html') { res.writeHead(500, {'content-type':'text/html'}); return res.end('<h1>Unavailable</h1>'); }
  if (mode === 'json') { res.writeHead(503, {'content-type':'application/json'}); return res.end('{"error":"unavailable"}'); }
  res.writeHead(200, {'content-type':'application/json'});
  res.end(JSON.stringify(keys));
}).listen(process.env.PORT || 4500);
