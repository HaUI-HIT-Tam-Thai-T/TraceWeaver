// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from './api-error.js';

export function createTokenVerifier(config) {
  const keys = createRemoteJWKSet(new URL(config.oidcJwksUri), {
    timeoutDuration: config.oidcTimeoutMs,
    cooldownDuration: 5000,
    cacheMaxAge: 300000,
  });
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ['RS256'], issuer: config.oidcIssuer, audience: config.oidcAudience,
        requiredClaims: ['sub', 'exp', 'iat', 'azp', 'typ'], clockTolerance: 5,
      });
      if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 255 ||
          payload.typ !== 'Bearer' || payload.azp !== config.oidcUserClientId) {
        throw new ApiError(401, 'INVALID_TOKEN', 'Access token is not valid for this API');
      }
      // Never trust token role/group claims as the current source of app authorization.
      return { subject: payload.sub };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (/^ERR_(JWT|JWS)_/.test(error.code ?? '') ||
          ['ERR_JOSE_ALG_NOT_ALLOWED', 'ERR_JOSE_NOT_SUPPORTED', 'ERR_JWKS_NO_MATCHING_KEY', 'ERR_JWKS_MULTIPLE_MATCHING_KEYS'].includes(error.code)) {
        throw new ApiError(401, 'INVALID_TOKEN', 'Access token is not valid for this API');
      }
      throw new ApiError(503, 'IDENTITY_UNAVAILABLE', 'Identity verification is temporarily unavailable');
    }
  };
}
