# Scorer integration — BE-27

The imported AI branch supplies `baseline-rule-v1`, an explicit heuristic, not a trained model. Backend enables only that reviewed baseline protocol (`X-Scorer-Method: rule`). Other models fail closed until extractor parity fixtures and a reviewed loader/version exist.

## Run locally

Use Python 3.10+ and pinned `ai/requirements.txt` in an isolated environment (this workspace uses `.local/ai-venv`). Follow `ai/RUN.md`; its `.venv` path may be replaced with your environment path. Set `APP_ENV=development`, `SCORER_MODE=baseline` and the same private `SCORER_SERVICE_SECRET` for Python and BE. Python does not load `.env` automatically.

Set backend `.env`:

```dotenv
SCORER_URL=http://127.0.0.1:8000/internal/v1/score-pairs
SCORER_SERVICE_SECRET=<same-random-secret-at-least-32-printable-ASCII-characters>
SCORER_TIMEOUT_MS=5000
```

Restart BE using `npm run dev:be`. Do not put credentials in browser/Git. SCORER_URL is the complete endpoint, HTTPS or development loopback HTTP only. Container support needs an explicitly trusted TLS endpoint; localhost inside the API container does not address a host scorer. This change does not rebuild/deploy containers.

## Behavior and contract

Hybrid first executes scoped rules, strong-ID/conflict, outcome, ambiguity and cycle guards. Scorer only annotates guard-approved pending links; it never adds/accepts links or breaks ambiguity. Baseline success keeps `effective_method=rule_only`, `degraded=true`, `degraded_reason=ai_baseline_only`, records `model_version=baseline-rule-v1`, and stores finite scores with `method=rule`. The version identifies the scorer implementation, not a trained artifact. No eligible pairs yields `ai_no_eligible_pairs` when configured. No configuration preserves `ai_unavailable`.

Batches contain at most 100 pairs, numeric features only, with one shared deadline capped at 5000ms, no retries or redirects. Responses are size-bounded, schema/version checked and must have the exact unique pair set. Timeout, failed status, invalid response or incompatible scorer discards every batch score and retains original null-score rules. Audit records method, degradation, scorer/feature versions, abstentions and conflict counts.

Runtime feature version `runtime-jaccard-1`: signed microsecond delta; unique exact `(namespace,value)` shared IDs across all namespaces, excluding redacted sentinels; NFKC lowercase Unicode letter/number/underscore word-set Jaccard, empty=0; transition=true/conflict=false because guards already ran. It differs intentionally from legacy Python bootstrap features (old action/namespace names and casefold). Those draft training helpers are not a runtime extractor or proof of trained-model parity. No TF-IDF or fitting at inference.

New runs use `sandbox-rules-2` with outcome guard. Unknown and action/outcome mismatch events abstain, including an invalid root. `provision.failed/failed` remains eligible. Old immutable snapshots retain their policy. Graph adds optional `abstentions` containing event reason or candidate transition/from/to/reason; no migration or historical rewrite. Root can remain the component anchor while having an abstention.

## Verification

```powershell
$env:SCORER_PYTHON = (Resolve-Path .local/ai-venv/Scripts/python.exe).Path
npm.cmd test
.local/ai-venv/Scripts/python.exe -m unittest discover -s ai/tests -p 'test_*.py' -v
npm.cmd run test:db
```

SCORER_PYTHON enables the Node-to-Python real HTTP integration test; without it that test is explicitly skipped. Other HTTP failure fixtures run normally. PostgreSQL test covers persistence/audit/idempotent replay/abstention and requires the local DB. See CURRENT_STATUS for actual results and environment blockers.

## BE-33 verification — 28/10/2026

Docker/PostgreSQL recovered using existing images/volume. `npm run test:db`: 50/50 pass. With SCORER_PYTHON set, `npm run test:identity:native`: 46/46 pass, none skipped. New identity run integration starts a real Python baseline and separate current-source API; verifies JWT request, run/graph schemas, stored scores/audit, replay, review and scorer-unavailable fallback. Native JWKS fixture signs real JWTs; this is not a live Keycloak/browser login test.

The Docker API image was not rebuilt and retains its previous source. Only PostgreSQL needed starting; app data/credentials were preserved. Tests keep their isolated `traceweaver_test_*` databases per existing policy and close temporary Python/API/JWKS processes. PostgreSQL is left healthy/running. No trained model artifact is supplied in the integrated AI source.

To rerun full HTTP integration:

```powershell
$env:SCORER_PYTHON = (Resolve-Path .local/ai-venv/Scripts/python.exe).Path
npm.cmd run test:db
npm.cmd run test:identity:native
```
