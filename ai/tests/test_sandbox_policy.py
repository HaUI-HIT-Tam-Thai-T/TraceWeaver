# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from ai.app.contracts import ContractError, validate
from ai.features.sandbox_policy import POLICY_VERSION, assess_pair, extract_policy_features
from ai.training.sandbox_dataset import build_dataset, scenario_rows, write_dataset
from ai.training.evaluate_sandbox import evaluate, load_dataset
from ai.training.train import DatasetIntegrityError, train_logistic_regression


class SandboxPolicyTests(unittest.TestCase):
    def setUp(self):
        rows, _ = scenario_rows(1, 42)
        self.rows = {row["category"]: row for row in rows}

    def decision(self, category):
        row = self.rows[category]
        return assess_pair(row["from_event"], row["to_event"],
                           ambiguous=row["ambiguous_attempts"])

    def test_time_boundaries_are_inclusive_and_preserve_sign(self):
        for category in ("skew_boundary", "same_timestamp", "window_boundary"):
            with self.subTest(category=category):
                self.assertEqual(self.decision(category)["status"], "eligible")
        self.assertEqual(self.rows["skew_boundary"]["features"]["delta_seconds"], -5)
        for category in ("before_skew_boundary", "after_window_boundary"):
            self.assertEqual(self.decision(category)["reason"], "OUTSIDE_TIME_WINDOW")

    def test_strong_namespace_conflict_overrides_another_matching_id(self):
        for category in ("request_conflict_despite_shared_account",
                         "account_conflict_despite_shared_request", "job_conflict"):
            with self.subTest(category=category):
                self.assertEqual(self.decision(category)["reason"], "STRONG_ID_CONFLICT")
        for category in ("shared_account_missing_request", "shared_job"):
            self.assertEqual(self.decision(category)["status"], "eligible")

    def test_missing_and_weak_ids_remain_unresolved_without_an_artificial_score(self):
        for category in ("no_ids", "user_only", "missing_id_one_side", "same_value_different_namespace"):
            with self.subTest(category=category):
                self.assertEqual(self.decision(category),
                                 {"status": "unresolved", "reason": "NO_SHARED_STRONG_ID"})
        self.assertEqual(self.rows["user_only"]["features"]["shared_id_count"], 1)
        self.assertEqual(self.rows["same_value_different_namespace"]["features"]["shared_id_count"], 0)

    def test_failed_transition_outcome_mismatch_and_retry_are_distinct(self):
        self.assertEqual(self.decision("direct_failed")["status"], "eligible")
        self.assertEqual(self.decision("outcome_mismatch")["reason"], "OUTCOME_ACTION_MISMATCH")
        self.assertEqual(self.decision("ambiguous_retry")["reason"], "AMBIGUOUS_MATCH")
        self.assertEqual(self.decision("unknown_outcome")["reason"], "OUTCOME_UNKNOWN")
        for category in ("skipped_step", "reversed_transition"):
            self.assertEqual(self.decision(category)["reason"], "TRANSITION_NOT_ALLOWED")

    def test_oracle_metadata_never_changes_runtime_features(self):
        row = self.rows["direct_completed"]
        left, right = deepcopy(row["from_event"]), deepcopy(row["to_event"])
        before = extract_policy_features(left, right)
        left["payload"].update(label=0, journey_id=999, confirmed_edge=False)
        right["payload"].update(label=1)
        self.assertEqual(before, extract_policy_features(left, right))
        # Same runtime evidence, different explicit oracle labels: unavoidable ambiguity.
        self.assertEqual(before, self.rows["oracle_confirmed_non_edge"]["features"])
        self.assertEqual(row["label"], 1)
        self.assertEqual(self.rows["oracle_confirmed_non_edge"]["label"], 0)

    def test_invalid_outcome_literal_error_is_not_a_valid_dto(self):
        event = deepcopy(self.rows["direct_failed"]["to_event"])
        event["outcome"] = "error"
        with self.assertRaises(ContractError):
            validate("EventInput", event)

    def test_redacted_ids_do_not_supply_shared_evidence(self):
        row = deepcopy(self.rows["direct_completed"])
        for side in ("from_event", "to_event"):
            row[side]["identifiers"] = [{"namespace": "request", "value": "[REDACTED]"}]
        features = extract_policy_features(row["from_event"], row["to_event"])
        self.assertEqual(features["shared_id_count"], 0)
        self.assertFalse(features["conflicting_id"])
        self.assertEqual(assess_pair(row["from_event"], row["to_event"])["reason"], "NO_SHARED_STRONG_ID")

    def test_redacted_value_is_missing_evidence_not_an_id_conflict(self):
        row = deepcopy(self.rows["direct_completed"])
        row["from_event"]["identifiers"] = [{"namespace": "request", "value": "prefix-[REDACTED]"}]
        features = extract_policy_features(row["from_event"], row["to_event"])
        self.assertFalse(features["conflicting_id"])
        self.assertEqual(features["shared_id_count"], 0)

    def test_redaction_preserves_other_shared_ids_and_real_conflicts(self):
        row = deepcopy(self.rows["account_conflict_despite_shared_request"])
        for side in ("from_event", "to_event"):
            row[side]["identifiers"].append({"namespace": "job", "value": "[REDACTED]"})
        features = extract_policy_features(row["from_event"], row["to_event"])
        self.assertEqual(features["shared_id_count"], 1)
        self.assertTrue(features["conflicting_id"])

    def test_redacted_text_is_not_similarity_evidence(self):
        row = deepcopy(self.rows["direct_completed"])
        for side in ("from_event", "to_event"):
            row[side]["message"] = "[REDACTED]"
        self.assertEqual(extract_policy_features(row["from_event"], row["to_event"])["text_similarity"], 0)


class SandboxDatasetTests(unittest.TestCase):
    def test_reproducible_group_disjoint_splits_and_oracle_labels(self):
        artifacts = build_dataset(num_groups=20)
        self.assertEqual(artifacts, build_dataset(num_groups=20))
        oracle = artifacts["oracle.json"]
        edges = {tuple(edge) for edge in oracle["confirmed_edges"]}
        non_edges = {tuple(edge) for edge in oracle["confirmed_non_edges"]}
        self.assertFalse(edges & non_edges)
        seen_groups, seen_events = set(), set()
        for split in ("train", "validation", "test"):
            data = artifacts[f"{split}.json"]
            self.assertEqual(data["policy_version"], POLICY_VERSION)
            self.assertFalse(seen_groups & set(data["group_ids"]))
            seen_groups.update(data["group_ids"])
            events = set()
            for row in data["pairs"] + data["unresolved"]:
                validate("EventInput", row["from_event"])
                validate("EventInput", row["to_event"])
                validate("PairFeatures", row["features"])
                edge = (row["from_event"]["source_event_id"], row["to_event"]["source_event_id"])
                events.update(edge)
                if row["label"] is None:
                    self.assertNotIn(edge, edges | non_edges)
                else:
                    self.assertIn(edge, edges if row["label"] == 1 else non_edges)
            self.assertFalse(seen_events & events)
            seen_events.update(events)
            self.assertTrue(all(row["label"] is None for row in data["unresolved"]))
            self.assertEqual({row["label"] for row in data["pairs"]}, {0, 1})

    def test_manifest_hashes_all_exact_bytes_including_oracle(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            manifest = write_dataset(path, num_groups=10)
            for filename, expected in manifest["sha256"].items():
                raw = (path / filename).read_bytes()
                self.assertNotIn(b"\r\n", raw)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), expected)
            self.assertEqual(json.loads((path / "manifest.json").read_text()), manifest)

    def test_training_excludes_null_and_compares_the_same_test_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            write_dataset(path, num_groups=10)
            with patch("ai.training.evaluate_sandbox.train_logistic_regression",
                       wraps=train_logistic_regression) as trainer:
                report = evaluate(path)
            x_train, y_train = trainer.call_args.args
            self.assertEqual(len(x_train), 7 * 16)
            self.assertEqual(len(y_train), 7 * 16)
            self.assertEqual(set(y_train), {0, 1})
            self.assertEqual({len(vector) for vector in x_train}, {5})
            self.assertEqual(report["counts"]["train"]["unresolved_excluded"], 7 * 7)
            self.assertGreater(report["feature_vectors_with_conflicting_oracle_labels"], 0)
            totals = {value["total"] for value in report["raw_scores"].values()}
            self.assertEqual(totals, {report["counts"]["test"]["supervised"]})
            self.assertIsNone(report["unresolved_test"]["supervised_metrics"])
            self.assertGreater(report["unresolved_test"]["reasons"]["AMBIGUOUS_MATCH"], 0)

    def test_loader_rejects_tampering_and_rehashed_invalid_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            for corruption in ("bytes", "policy", "feature_version", "label", "group_overlap", "unresolved_label"):
                with self.subTest(corruption=corruption):
                    manifest = write_dataset(path, num_groups=10)
                    split_path = path / "test.json"
                    data = json.loads(split_path.read_bytes())
                    if corruption == "bytes":
                        split_path.write_bytes(split_path.read_bytes() + b" ")
                    else:
                        if corruption == "policy":
                            data["policy_version"] = "wrong-policy"
                        elif corruption == "feature_version":
                            data["feature_version"] = "sandbox-observable-features-1"
                        elif corruption == "label":
                            data["pairs"][0]["label"] = 1 - data["pairs"][0]["label"]
                        elif corruption == "group_overlap":
                            data["group_ids"].append(json.loads((path / "train.json").read_bytes())["group_ids"][0])
                        else:
                            data["unresolved"][0]["label"] = 0
                        raw = json.dumps(data).encode("utf-8")
                        split_path.write_bytes(raw)
                        manifest["sha256"]["test.json"] = hashlib.sha256(raw).hexdigest()
                        (path / "manifest.json").write_bytes(json.dumps(manifest).encode("utf-8"))
                    with self.assertRaises(DatasetIntegrityError):
                        load_dataset(path)


if __name__ == "__main__":
    unittest.main()
