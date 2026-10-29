// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { SANDBOX_MODEL_VERSION } from './core/reconstruction/scorer-model.js';

function positiveInteger(value, name, fallback, max) {
  const text = value ?? String(fallback);
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return Number(text);
}

function identityUrl(value, name, appEnv, allowLocalKeycloak = false) {
  try {
    const url = new URL(value);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    const localPaths = { OIDC_JWKS_URI: '/realms/traceweaver/protocol/openid-connect/certs', ACCOUNT_ADMIN_BASE_URL: '/identity/admin/realms/traceweaver' };
    const localKeycloak = allowLocalKeycloak && url.hostname === 'keycloak' && url.port === '8080' && url.pathname === localPaths[name];
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' &&
          ((appEnv !== 'production' && (loopback || localKeycloak)) || (name === 'ACCOUNT_ADMIN_BASE_URL' && localKeycloak))))) throw new Error();
    return url.href.replace(/\/$/, '');
  } catch { throw new Error(`${name} must be a trusted HTTPS URL (loopback HTTP allowed outside production)`); }
}

export function readConfig(env = process.env) {
  const labIngestSubject = env.LAB_INGEST_SUBJECT ?? '';
  if (typeof labIngestSubject !== 'string' || labIngestSubject.length > 255 || labIngestSubject.includes('\u0000') ||
      !labIngestSubject.isWellFormed() || (labIngestSubject && !labIngestSubject.trim())) throw new Error('LAB_INGEST_SUBJECT is invalid');
  const appEnv = env.APP_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(appEnv)) {
    throw new Error('APP_ENV must be development, test or production');
  }
  const frontendPort = positiveInteger(env.FRONTEND_PORT, 'FRONTEND_PORT', 3000, 65535);
  const frontendOrigins = (env.FRONTEND_ORIGINS ?? (appEnv === 'production' ? '' : `http://localhost:${frontendPort},http://127.0.0.1:${frontendPort}`))
    .split(',').map((value) => value.trim()).filter(Boolean);
  for (const value of frontendOrigins) {
    try {
      const origin = new URL(value), local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
      if (origin.origin !== value || origin.username || origin.password || origin.hostname.includes('*') ||
          (origin.protocol !== 'https:' && !(appEnv !== 'production' && local && origin.protocol === 'http:'))) throw new Error();
    } catch { throw new Error('FRONTEND_ORIGINS must contain exact HTTPS origins (loopback HTTP allowed outside production)'); }
  }
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with credentials and database');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname ||
      !url.username || !url.password || url.pathname.length < 2 || url.hash) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with credentials and database');
  }
  const oidcIssuer = identityUrl(env.OIDC_ISSUER ?? 'http://localhost:8081/realms/traceweaver', 'OIDC_ISSUER', appEnv);
  const accountClientId = env.ACCOUNT_ADMIN_CLIENT_ID ?? '', accountClientSecret = env.ACCOUNT_ADMIN_CLIENT_SECRET ?? '';
  if ((accountClientId || accountClientSecret) && (!/^[a-zA-Z0-9._-]{1,100}$/.test(accountClientId) ||
      !/^[\x21-\x7e]{32,255}$/.test(accountClientSecret))) throw new Error('Account administration client configuration is invalid');
  const oidcAudience = env.OIDC_API_AUDIENCE ?? 'traceweaver-api';
  const oidcUserClientId = env.OIDC_CLIENT_ID ?? 'traceweaver-web';
  const oidcIngestClientId = env.INGEST_CLIENT_ID ?? 'traceweaver-ingest';
  const oidcAppClientId = env.CORE_APP_CLIENT_ID ?? 'traceweaver-core';
  const oidcAppSubject = env.CORE_APP_SUBJECT ?? '';
  if (typeof oidcAppClientId !== 'string' || !oidcAppClientId.trim() || oidcAppClientId.length > 255 ||
      [oidcUserClientId, oidcIngestClientId].includes(oidcAppClientId) || typeof oidcAppSubject !== 'string' ||
      oidcAppSubject.length > 255 || oidcAppSubject.includes('\u0000') || !oidcAppSubject.isWellFormed() ||
      (oidcAppSubject && !oidcAppSubject.trim())) throw new Error('OIDC core app configuration is invalid');
  if (![oidcAudience, oidcUserClientId, oidcIngestClientId].every((value) => value.trim().length > 0 && value.length <= 255) || oidcUserClientId === oidcIngestClientId) throw new Error('OIDC client/audience configuration is invalid');
  if (typeof env.CURSOR_SECRET !== 'string' || env.CURSOR_SECRET.length < 32) throw new Error('CURSOR_SECRET must contain at least 32 characters');
  const scorerUrl = env.SCORER_URL ? identityUrl(env.SCORER_URL, 'SCORER_URL', appEnv) : null;
  const scorerSecret = env.SCORER_SERVICE_SECRET ?? '';
  const scorerModelVersion = env.SCORER_MODEL_VERSION ?? '';
  if (scorerModelVersion !== '' && scorerModelVersion !== SANDBOX_MODEL_VERSION) throw new Error('SCORER_MODEL_VERSION is not supported');
  if (scorerUrl && (scorerSecret.length < 32 || !/^[\x21-\x7e]+$/.test(scorerSecret))) throw new Error('SCORER_SERVICE_SECRET must contain at least 32 printable ASCII characters');
  return Object.freeze({
    labIngestSubject,
    accountAdminBaseUrl: env.ACCOUNT_ADMIN_BASE_URL ? identityUrl(env.ACCOUNT_ADMIN_BASE_URL, 'ACCOUNT_ADMIN_BASE_URL', appEnv, true) : '',
    accountClientId, accountClientSecret,
    scorerUrl, scorerSecret, scorerModelVersion, scorerTimeoutMs: positiveInteger(env.SCORER_TIMEOUT_MS, 'SCORER_TIMEOUT_MS', 5000, 5000),
    appEnv,
    frontendOrigins: Object.freeze([...new Set(frontendOrigins)]),
    host: env.API_HOST ?? '127.0.0.1',
    port: positiveInteger(env.API_PORT, 'API_PORT', 8080, 65535),
    databaseUrl: env.DATABASE_URL,
    poolMax: positiveInteger(env.DB_POOL_MAX, 'DB_POOL_MAX', 5, 50),
    shutdownTimeoutMs: positiveInteger(env.SHUTDOWN_TIMEOUT_MS, 'SHUTDOWN_TIMEOUT_MS', 10000, 60000),
    oidcIssuer, oidcAudience, oidcUserClientId, oidcIngestClientId, oidcAppClientId, oidcAppSubject,
    oidcJwksUri: identityUrl(env.OIDC_JWKS_URI ?? `${oidcIssuer}/protocol/openid-connect/certs`, 'OIDC_JWKS_URI', appEnv, env.OIDC_LOCAL_KEYCLOAK === 'true'),
    oidcTimeoutMs: positiveInteger(env.OIDC_TIMEOUT_MS, 'OIDC_TIMEOUT_MS', 2000, 10000),
    cursorSecret: env.CURSOR_SECRET,
  });
}
