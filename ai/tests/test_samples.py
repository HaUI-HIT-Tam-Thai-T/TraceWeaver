# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

import json
from pathlib import Path
import tempfile
import unittest

from ai.features.pair_features import extract_pair_features, text_similarity
from ai.training.prepare_samples import ROOT, build_artifacts, encode, event, write_artifacts


class SampleTests(unittest.TestCase):
    def test_request_contains_features_only_and_matches_review_ids(self):
        artifacts = build_artifacts()
        request = artifacts["score-request.json"]
        ids = [pair["pair_id"] for pair in request["pairs"]]
        self.assertEqual(len(set(ids)), 24)
        self.assertEqual(ids, [item["pair_id"] for item in artifacts["review.json"]["items"]])
        self.assertEqual(set(request), {"schema_version", "pairs"})
        for pair in request["pairs"]:
            self.assertEqual(set(pair), {"pair_id", "features"})
        items = artifacts["review.json"]["items"]
        self.assertTrue(all(item["label"] is None for item in items))
        for suggestion in (0, 1, None):
            self.assertEqual(sum(item["suggested_label"] == suggestion for item in items), 8)

    def test_sample_field_shapes_follow_actual_contract(self):
        # Checks these fixtures, not a substitute for a general JSON Schema validator.
        schema = json.loads((ROOT / "backend/contracts/schemas/domain.schema.json").read_text(encoding="utf-8"))["$defs"]
        artifacts = build_artifacts()
        for sample in artifacts["observable.json"]["samples"]:
            for key in ("from_event", "to_event"):
                value = sample[key]
                self.assertEqual(set(value), set(schema["EventInput"]["required"]))
                self.assertIn(value["outcome"], schema["EventInput"]["properties"]["outcome"]["enum"])
                self.assertTrue(value["occurred_at"].endswith("Z"))
        for pair in artifacts["score-request.json"]["pairs"]:
            features = pair["features"]
            self.assertEqual(set(features), set(schema["PairFeatures"]["required"]))
            self.assertGreaterEqual(features["shared_id_count"], 0)
            self.assertGreaterEqual(features["text_similarity"], 0)
            self.assertLessEqual(features["text_similarity"], 1)
            self.assertIs(type(features["transition_allowed"]), bool)
            self.assertIs(type(features["conflicting_id"]), bool)
        encode(artifacts)  # allow_nan=False rejects non-finite generated scores/features.

    def test_namespace_missing_ids_and_conflicts(self):
        left = event("I", 0, [("request_id", "x"), ("user_id", "u")])
        right = event("A", 20, [("request_id", "y"), ("user_id", "u")])
        features = extract_pair_features(left, right)
        self.assertEqual(features["shared_id_count"], 1)
        self.assertTrue(features["conflicting_id"])
        right["identifiers"] = [{"namespace": "account_id", "value": "x"}]
        features = extract_pair_features(left, right)
        self.assertEqual(features["shared_id_count"], 0)
        self.assertFalse(features["conflicting_id"])

    def test_duplicate_ids_do_not_inflate_evidence(self):
        repeated = [("request_id", "x"), ("request_id", "x")]
        features = extract_pair_features(event("I", 0, repeated), event("A", 10, repeated))
        self.assertEqual(features["shared_id_count"], 1)

    def test_time_direction_and_skipped_step(self):
        features = extract_pair_features(event("I", 30, []), event("A", 10, []))
        self.assertEqual(features["delta_seconds"], -20)
        self.assertTrue(features["transition_allowed"])
        self.assertFalse(extract_pair_features(event("I", 0, []), event("P", 10, []))["transition_allowed"])

    def test_similarity_normalization_and_empty_messages(self):
        self.assertEqual(text_similarity("", ""), 0)
        self.assertEqual(text_similarity("TẠO tài khoản!", "tạo tài khoản"), 1)
        self.assertEqual(text_similarity("account account lab", "account lab"), 1)
        self.assertEqual(text_similarity("one", "two"), 0)

    def test_generation_is_reproducible_and_preserves_review(self):
        self.assertEqual(encode(build_artifacts()), encode(build_artifacts()))
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            write_artifacts(directory)
            review_path = directory / "review.json"
            original = review_path.read_bytes()
            with self.assertRaises(FileExistsError):
                write_artifacts(directory)
            self.assertEqual(review_path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
