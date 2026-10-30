<p align="center">
  <img src=".github/assets/traceweaver-overview.svg" alt="TraceWeaver: intake, account and provision logs become an evidence-backed journey with human review and verification" width="100%">
</p>

# TraceWeaver

**Turn scattered logs into evidence-backed request journeys.**

[![CI](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/actions/workflows/ci.yml/badge.svg)](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

[Tiếng Việt](README.md) · **English** · [Guided demo](docs/DEMO.md) · [Installation](INSTALL.md) · [Documentation](docs/README.md)

TraceWeaver is an open-source investigation tool for IT lab provisioning requests, developed in the DX-Lab HaUI 2026 context. It reconstructs journeys across **intake → account → provision**, helping operators locate failures, inspect evidence, review links and manage investigation cases.

Choose a starting point: [follow an investigation](docs/DEMO.md), [run from source](INSTALL.md), [read API contracts](backend/contracts/README.md), or [inspect feature evidence](docs/FEATURE_STATUS.md).

## Why TraceWeaver?

- Keep source provenance, immutable run snapshots and decision history together.
- Preserve unresolved cases when identifiers conflict or several branches remain plausible.
- Distinguish log reconstruction, sandbox re-execution and source verification before case closure.
- Use AI scores to assist a reviewer within rule-based guards.

## Capabilities

- Ingest normalized events in batches, deduplicate records and retain provenance.
- Search events within workspace/source permissions and reconstruct versioned journey snapshots.
- Review proposed links, add evidence and move cases through guarded workflows with audit history.
- Simulate RAM, image and account failures; repair conditions, rerun requests and verify source evidence.
- Authenticate through Keycloak OIDC/PKCE and enforce current database roles and source grants.
- Use a React interface for dashboards, events, cases, knowledge and workspace administration.
- Optionally rank eligible event pairs with a Python scorer; retain rule-based fallback.

These modules exist in source. Integration, deployment and verification depend on the revision; consult [CURRENT_STATUS](docs/CURRENT_STATUS.md). The `v0.1.0-base.1` tag is an earlier scaffold. The opt-in sandbox model is experimental and has not demonstrated the project's quality target on representative data; see its [model card](ai/artifacts/sandbox-v2/README.md).

## Architecture and stack

The React web app calls an Express API backed by reusable Identity, Data, Reconstruction and Workflow core modules. PostgreSQL stores events, snapshots, cases and audit records. Keycloak handles authentication; the API enforces authorization. The Python scorer cannot write application state or approve workflow actions.

[ARCHITECTURE.md](ARCHITECTURE.md) describes the Open-Core / H-P-D-I / application layers and trust boundaries.

| Component | Stack |
|---|---|
| Backend | Node.js 24, JavaScript ES modules, Express, JOSE |
| Frontend | React, TypeScript, Vite, Tailwind, MUI, Radix UI |
| AI | Python, FastAPI, Pydantic, baseline and opt-in JSON model |
| Data / Identity | PostgreSQL 17 / Keycloak |
| Simulator | Node.js; seeded synthetic event generation and stateful lab simulation |

## Run the backend

Use Node.js **24.14.1**, npm **11.11.0**, and PostgreSQL 17 or Docker Compose v2.

```sh
git clone https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver.git
cd TraceWeaver
npm ci
npm run db:setup
# Download the pinned image if it is not cached:
docker compose -f compose.dev.yaml pull postgres
npm run db:up
npm run db:migrate
npm run dev:be
```

Default local API: `http://127.0.0.1:8080`. Check `/health/live` and `/health/ready`. Business APIs require configured Identity and data grants.

Follow [INSTALL.md](INSTALL.md) for SSO bootstrap, the frontend at `http://localhost:5173`, optional AI and demo data. Demo passwords are generated locally; see [Keycloak setup](backend/KEYCLOAK.md). Server operations are documented in [deploy/oracle](deploy/oracle/README.md).

## Verify

```sh
npm run check:base
npm run licenses:check
npm run licenses:frontend:check
npm run sbom:check
npm test
npm run test:sim
npm --prefix frontend test
```

Frontend checks require its separately installed dependencies. Database, identity, Python and browser checks have additional prerequisites; see [TESTING.md](TESTING.md). Historical results apply only to their stated revision and environment.

## Repository and community

[Documentation index](docs/README.md) · [Backend](backend/README.md) · [Frontend](frontend/README.md) · [AI](ai/README.md) · [Simulator](simulator/README.md) · [Changelog](CHANGELOG.md)

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. Use [Issues](https://github.com/HaUI-HIT-Tam-Thai-T/TraceWeaver/issues) for reproducible bugs and feature requests; sensitive reports follow [SECURITY.md](SECURITY.md). See [SUPPORT.md](SUPPORT.md) for troubleshooting.

Project source is licensed under [Apache-2.0](LICENSE). Third-party components retain their own terms; see [LICENSES.md](LICENSES.md), [NOTICE](NOTICE) and the [CycloneDX SBOMs](sbom/README.md). The frontend SBOM excludes optional dependencies; the Python SBOM is a flat component inventory. Both limits are documented alongside the files.

Maintained under [HaUI-HIT-Tam-Thai-T](https://github.com/HaUI-HIT-Tam-Thai-T). See [source packaging and release preparation](docs/RELEASING.md) before distributing a revision.
