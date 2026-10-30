# Oracle API + AI deployment

This overlay extends the existing private `.local/oracle/compose.yaml` installation. It preserves database/Keycloak configuration, volumes, roles and production HTTPS issuer. The main development Compose file is not used for this server.

The pinned Python3.12 image includes only runtime source, pinned dependencies, model/manifest and notices. Scorer runs as UID65532, read-only, with bounded resources and no published host port. API retains production URL validation and verifies scorer TLS using a private deployment certificate, SAN `scorer`, `localhost`, `127.0.0.1`. Never disable TLS verification.

Keep a random SCORER_SERVICE_SECRET in `.local/oracle/.env`; use the same private value for both services. Keep the certificate/key under `.local/oracle/scorer-tls/` (key readable by scorer UID65532 only) and a copy of the public certificate under `.local/oracle/scorer-ca/`. Do not commit these files. The private foundation Compose/env and TLS files are intentionally supplied outside Git.

From `.local/oracle/`, set TRACEWEAVER_RELEASE to the checked-out commit identifier, then:

```sh
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml config --quiet
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml build api scorer
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml up -d --no-deps --no-build --pull never --wait scorer
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml run --rm --no-deps migrate
docker compose -f compose.yaml -f ../../deploy/oracle/compose.ai.yaml up -d --no-deps --no-build --pull never --wait api
```

Check public HTTPS live/ready/docs, private TLS scorer readiness/sample predictions, real Keycloak PKCE and a new hybrid run with durable scores. Verify existing data remains readable and other hosted applications stay healthy. A successful rollout does not approve the synthetic model's quality; see `ai/artifacts/sandbox-v2/README.md`.

The existing base Compose keeps the previous API image. If rollout validation fails, restore API with `docker compose -f compose.yaml up -d --no-deps --no-build --pull never --wait api` while investigating. No DB/Keycloak restart, volume removal, pruning, credential rotation or migration-history rewrite is required. Future restarts of the new release must include this overlay and the recorded TRACEWEAVER_RELEASE.

## Local frontend without the Vite proxy

To explicitly allow local browser development against this HTTPS API, set
`FRONTEND_LOCAL_ORIGINS=http://localhost:5173,http://127.0.0.1:5173` in the private
`.local/oracle/.env`. The overlay forwards this variable to API only. Deploy the updated API
and recreate API to apply it; no database migration or scorer restart is needed.
Keep the existing `FRONTEND_ORIGINS` HTTPS allowlist unchanged. The new list defaults empty
and accepts only exact HTTP loopback origins, with no wildcards, paths or LAN/public hosts.

Verify API GET/POST/PUT preflights for each configured origin, a 401 with the correct CORS
header for anonymous `/api/v1/me`, and rejection of an unconfigured origin/port. Verify the
Keycloak public client's exact callback, Web Origin and logout entries for each local origin;
API CORS does not configure identity. Keep Authorization Code + PKCE and existing origins.
Frontend uses `VITE_API_BASE_URL=https://api.quizlearn.tech`; keep existing Keycloak values
and restart Vite. No frontend UI or API contract changes are required.
