# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Transparent heuristic for local integration; not a trained/calibrated model."""

from ai.app.contracts import validate_request, validate_response


BASELINE_VERSION = "baseline-rule-v1"


def pair_score(features):
    if features["conflicting_id"]:
        return 0.05
    if not features["transition_allowed"]:
        return 0.10
    if features["delta_seconds"] < 0:
        return 0.25  # Flag clock skew for review rather than creating an impossible certainty.
    proximity = max(0.0, 1.0 - features["delta_seconds"] / 3600.0)
    score = (0.25 + 0.20 * (features["shared_id_count"] >= 1)
             + 0.10 * (features["shared_id_count"] >= 2)
             + 0.20 * features["text_similarity"] + 0.15 * proximity)
    return round(min(0.9, max(0.0, score)), 6)


class BaselineScorer:
    method = "rule"
    ready = True

    def score(self, request):
        validate_request(request)
        response = {
            "model_version": BASELINE_VERSION,
            "feature_schema_version": "1",
            "predictions": [
                {"pair_id": pair["pair_id"], "score": pair_score(pair["features"])}
                for pair in request["pairs"]
            ],
        }
        return validate_response(request, response)


class UnavailableScorer:
    """No trained artifact has been handed off yet; do not silently use baseline."""

    method = "unavailable"
    ready = False
