// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
// Keep the same identity assertions with a native loopback JWKS dependency.
import { registerHooks } from 'node:module';
const target = new URL('./oidc-simulation.js', import.meta.url).href;
const replacement = new URL('./oidc-native-fixture.js', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    return result.url === target ? { ...result, url: replacement } : result;
  },
});
