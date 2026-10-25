// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

export function coreDemoTarget(env = process.env) {
  const port = env.IDENTITY_PORT ?? '8081';
  if ((env.APP_ENV ?? 'development') !== 'development' || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 ||
      (env.CORE_APP_CLIENT_ID ?? 'traceweaver-core') !== 'traceweaver-core' ||
      (env.OIDC_API_AUDIENCE ?? 'traceweaver-api') !== 'traceweaver-api') throw new Error('Invalid local core demo configuration');
  const url = new URL(env.OIDC_ISSUER ?? `http://localhost:${port}/realms/traceweaver`);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/realms/traceweaver' || url.username || url.password || url.search || url.hash) throw new Error('Core demo requires local traceweaver realm');
  return { issuer: url.href, origin: url.origin };
}
export function coreClient(secret) {
  return { clientId: 'traceweaver-core', enabled: true, protocol: 'openid-connect', publicClient: false,
    clientAuthenticatorType: 'client-secret', secret, standardFlowEnabled: false, directAccessGrantsEnabled: false,
    implicitFlowEnabled: false, serviceAccountsEnabled: true, fullScopeAllowed: false, redirectUris: [], webOrigins: [],
    protocolMappers: [{ name: 'API audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
      config: { 'included.custom.audience': 'traceweaver-api', 'access.token.claim': 'true', 'id.token.claim': 'false' } }] };
}
export function assertCoreClient(client) {
  if (client.clientId !== 'traceweaver-core' || client.enabled !== true || client.protocol !== 'openid-connect' ||
      client.publicClient !== false || client.clientAuthenticatorType !== 'client-secret' || client.serviceAccountsEnabled !== true ||
      client.standardFlowEnabled !== false || client.directAccessGrantsEnabled !== false || client.implicitFlowEnabled !== false ||
      client.fullScopeAllowed !== false || (client.redirectUris ?? []).length || (client.webOrigins ?? []).length ||
      !client.protocolMappers?.some((mapper) => mapper.protocolMapper === 'oidc-audience-mapper' &&
        mapper.config?.['included.custom.audience'] === 'traceweaver-api' && mapper.config?.['access.token.claim'] === 'true')) {
    throw new Error('Existing core client does not match the service-only profile');
  }
}
export function assertCoreAccount(account, savedSubject) {
  // Keycloak's service-account-user endpoint may omit serviceAccountClientId.
  // The client-specific endpoint plus a signed client token binds the account.
  if (account.enabled !== true || account.username !== 'service-account-traceweaver-core' ||
      typeof account.id !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(account.id) ||
      (account.serviceAccountClientId !== undefined && account.serviceAccountClientId !== 'traceweaver-core') ||
      (savedSubject && savedSubject !== account.id)) throw new Error('Core service account does not match');
}
export function configureCoreEnv(text, subject) {
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(subject)) throw new Error('Invalid core subject');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  let result = text;
  for (const [key, value] of [['CORE_APP_CLIENT_ID', 'traceweaver-core'], ['CORE_APP_SUBJECT', subject]]) {
    const pattern = new RegExp(`^${key}=([^\\r\\n]*)`, 'gm'), matches = [...result.matchAll(pattern)];
    if (matches.length > 1 || (matches.length && !['', value].includes(matches[0][1]))) throw new Error('Conflicting core environment configuration');
    if (matches.length) result = result.replace(pattern, `${key}=${value}`);
    else result += `${result && !result.endsWith('\n') ? newline : ''}${key}=${value}${newline}`;
  }
  return result;
}
