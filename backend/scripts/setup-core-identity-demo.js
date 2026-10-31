// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { readConfig } from '../src/config.js';
import { createTokenVerifier } from '../src/core/identity/token-verifier.js';
import { createDatabase, withTransaction } from '../src/core/data/database.js';
import {
  coreDemoTarget,
  coreClient,
  assertCoreClient,
  assertCoreAccount,
  configureCoreEnv,
} from './lib/core-demo.js';
const root = new URL('../../', import.meta.url);
let database,
  step = 'configuration';
try {
  const target = coreDemoTarget(),
    config = readConfig();
  const credentialsPath = new URL('demo-credentials.local.json', root),
    envPath = new URL('.env', root),
    realmPath = new URL('.local/keycloak/traceweaver-realm.json', root);
  const originalCredentials = await readFile(credentialsPath, 'utf8'),
    credentials = JSON.parse(originalCredentials);
  const originalEnv = await readFile(envPath, 'utf8'),
    originalRealm = await readFile(realmPath, 'utf8'),
    realm = JSON.parse(originalRealm);
  if (
    realm.realm !== 'traceweaver' ||
    credentials.workspace_id !== '10000000-0000-4000-8000-000000000015'
  )
    throw new Error('Reserved demo scope required');
  const jsonFetch = async (url, options = {}, expected = 200) => {
    const response = await fetch(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status !== expected) throw new Error('Local identity request failed');
    return expected === 201 || expected === 204 ? null : response.json();
  };
  step = 'local administrator authentication';
  const admin = await jsonFetch(`${target.origin}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: credentials.admin.username,
      password: credentials.admin.password,
    }),
  });
  const endpoint = `${target.origin}/admin/realms/traceweaver/clients`;
  const headers = {
    Authorization: `Bearer ${admin.access_token}`,
    'Content-Type': 'application/json',
  };
  step = 'core client discovery';
  let clients = (await jsonFetch(`${endpoint}?clientId=traceweaver-core`, { headers })).filter(
    (client) => client.clientId === 'traceweaver-core',
  );
  if (clients.length > 1 || (clients.length && !credentials.core))
    throw new Error('Existing unowned core client');
  if (
    credentials.core &&
    (credentials.core.clientId !== 'traceweaver-core' ||
      typeof credentials.core.clientSecret !== 'string' ||
      credentials.core.clientSecret.length < 32)
  )
    throw new Error('Invalid saved core credentials');
  if (!credentials.core) {
    credentials.core = {
      clientId: 'traceweaver-core',
      clientSecret: randomBytes(24).toString('base64url'),
    };
    // Persist before remote creation so an interrupted run can reuse the same secret.
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  }
  const client = coreClient(credentials.core.clientSecret);
  if (!clients.length) {
    step = 'core client creation';
    await jsonFetch(endpoint, { method: 'POST', headers, body: JSON.stringify(client) }, 201);
    clients = (await jsonFetch(`${endpoint}?clientId=traceweaver-core`, { headers })).filter(
      (item) => item.clientId === 'traceweaver-core',
    );
  }
  if (clients.length !== 1) throw new Error('Core client is not unique');
  const clientUrl = `${endpoint}/${encodeURIComponent(clients[0].id)}`;
  step = 'core client profile';
  assertCoreClient(await jsonFetch(clientUrl, { headers }));
  step = 'core service account';
  const account = await jsonFetch(`${clientUrl}/service-account-user`, { headers });
  assertCoreAccount(account, credentials.core.subject);
  assertCoreAccount(account, config.oidcAppSubject);
  const updatedEnv = configureCoreEnv(originalEnv, account.id);
  step = 'core credential and signature verification';
  const token = await jsonFetch(`${target.issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: 'traceweaver-core',
      client_secret: credentials.core.clientSecret,
    }),
  });
  const identity = await createTokenVerifier({
    ...config,
    oidcIssuer: target.issuer,
    oidcUserClientId: 'traceweaver-core',
    oidcJwksUri: `${target.issuer}/protocol/openid-connect/certs`,
  })(token.access_token);
  if (identity.subject !== account.id) throw new Error('Core service token subject mismatch');
  const importClient = realm.clients?.find((item) => item.clientId === 'traceweaver-core');
  if (importClient) {
    assertCoreClient(importClient);
    if (importClient.secret !== credentials.core.clientSecret)
      throw new Error('Core import secret mismatch');
  }
  const importAccount = realm.users?.find(
    (item) => item.serviceAccountClientId === 'traceweaver-core',
  );
  if (importAccount && importAccount.id !== account.id)
    throw new Error('Core import account mismatch');
  step = 'service workspace membership';
  database = createDatabase(config);
  await withTransaction(database, async (connection) => {
    // Reruns never restore a revoked membership or grant data roles/source access.
    await connection.query(
      'INSERT INTO core.memberships(workspace_id,subject) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [credentials.workspace_id, account.id],
    );
    const {
      rows: [membership],
    } = await connection.query(
      'SELECT revoked_at FROM core.memberships WHERE workspace_id=$1 AND subject=$2',
      [credentials.workspace_id, account.id],
    );
    if (!membership || membership.revoked_at) throw new Error('Core service membership is revoked');
  });
  step = 'local configuration files';
  credentials.core.subject = account.id;
  const updatedCredentials = JSON.stringify(credentials, null, 2);
  if (updatedCredentials !== (await readFile(credentialsPath, 'utf8')))
    await writeFile(credentialsPath, updatedCredentials, { mode: 0o600 });
  if (!importClient) realm.clients.push(client);
  if (!importAccount)
    realm.users.push({
      id: account.id,
      username: account.username,
      enabled: true,
      serviceAccountClientId: 'traceweaver-core',
    });
  if (!importClient || !importAccount)
    await writeFile(realmPath, JSON.stringify(realm, null, 2), { mode: 0o600 });
  if (updatedEnv !== originalEnv) await writeFile(envPath, updatedEnv, { mode: 0o600 });
  console.log(
    'Local core identity prepared: confidential service client, verified JWT subject, active workspace membership and CORE_APP configuration. Existing user/ingest credentials preserved; secrets/tokens withheld. Recreate the API container to load configuration.',
  );
} catch {
  console.error(`CORE_IDENTITY_DEMO_SETUP_FAILED at ${step}; credentials and tokens withheld`);
  process.exitCode = 1;
} finally {
  if (database) await database.end();
}
