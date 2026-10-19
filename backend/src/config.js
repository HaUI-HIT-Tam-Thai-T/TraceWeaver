function positiveInteger(value, name, fallback, max) {
  const text = value ?? String(fallback);
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return Number(text);
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
  return Object.freeze({
    appEnv,
    host: env.API_HOST ?? '127.0.0.1',
    port: positiveInteger(env.API_PORT, 'API_PORT', 8080, 65535),
    databaseUrl: env.DATABASE_URL,
    poolMax: positiveInteger(env.DB_POOL_MAX, 'DB_POOL_MAX', 5, 50),
    shutdownTimeoutMs: positiveInteger(env.SHUTDOWN_TIMEOUT_MS, 'SHUTDOWN_TIMEOUT_MS', 10000, 60000),
  });
}
