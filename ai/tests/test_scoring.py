# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

from copy import deepcopy
import unittest

from ai.app.baseline import BASELINE_VERSION, BaselineScorer
from ai.app.config import Config, read_config
from ai.app.contracts import ContractError, strict_json_loads, validate, validate_request, validate_response
from ai.training.prepare_samples import build_artifacts


class ScoringTests(unittest.TestCase):
    def setUp(self):
        self.request = build_artifacts()["score-request.json"]

    def test_existing_fixtures_and_real_event_schema_validate(self):
        from ai.training.prepare_samples import ROOT
        import json

        fixture = json.loads((ROOT / "backend/contracts/fixtures/valid.json").read_text(encoding="utf-8"))
        for name in ("PairFeatures", "ScoreRequest", "ScoreResponse", "Error"):
            validate(name, fixture[name])
        for sample in build_artifacts()["observable.json"]["samples"]:
            validate("EventInput", sample["from_event"])
            validate("EventInput", sample["to_event"])

    def test_baseline_scores_without_reading_or_modifying_review(self):
        original = deepcopy(self.request)
        response = BaselineScorer().score(self.request)
        self.assertEqual(response["model_version"], BASELINE_VERSION)
        self.assertEqual([item["pair_id"] for item in response["predictions"]],
                         [item["pair_id"] for item in self.request["pairs"]])
        scores = {item["pair_id"]: item["score"] for item in response["predictions"]}
        self.assertGreater(scores["p-01"], scores["p-09"])
        self.assertGreater(scores["p-01"], scores["p-17"])
        self.assertGreater(scores["p-01"], scores["p-21"])
        self.assertTrue(all(0 <= value <= 1 for value in scores.values()))
        self.assertEqual(self.request, original)

    def test_request_rejects_nonfinite_numeric_types_and_duplicate_ids(self):
        for value in (float("nan"), float("inf"), -float("inf"), True, "10", None):
            request = deepcopy(self.request)
            request["pairs"][0]["features"]["delta_seconds"] = value
            with self.subTest(value=repr(value)), self.assertRaises(ContractError):
                validate_request(request)
        duplicate = deepcopy(self.request)
        duplicate["pairs"].append(duplicate["pairs"][0])
        with self.assertRaises(ContractError):
            validate_request(duplicate)

    def test_response_rejects_missing_extra_duplicate_ids_and_invalid_scores(self):
        good = BaselineScorer().score(self.request)
        bad_responses = []
        for bad_score in (None, float("nan"), float("inf"), True, -0.01, 1.01):
            bad = deepcopy(good)
            bad["predictions"][0]["score"] = bad_score
            bad_responses.append(bad)
        missing = deepcopy(good)
        missing["predictions"].pop()
        bad_responses.append(missing)
        duplicate = deepcopy(good)
        duplicate["predictions"][0] = duplicate["predictions"][1]
        bad_responses.append(duplicate)
        extra = deepcopy(good)
        extra["predictions"][0]["pair_id"] = "unexpected"
        bad_responses.append(extra)
        version = deepcopy(good)
        version["feature_schema_version"] = "2"
        bad_responses.append(version)
        for bad in bad_responses:
            with self.subTest(bad=repr(bad)[:50]), self.assertRaises(ContractError):
                validate_response(self.request, bad)

    def test_strict_json_rejects_duplicates_and_nonstandard_constants(self):
        for raw in ('{"x": 1, "x": 2}', '{"x": NaN}', '{"x": Infinity}'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                strict_json_loads(raw)

    def test_secret_is_required_sanitized_and_baseline_is_explicit(self):
        with self.assertRaisesRegex(ValueError, "SCORER_SERVICE_SECRET"):
            read_config({})
        secret = "local-ephemeral-test-credential-123456789"
        self.assertNotIn(secret, repr(read_config({"SCORER_SERVICE_SECRET": secret})))
        self.assertEqual(read_config({"SCORER_SERVICE_SECRET": secret}).mode, "model")
        with self.assertRaisesRegex(ValueError, "restricted"):
            Config(service_secret=secret, mode="baseline", app_env="production")
        for port in ("0", "65536", "8000oops", "80.1", "-1"):
            with self.subTest(port=port), self.assertRaises(ValueError):
                read_config({"SCORER_SERVICE_SECRET": secret, "SCORER_PORT": port})
