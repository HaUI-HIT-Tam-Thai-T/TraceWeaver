# Experimental sandbox v2 model

Imported unchanged from the user-supplied `AI_BE_RUNTIME_V2/ai-be-runtime-v2` on 28 October 2026. Code, model and synthetic fixtures are Apache-2.0; see the repository LICENSE/NOTICE and ai/DEPENDENCIES.md / THIRD_PARTY_NOTICES.txt. No dependencies or training data were added.

- Model: `logistic-regression-sandbox-features-2-experiment-1`.
- SHA-256: `f06fc43f8784cb93e1d4b52b230e8ca7ec4fc846d9cd068a97a75f6145e76420`.
- Feature: `sandbox-observable-features-2`; schema `1`; training policy `sandbox-rules-1`.
- Bundle manifest SHA-256: `0c6b9f83ee779bf54541c503cd877deec340524aed671287a9ab1583aab4b82f`.
- Source revision declared by sender: `5a22086a0873034ce60920f600ba215a9a9a5f04`, dirty working tree. These hashes establish received bytes, not an independently reproducible training revision or signature.
- Imported loader `ai/app/model_scorer.py` SHA-256: `209320adad103e27e9ee89d6829091e2c941741c486363ecee19859d7ab3f035`.
- The original 42 feature cases are at `backend/tests/fixtures/scorer-v2/features-v2.json`; original 23 request/response pairs are at `ai/tests/fixtures/scorer-v2/`.

This artifact is never chosen implicitly. Configure `SCORER_MODE=model` and `SCORER_MODEL_PATH=ai/artifacts/sandbox-v2/model_sandbox_v2.json` explicitly. See [BE setup](../../../backend/SCORER.md).

Sender-reported synthetic test results: 288 pairs, precision 0.7273, recall 1.0, F1 0.8421, equal F1 to the two-flag rule on this suite. This does not meet the project's >=95% precision target. Templates repeat across splits; text-similarity weight is zero. Threshold 0.20 is offline evaluation only. Training/evaluation were not reproduced here; their manifests/reports are supplied evidence, while model HTTP and feature conformance are independently verified.

Backend retains `sandbox-rules-2`: the same three transitions and strong namespaces, plus stricter independent outcome guards. Scores only annotate already eligible pending rule links. There is no score-driven ambiguity resolution, auto-acceptance, demonstrated recall improvement, or approval for production.
