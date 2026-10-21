# Local Keycloak + Swagger login

Keycloak26.8.1 runs in development mode at `http://localhost:8081`, pinned to official image digest sha256:79c623a22abacf3fe6c00a5fb30f5b7843d717b234033b80995891c06116d244. Its named `keycloak_data` volume is separate from the existing application PostgreSQL volume. H2 is local development storage, not a production deployment.

## Already prepared on this machine

API and Keycloak are running. Open `http://localhost:8080/docs/`, refresh the page, then:

1. Click **Authorize**, find **keycloakLogin (OAuth2, authorizationCode with PKCE)**.
2. Keep client_id `traceweaver-web`; leave client_secret empty. The scopes are preconfigured.
3. Click **Authorize** in that OAuth2 section. Sign in as `demo.operator` or `demo.viewer` using the random password in root `demo-credentials.local.json`.
4. Return to Swagger, close Authorize, execute `GET /api/v1/me` →200. No token copy/paste is required. If a popup does not open in an embedded browser, allow popups or use Chrome/Edge.

Use workspace `10000000-0000-4000-8000-000000000015` for sources/knowledge/events. There are three sources (intake/account/provision), with source UUIDs ending000000000015/16/17. Demo event `keycloak-demo-smoke-v1` is available in intake. Both demo users have read grants; operator has the operator role, viewer has only viewer. Neither user token is an ingest-service token.

## Fresh checkout/bootstrap

Use Node24 and installed root dependencies. First create the existing application `.env` with `npm run db:setup` if absent, then:

```powershell
npm run db:up
npm run db:migrate
node --env-file-if-exists=.env backend/scripts/setup-identity-demo.js
docker compose up -d --build --wait api
node --env-file-if-exists=.env backend/scripts/verify-keycloak-demo.js
```

Setup generates `demo-credentials.local.json`, `.env.keycloak.local` and `.local/keycloak/traceweaver-realm.json`, all Git-ignored, and seeds only reserved demo IDs. It reuses existing credentials, realm and DB rows on reruns. It does not reset existing passwords, replace .env or drop volumes. Keep the credentials/import files matched to the existing Keycloak volume; do not delete/regenerate them to reset a running realm. Keycloak startup import does not overwrite an already imported realm. The default local demo uses realm traceweaver, clients traceweaver-web/traceweaver-ingest and audience traceweaver-api.

## Accounts and service tokens

- `demo.operator`: database role operator, read grants for three demo sources.
- `demo.viewer`: database role viewer, read grants for the same sources.
- `traceweaver-ingest`: confidential client with service-account subject and database ingest_service role plus ingest grants. Its generated secret is in the credentials file; never put it in Swagger's public OAuth2 client_secret field.
- `local-admin`: Keycloak administration only, password in the same ignored file. Admin console: `http://localhost:8081/admin/`. This account is not automatically a workspace admin.

For manual ingestion testing in Swagger, obtain a short-lived service token in PowerShell, then copy only the access_token into **ingestBearer**:

```powershell
$demo = Get-Content -Raw ./demo-credentials.local.json | ConvertFrom-Json
$serviceToken = Invoke-RestMethod -Method Post -Uri 'http://localhost:8081/realms/traceweaver/protocol/openid-connect/token' -Body @{
  grant_type = 'client_credentials'
  client_id = $demo.ingest.clientId
  client_secret = $demo.ingest.clientSecret
}
$serviceToken.access_token
```

User-client tokens remain rejected by batch ingestion; service-client tokens remain rejected by user read routes. Token/group roles do not grant app permissions: memberships and source grants in PostgreSQL remain authoritative.

## Registration and sessions

The **Register** link is enabled on the local Keycloak login page (also reachable through `http://localhost:8081/realms/traceweaver/account/`). Newly registered users have **no app workspace membership or source grants**; `/me` returns an empty memberships array until an app administrator grants access. The login form is local Keycloak UI, not a new password endpoint in the API. Direct password grant and implicit flow are disabled for the Swagger client; S256 PKCE and exact callback origins are required.

Swagger tokens are not persisted. Reloading Swagger clears its authorization state; the Keycloak SSO session may still sign you back in. Swagger logout clears its local token, not necessarily the IdP session. Access JWTs expire after5minutes and remain valid until expiry even after IdP logout; revoked app grants apply immediately. Refresh has been verified via the protocol test, not a custom Swagger auto-refresh feature. Email reset/verification delivery is not configured in this local demo.

## Docker networking and verification

JWT issuer stays `http://localhost:8081/realms/traceweaver`, matching browser-issued tokens. Docker API retrieves JWKS from `http://keycloak:8080/realms/traceweaver/protocol/openid-connect/certs`. OIDC_LOCAL_KEYCLOAK=true permits **only that exact internal host/port/path outside production**; arbitrary HTTP endpoints and production HTTP remain rejected. Signature/RS256/issuer/audience/azp/expiry checks are unchanged. No certificates are bypassed and ports are published only on host loopback. Production requires a separately configured HTTPS IdP and production database setup.

`verify-keycloak-demo.js` uses real HTTP Authorization Code+S256 PKCE and Keycloak-issued tokens, not mocks/password grant. It checks wrong/missing PKCE, CORS, operator/viewer login, refresh, /me/sources/knowledge, outside-scope404, confidential service token, user/service401 separation, scoped batch ingestion and redacted event read. Passwords and tokens are withheld from output; tokens are never written to disk. Demo event/audit rows are retained. No claim of production deployment or every Keycloak feature being tested.

Sources: [official container guide](https://www.keycloak.org/server/containers), [hostname guide](https://www.keycloak.org/server/hostname), [Swagger OAuth2 configuration](https://swagger.io/docs/open-source-tools/swagger-ui/usage/oauth2/).
