# Local Keycloak + Swagger login

Keycloak26.8.1 runs in development mode at `http://localhost:8081`, pinned to official image digest sha256:79c623a22abacf3fe6c00a5fb30f5b7843d717b234033b80995891c06116d244. Its named `keycloak_data` volume is separate from the existing application PostgreSQL volume. H2 is local development storage, not a production deployment.

## Already prepared on this machine

API and Keycloak are running. Open `http://localhost:8080/docs/`, refresh the page, then:

1. Click **Authorize**, find **keycloakLogin (OAuth2, authorizationCode with PKCE)**.
2. Keep client_id `traceweaver-web`; leave client_secret empty. The scopes are preconfigured.
3. Click **Authorize** in that OAuth2 section. Sign in as `demo.operator` or `demo.viewer` using the random password in root `demo-credentials.local.json`.
4. Return to Swagger, close Authorize, execute `GET /api/v1/me` →200. No token copy/paste is required. If a popup does not open in an embedded browser, allow popups or use Chrome/Edge.

Use workspace `10000000-0000-4000-8000-000000000015` for sources/knowledge/events. There are three sources (intake/account/provision), with source UUIDs ending000000000015/16/17. Demo event `keycloak-demo-smoke-v1` is available in intake. Both demo users have read grants; operator has the operator role, viewer has only viewer. Neither user token is an ingest-service token.

If an older build left you on a blank `/docs/oauth2-redirect.html?...` page: BE-16 fixes the missing local oauth2-redirect.js asset. Close that stale callback, reload the main `/docs/` page and start **keycloakLogin → Authorize** again. Do not keep reusing an old authorization code; it is short-lived and single-use. Swagger should show Authorized/Logout after a successful callback; `/me` must then include Authorization and return200. The earlier blank-page failure was an API asset-delivery bug, not evidence that the user failed to sign in.

## Fresh checkout/bootstrap

Use Node24 and installed root dependencies. First create the existing application `.env` with `npm run db:setup` if absent, then:

```powershell
npm run db:up
npm run db:migrate
node --env-file-if-exists=.env backend/scripts/setup-identity-demo.js
# Fresh machine only: download the pinned image before --pull never.
docker compose pull keycloak
docker compose up -d --wait --pull never keycloak
node --env-file-if-exists=.env backend/scripts/setup-core-identity-demo.js
node --env-file-if-exists=.env backend/scripts/setup-frontend-origin.js
docker compose up -d --build --wait --pull never api
node --env-file-if-exists=.env backend/scripts/verify-keycloak-demo.js
```

Base setup generates `demo-credentials.local.json`, `.env.keycloak.local` and `.local/keycloak/traceweaver-realm.json`, all Git-ignored, and seeds only reserved demo IDs. It reuses existing credentials, realm and DB rows on reruns. It does not reset existing passwords, replace .env or drop volumes. Keep the credentials/import files matched to the existing Keycloak volume; do not delete/regenerate them to reset a running realm. Keycloak startup import does not overwrite an already imported realm. The default local demo uses realm traceweaver, clients traceweaver-web/traceweaver-ingest/traceweaver-core and audience traceweaver-api.

`setup-core-identity-demo.js` runs after Keycloak is healthy. It authenticates the saved local administrator against master/admin-cli, then adds only the dedicated confidential core client via Admin REST. Public login still uses Authorization Code+PKCE; no password grant is enabled for user/core clients. Core has service accounts enabled, browser/password/implicit flows disabled, empty origins/redirects and fullScopeAllowed=false. The script verifies the service token signature/audience/client and matches its sub to the client-specific service-account endpoint. It seeds active membership in the reserved demo workspace, with no app data roles/source grants, and appends the client/account to the existing import for a future fresh volume.

The core secret and subject are saved under `core` in the ignored credentials JSON; only CORE_APP_CLIENT_ID/CORE_APP_SUBJECT are added to `.env`, preserving other values and line endings. Reruns do not rotate credentials or rewrite unchanged files (hash checked). Existing unmanaged/misconfigured core client, conflicting nonempty environment values, mismatched saved subject/secret or revoked membership make setup stop; it does not reset/repair those permissions silently. The tool is restricted to development and a loopback HTTP `/realms/traceweaver` issuer, uses bounded requests and rejects redirects. Production configuration is separate.

## Accounts and service tokens

Browser integration uses exact FRONTEND_ORIGINS, defaulting to localhost/127.0.0.1 at FRONTEND_PORT3000 in development, with `/auth/callback` redirects. Fresh imports include them. For an existing realm, run `setup-frontend-origin.js`: it appends these values to the local public S256 PKCE client through Admin REST and updates the ignored import, preserving Swagger callbacks, accounts, passwords, membership and service clients. It rejects unexpected client profiles and is development/loopback-only. API/health use the same CORS allowlist; core HTTP has no browser CORS. A source change needs an API restart/container rebuild to take effect. Production origins must be explicitly configured HTTPS.

- `demo.operator`: database role operator, read grants for three demo sources.
- `demo.viewer`: database role viewer, read grants for the same sources.
- `traceweaver-ingest`: confidential client with service-account subject and database ingest_service role plus ingest grants. Its generated secret is in the credentials file; never put it in Swagger's public OAuth2 client_secret field.
- `traceweaver-core`: confidential service client with exact configured subject and workspace membership only. Its credential is `core.clientSecret` in the ignored JSON. The trusted app calls core with its JWT plus independently verified original user JWT; see [Core workflow HTTP](WORKFLOW.md). Do not distribute its secret/token to browser clients.
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

`verify-keycloak-demo.js` uses real HTTP Authorization Code+S256 PKCE and Keycloak-issued tokens, not mocks/password grant. It checks wrong/missing PKCE, CORS, operator/viewer login, refresh, /me/sources/knowledge, outside-scope404, confidential ingest/core tokens, wrong core secret and user/ingest/core401 isolation, scoped batch ingestion and redacted event read. Core checks create/get/submit document, duplicate/stale409, denied operator/viewer approval403, creator mismatch422 and workspace404; case create/core GET/assign/start, missing-evidence422, adding evidence and request_verification, then reads the same state through the public case API. A live DB check confirms audit user+service identities and no service data roles/grants. Reviewer close/reopen, revocation and concurrency have separate integration tests; the live verifier does not impersonate a reviewer.

Passwords/tokens are withheld from output; tokens are never written to disk. Demo event/audit rows, documents and case/evidence smoke artifacts are retained. Each verifier invocation creates one document and one case; its run uses a stable idempotency key. BE-23 rebuilt Docker API and verified these live paths, API/Keycloak/PostgreSQL healthy. No claim of production deployment or every Keycloak feature being tested.

Sources: [official container guide](https://www.keycloak.org/server/containers), [hostname guide](https://www.keycloak.org/server/hostname), [Admin REST API: clients and service-account-user](https://www.keycloak.org/docs-api/latest/rest-api/index.html), [Swagger OAuth2 configuration](https://swagger.io/docs/open-source-tools/swagger-ui/usage/oauth2/).
