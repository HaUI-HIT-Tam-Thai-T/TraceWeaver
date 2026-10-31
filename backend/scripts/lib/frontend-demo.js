// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
export function frontendClient(client, origins) {
  if (
    client.clientId !== 'traceweaver-web' ||
    client.publicClient !== true ||
    client.standardFlowEnabled !== true ||
    client.directAccessGrantsEnabled !== false ||
    client.implicitFlowEnabled !== false ||
    client.attributes?.['pkce.code.challenge.method'] !== 'S256'
  )
    throw new Error('Unexpected local public client profile');
  return {
    ...client,
    webOrigins: [...new Set([...(client.webOrigins ?? []), ...origins])],
    redirectUris: [
      ...new Set([
        ...(client.redirectUris ?? []),
        ...origins.map((origin) => `${origin}/auth/callback`),
      ]),
    ],
  };
}
