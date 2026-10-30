# API Docker

Run from the repository root with Docker Desktop/Compose v2.20+ and the existing `.env`. To create `.env` on a fresh checkout, run `npm run db:setup` once; an existing file is preserved. Do not replace credentials for an existing PostgreSQL volume.

Local Keycloak is now included. Before the first full Compose start, prepare its ignored import/credential files and demo DB grants using the bootstrap commands in [KEYCLOAK.md](KEYCLOAK.md). This machine is already prepared.

```powershell
docker compose up -d --build --wait api
docker compose ps -a
```

Default URL: http://localhost:8080. Host port follows API_PORT from `.env`; the container always listens on 0.0.0.0:8080 and publishes only on host loopback.

Swagger UI: http://localhost:8080/docs/ (API and Health definitions). Use **Authorize** with the appropriate user/ingest Bearer token, then **Try it out** for implemented operations. Planned operations are labeled and remain unimplemented. Assets/schema refs are served locally; tokens are not persisted and no external Swagger validator is used. OpenAPI JSON is available at `/docs/openapi.json`.

Build separately or start without rebuilding:

```powershell
docker compose build api
docker compose up -d --wait --no-build --pull never api
docker compose logs --tail=50 api migrate
docker compose stop api
```

`compose.yaml` includes the existing `compose.dev.yaml`, sharing its PostgreSQL container, network, project name and `postgres_data` volume. Startup order is PostgreSQL healthy → migration exits0 → API starts and passes readiness. A failed migration prevents API startup. There is no volume deletion or database recreation. Existing host-only `npm run db:up/db:stop` commands remain available; stopping PostgreSQL also makes the running API unready.

## Image and configuration

- Image `traceweaver-api:local`, Dockerfile `backend/Dockerfile`, build context repository root.
- Node24.14.1-alpine pinned to digest sha256:8510330d3eb72c804231a834b1a8ebb55cb3796c3e4431297a24d246b8add4d5. Multi-stage build uses the existing npm lock and runtime-only dependencies with install scripts disabled; no host dependency reinstall.
- Allowlisted `.dockerignore` excludes `.env`, `.git`, `.planning`, `.local`, host node_modules, FE/AI/data and tests. Runtime includes API/core/migrations/schema, migration helper and license notices. Credentials enter through explicit Compose environment variables, never Docker build args or image files.
- Runs as node UID1000, with init/signal forwarding, read-only root filesystem, dropped capabilities and no-new-privileges; only a 16MiB `/tmp` tmpfs is writable. Default shutdown timeout10s, Compose grace65s.
- Container-only `--import scripts/container-env.js` constructs a PostgreSQL URI using host `postgres` and percent-encoded credentials from the existing POSTGRES_* values. The host DATABASE_URL/.env remain unchanged. An explicit DATABASE_URL is honored when running the image independently.
- Healthcheck calls `/health/ready`. This checks the database/migrations; it does not assert Identity provider availability. `/api/v1/me` without a token returns401.

## Identity networking

BE-15 update: [local Keycloak](KEYCLOAK.md) is running; Swagger supports real Authorization Code+PKCE. Compose uses the exact dev-only internal Keycloak JWKS route with explicit opt-in, while issuer remains browser-visible localhost. The following paragraph describes the previous host-only/external-provider arrangement.

OIDC_ISSUER remains the exact issuer present in JWTs. OIDC_JWKS_URI must be trusted and reachable **inside** the container. Compose now uses the explicit local Keycloak route documented above; external providers require a reachable HTTPS JWKS URI. `localhost:8081` inside the API container refers to that container. Do not change the issuer or disable verification to work around networking. Compose starts local Keycloak but no FE/AI.

APP_ENV defaults to the existing development setting; NODE_ENV=production controls runtime dependency behavior. A production APP_ENV requires HTTPS OIDC URLs. PostgreSQL credentials still use the development bootstrap account from the existing Compose; separate least-privilege runtime/migration roles and live IdP verification remain deployment work.

## Verified locally

Current source verification and deployment limits: [CURRENT_STATUS](../docs/overview/status.md). Audit fixes have not been rebuilt into the old container in this session (Docker CLI unavailable). Rebuild before using the patched behavior. The counts/API status in the paragraph below describe the historical BE-13 image, not the current branch.

Image built and API healthy at 127.0.0.1:8080; migration container exit0, existing PostgreSQL volume reused. Live/readiness200, anonymous /me401. Container confirmed Node24.14.1, UID1000, read-only root, no .env/.planning or Swagger dev package.29 unit/HTTP/contract tests and base/license checks pass. No Docker Hub push, cloud deployment, destructive cleanup or new API implementation; API count remains6/21.
