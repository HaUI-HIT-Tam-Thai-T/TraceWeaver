# Scorer integration — BE-34

Backend supports `baseline-rule-v1` and explicit opt-in to the trained experimental `logistic-regression-sandbox-features-2-experiment-1` supplied in AI_BE_RUNTIME_V2. The model/manifest/evaluation and loader are imported in source; [artifact provenance and limits](../ai/artifacts/sandbox-v2/README.md) records received hashes. Unknown model versions/methods fail closed. No trained model is selected by default.

## Run locally

Use Python 3.10+ and pinned `ai/requirements.txt` in an isolated environment (this workspace uses `.local/ai-venv`). Follow `ai/RUN.md`; its `.venv` path may be replaced with your environment path. Set `APP_ENV=development`, `SCORER_MODE=baseline` and the same private `SCORER_SERVICE_SECRET` for Python and BE. Python does not load `.env` automatically.

Set backend `.env`:

```dotenv
SCORER_URL=http://127.0.0.1:8000/internal/v1/score-pairs
SCORER_SERVICE_SECRET=<same-random-secret-at-least-32-printable-ASCII-characters>
SCORER_TIMEOUT_MS=5000
```

Restart BE using `npm run dev:be`. Do not put credentials in browser/Git. SCORER_URL is the complete endpoint, HTTPS or development loopback HTTP only. Container support needs an explicitly trusted TLS endpoint; localhost inside the API container does not address a host scorer. This change does not rebuild/deploy containers.

### Experimental trained v2

Add this to the backend's ignored `.env` alongside SCORER_URL and the private service secret:

```dotenv
SCORER_MODEL_VERSION=logistic-regression-sandbox-features-2-experiment-1
```

Start the Python service from repository root using the existing isolated environment. Configure `SCORER_SERVICE_SECRET` in this terminal to the same private value as BE; Python does not automatically read `.env`.

```powershell
$env:APP_ENV = 'development'
$env:SCORER_MODE = 'model'
$env:SCORER_MODEL_PATH = (Resolve-Path ai/artifacts/sandbox-v2/model_sandbox_v2.json).Path
.local/ai-venv/Scripts/python.exe -B -m ai.app
```

Restart the backend in another terminal with `npm run dev:be`. This uses source included in Git and needs no training or incoming handoff folder. Missing/corrupt artifacts make `/health/ready` and scoring return503. Clear SCORER_MODEL_VERSION and run Python in baseline mode to select baseline again; mismatched mode/version degrades the run rather than silently switching scorers.

## Behavior and contract

Hybrid first executes scoped rules, strong-ID/conflict, outcome, ambiguity and cycle guards. Scorer only annotates guard-approved pending links; it never adds/accepts links or breaks ambiguity. Baseline success keeps `effective_method=rule_only`, `degraded=true`, `degraded_reason=ai_baseline_only` and `model_version=baseline-rule-v1`. Opted-in trained-model success uses `effective_method=hybrid`, `degraded=false`, `degraded_reason=null` and the exact model version. Links keep `method=rule` and `review_state=pending` because their existence/evidence comes from rules; score provenance is the run's model version. Successful scoring is not approval of model quality. No eligible pairs yields `ai_no_eligible_pairs` when configured. No configuration preserves `ai_unavailable`.

Batches contain at most 100 pairs, numeric features only, with one shared deadline capped at 5000ms, no retries or redirects. Responses are size-bounded, schema/version checked and must have the exact unique pair set. Timeout, failed status, invalid response or incompatible scorer discards every batch score and retains original null-score rules. Audit records method, degradation, scorer/feature versions, abstentions and conflict counts.

Runtime feature version `sandbox-observable-features-2`: signed microsecond delta; unique exact `(namespace,value)` shared IDs across all namespaces, excluding values containing `[REDACTED]`; message markers become spaces before NFKC/full casefold and Unicode letter/number/underscore word-set Jaccard, empty=0. Transition is computed from the three sandbox service/action pairs; strong conflict checks every pair of unmasked values in request/account/job. Outcome is separate. No TF-IDF or fitting at inference. The real module exports `extractPairFeatures(left,right)` at `backend/src/core/reconstruction/features.js` and passes all 42 independent supplied golden cases. Casefold exceptions were generated from Python 3.12 Unicode15; normalization/token categories use Node's Unicode tables. This verifies the supplied fixture domain, not exhaustive equivalence for all characters with the sender's Python3.10 Unicode13 environment.

New runs use `sandbox-rules-2` with outcome guard. Unknown and action/outcome mismatch events abstain, including an invalid root. `provision.failed/failed` remains eligible. Old immutable snapshots retain their policy. Graph adds optional `abstentions` containing event reason or candidate transition/from/to/reason; no migration or historical rewrite. Root can remain the component anchor while having an abstention.

The model's training manifest says `sandbox-rules-1`; its transitions/strong namespaces match the observable feature domain, while BE's v2 adds stricter independent outcome guards. The model never decides those guards. Its synthetic precision 0.7273 is below the >=95% target; F1 equals the two-flag rule, templates repeat across splits and text weight is zero. No recall gain is claimed. Offline threshold 0.20 is not a backend linking threshold.

## Verification

```powershell
$env:SCORER_PYTHON = (Resolve-Path .local/ai-venv/Scripts/python.exe).Path
npm.cmd test
.local/ai-venv/Scripts/python.exe -B -m unittest discover -s ai/tests -p 'test_*.py' -v
npm.cmd run test:db
npm.cmd run test:identity:native
```

SCORER_PYTHON enables real Python baseline and trained-model HTTP integration tests; without it those tests are explicitly skipped. Other HTTP failure fixtures run normally. PostgreSQL tests cover persistence/audit/idempotent replay/abstention. JWT/API tests also verify trained-model metadata, review, old baseline replay after switching models and scorer-down fallback. See CURRENT_STATUS for actual results. Windows sandbox execution can block asyncio's socketpair; the packaged check and Python HTTP tests passed outside that sandbox without modifying dependencies or the supplied launcher.

When the original incoming folder is present, its own checks also work:

```powershell
.local/ai-venv/Scripts/python.exe -B AI_BE_RUNTIME_V2/ai-be-runtime-v2/run_scorer.py --check --report .local/ai-be-runtime-v2-verification.json
node AI_BE_RUNTIME_V2/ai-be-runtime-v2/features/check_features.cjs backend/src/core/reconstruction/features.js
```

## Historical BE-33 verification — 28/10/2026

Docker/PostgreSQL recovered using existing images/volume. `npm run test:db`: 50/50 pass. With SCORER_PYTHON set, `npm run test:identity:native`: 46/46 pass, none skipped. New identity run integration starts a real Python baseline and separate current-source API; verifies JWT request, run/graph schemas, stored scores/audit, replay, review and scorer-unavailable fallback. Native JWKS fixture signs real JWTs; this is not a live Keycloak/browser login test.

The Docker API image was not rebuilt and retains its previous source. Only PostgreSQL needed starting; app data/credentials were preserved. Tests keep their isolated `traceweaver_test_*` databases per existing policy and close temporary Python/API/JWKS processes. PostgreSQL is left healthy/running. BE-33 preceded the BE-34 trained-model import described above.

To rerun full HTTP integration:

```powershell
$env:SCORER_PYTHON = (Resolve-Path .local/ai-venv/Scripts/python.exe).Path
npm.cmd run test:db
npm.cmd run test:identity:native
```
