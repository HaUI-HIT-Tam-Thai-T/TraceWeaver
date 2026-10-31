// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { readConfig } from '../src/config.js';
import { createDatabase, withTransaction } from '../src/core/data/database.js';
const root = new URL('../../', import.meta.url);
const workspace = '10000000-0000-4000-8000-000000000015';
const operator = '20000000-0000-4000-8000-000000000015',
  viewer = '20000000-0000-4000-8000-000000000016',
  service = '20000000-0000-4000-8000-000000000017';
const secret = () => randomBytes(24).toString('base64url');
let database;
try {
  if ((process.env.APP_ENV ?? 'development') !== 'development')
    throw new Error('Demo setup is development-only');
  const config = readConfig();
  const credentialsPath = new URL('demo-credentials.local.json', root);
  let credentials;
  try {
    credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    credentials = {
      admin: { username: 'local-admin', password: secret() },
      operator: { username: 'demo.operator', password: secret(), subject: operator },
      viewer: { username: 'demo.viewer', password: secret(), subject: viewer },
      ingest: { clientId: 'traceweaver-ingest', clientSecret: secret(), subject: service },
      workspace_id: workspace,
    };
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
  }
  const apiPort = Number(process.env.API_PORT ?? 8080),
    identityPort = Number(process.env.IDENTITY_PORT ?? 8081);
  if (![apiPort, identityPort].every((p) => Number.isInteger(p) && p > 0 && p <= 65535))
    throw new Error('Invalid local ports');
  const audience = {
    name: 'API audience',
    protocol: 'openid-connect',
    protocolMapper: 'oidc-audience-mapper',
    config: {
      'included.custom.audience': 'traceweaver-api',
      'access.token.claim': 'true',
      'id.token.claim': 'false',
    },
  };
  const user = (key) => ({
    id: credentials[key].subject,
    username: credentials[key].username,
    enabled: true,
    emailVerified: true,
    email: `${key}@traceweaver.test`,
    firstName: 'Demo',
    lastName: key,
    requiredActions: [],
    credentials: [{ type: 'password', value: credentials[key].password, temporary: false }],
  });
  const realm = {
    realm: 'traceweaver',
    enabled: true,
    displayName: 'TraceWeaver Local',
    sslRequired: 'none',
    registrationAllowed: true,
    resetPasswordAllowed: false,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    bruteForceProtected: true,
    accessTokenLifespan: 300,
    clients: [
      {
        clientId: 'traceweaver-web',
        enabled: true,
        protocol: 'openid-connect',
        publicClient: true,
        standardFlowEnabled: true,
        directAccessGrantsEnabled: false,
        implicitFlowEnabled: false,
        redirectUris: [
          `http://localhost:${apiPort}/docs/oauth2-redirect.html`,
          `http://127.0.0.1:${apiPort}/docs/oauth2-redirect.html`,
          ...config.frontendOrigins.map((origin) => `${origin}/auth/callback`),
        ],
        webOrigins: [
          `http://localhost:${apiPort}`,
          `http://127.0.0.1:${apiPort}`,
          ...config.frontendOrigins,
        ],
        attributes: { 'pkce.code.challenge.method': 'S256' },
        protocolMappers: [audience],
      },
      {
        clientId: 'traceweaver-ingest',
        enabled: true,
        protocol: 'openid-connect',
        publicClient: false,
        clientAuthenticatorType: 'client-secret',
        secret: credentials.ingest.clientSecret,
        standardFlowEnabled: false,
        directAccessGrantsEnabled: false,
        serviceAccountsEnabled: true,
        protocolMappers: [audience],
      },
    ],
    users: [
      user('operator'),
      user('viewer'),
      {
        id: service,
        username: 'service-account-traceweaver-ingest',
        enabled: true,
        serviceAccountClientId: 'traceweaver-ingest',
      },
    ],
  };
  await mkdir(new URL('.local/keycloak/', root), { recursive: true });
  // Reuse the original realm on reruns; do not reset existing identities/passwords.
  try {
    await access(new URL('.local/keycloak/traceweaver-realm.json', root));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(
      new URL('.local/keycloak/traceweaver-realm.json', root),
      JSON.stringify(realm, null, 2),
      { flag: 'wx', mode: 0o600 },
    );
  }
  try {
    await access(new URL('.env.keycloak.local', root));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(
      new URL('.env.keycloak.local', root),
      `KC_BOOTSTRAP_ADMIN_USERNAME=${credentials.admin.username}\nKC_BOOTSTRAP_ADMIN_PASSWORD=${credentials.admin.password}\n`,
      { flag: 'wx', mode: 0o600 },
    );
  }
  database = createDatabase(config);
  await withTransaction(database, async (client) => {
    await client.query(
      'INSERT INTO core.workspaces(id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [workspace, 'TraceWeaver Demo'],
    );
    for (const [subject, roles] of [
      [operator, ['operator']],
      [viewer, ['viewer']],
      [service, ['ingest_service']],
    ]) {
      await client.query(
        'INSERT INTO core.memberships(workspace_id,subject) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [workspace, subject],
      );
      for (const role of roles)
        await client.query(
          'INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [workspace, subject, role],
        );
    }
    for (const [index, name] of ['intake', 'account', 'provision'].entries()) {
      const source = `30000000-0000-4000-8000-${String(index + 15).padStart(12, '0')}`;
      await client.query(
        'INSERT INTO core.sources(id,workspace_id,source_key,name,service,parser_version) VALUES ($1,$2,$3,$3,$3,$4) ON CONFLICT DO NOTHING',
        [source, workspace, name, `${name}-v1`],
      );
      for (const [subject, permission, suffix] of [
        [operator, 'read', 1],
        [viewer, 'read', 2],
        [service, 'ingest', 3],
      ]) {
        const grant = `40000000-0000-4000-8000-${String(index * 10 + suffix + 150).padStart(12, '0')}`;
        await client.query(
          `INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,$4,$5,'local-demo-setup') ON CONFLICT DO NOTHING`,
          [grant, workspace, source, subject, permission],
        );
      }
    }
  });
  console.log(
    `Local identity demo prepared. Credentials: demo-credentials.local.json (ignored). IdP port ${identityPort}; workspace ${workspace}.`,
  );
} catch {
  console.error(
    'IDENTITY_DEMO_SETUP_FAILED: check development mode, existing local credential files and database/migrations',
  );
  process.exitCode = 1;
} finally {
  if (database) await database.end();
}
