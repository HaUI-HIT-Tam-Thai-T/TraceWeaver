// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

function positiveInteger(value, name, fallback, max) {
  const text = value ?? String(fallback);
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return Number(text);
}

function identityUrl(value, name, appEnv) {
  try {
    const url = new URL(value);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'https:' && !(appEnv !== 'production' && loopback && url.protocol === 'http:'))) throw new Error();
    return url.href.replace(/\/$/, '');
  } catch { throw new Error(`${name} must be a trusted HTTPS URL (loopback HTTP allowed outside production)`); }
}

export function readConfig(env = process.env) {
  const appEnv = env.APP_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(appEnv)) {
    throw new Error('APP_ENV must be development, test or production');
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
  const oidcAudience = env.OIDC_API_AUDIENCE ?? 'traceweaver-api';
  const oidcUserClientId = env.OIDC_CLIENT_ID ?? 'traceweaver-web';
  const oidcIngestClientId = env.INGEST_CLIENT_ID ?? 'traceweaver-ingest';
  if (![oidcAudience, oidcUserClientId, oidcIngestClientId].every((value) => value.trim().length > 0 && value.length <= 255) || oidcUserClientId === oidcIngestClientId) throw new Error('OIDC client/audience configuration is invalid');
  if (typeof env.CURSOR_SECRET !== 'string' || env.CURSOR_SECRET.length < 32) throw new Error('CURSOR_SECRET must contain at least 32 characters');
  return Object.freeze({
    appEnv,
    host: env.API_HOST ?? '127.0.0.1',
    port: positiveInteger(env.API_PORT, 'API_PORT', 8080, 65535),
    databaseUrl: env.DATABASE_URL,
    poolMax: positiveInteger(env.DB_POOL_MAX, 'DB_POOL_MAX', 5, 50),
    shutdownTimeoutMs: positiveInteger(env.SHUTDOWN_TIMEOUT_MS, 'SHUTDOWN_TIMEOUT_MS', 10000, 60000),
    oidcIssuer, oidcAudience, oidcUserClientId, oidcIngestClientId,
    oidcJwksUri: identityUrl(env.OIDC_JWKS_URI ?? `${oidcIssuer}/protocol/openid-connect/certs`, 'OIDC_JWKS_URI', appEnv),
    oidcTimeoutMs: positiveInteger(env.OIDC_TIMEOUT_MS, 'OIDC_TIMEOUT_MS', 2000, 10000),
    cursorSecret: env.CURSOR_SECRET,
  });
}
