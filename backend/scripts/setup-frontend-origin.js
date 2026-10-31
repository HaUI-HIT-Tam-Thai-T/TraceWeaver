// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { readFile, writeFile } from 'node:fs/promises';
import { readConfig } from '../src/config.js';
import { coreDemoTarget } from './lib/core-demo.js';
import { frontendClient } from './lib/frontend-demo.js';

try {
  const target = coreDemoTarget(),
    config = readConfig();
  if (config.oidcUserClientId !== 'traceweaver-web')
    throw new Error('Reserved demo client required');
  const root = new URL('../../', import.meta.url);
  const credentials = JSON.parse(
    await readFile(new URL('demo-credentials.local.json', root), 'utf8'),
  );
  const realmPath = new URL('.local/keycloak/traceweaver-realm.json', root);
  const original = await readFile(realmPath, 'utf8'),
    realm = JSON.parse(original);
  if (realm.realm !== 'traceweaver') throw new Error('Reserved demo realm required');
  const call = async (url, options = {}, status = 200) => {
    const response = await fetch(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status !== status) throw new Error('Local identity request failed');
    return status === 204 ? null : response.json();
  };
  const token = await call(`${target.origin}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: credentials.admin.username,
      password: credentials.admin.password,
    }),
  });
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    'Content-Type': 'application/json',
  };
  const endpoint = `${target.origin}/admin/realms/traceweaver/clients`;
  const clients = (await call(`${endpoint}?clientId=traceweaver-web`, { headers })).filter(
    (x) => x.clientId === 'traceweaver-web',
  );
  if (clients.length !== 1) throw new Error('Public client must be unique');
  const url = `${endpoint}/${encodeURIComponent(clients[0].id)}`;
  const current = await call(url, { headers }),
    updated = frontendClient(current, config.frontendOrigins);
  const imported = realm.clients.find((x) => x.clientId === 'traceweaver-web');
  if (!imported) throw new Error('Public import client missing');
  const updatedImport = frontendClient(imported, config.frontendOrigins);
  if (JSON.stringify(current) !== JSON.stringify(updated))
    await call(url, { method: 'PUT', headers, body: JSON.stringify(updated) }, 204);
  const verified = await call(url, { headers });
  if (
    config.frontendOrigins.some(
      (origin) =>
        !verified.webOrigins.includes(origin) ||
        !verified.redirectUris.includes(`${origin}/auth/callback`),
    )
  )
    throw new Error('Frontend callback verification failed');
  Object.assign(imported, updatedImport);
  if (JSON.stringify(realm) !== JSON.stringify(JSON.parse(original)))
    await writeFile(realmPath, JSON.stringify(realm, null, 2), { mode: 0o600 });
  console.log(
    'Frontend origins and exact /auth/callback redirects verified on the local public PKCE client. Existing credentials and service clients preserved.',
  );
} catch {
  console.error(
    'FRONTEND_ORIGIN_SETUP_FAILED: check local demo identity, configuration and client profile; secrets withheld',
  );
  process.exitCode = 1;
}
