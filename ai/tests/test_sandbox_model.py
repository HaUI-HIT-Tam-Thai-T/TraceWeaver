# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

import hashlib
import json
from pathlib import Path
import secrets
import tempfile
import unittest
from urllib.request import Request, urlopen

from ai.app.api import create_app
from ai.app.config import read_config
from ai.app.model_scorer import DEFAULT_MANIFEST_PATH, DEFAULT_MODEL_PATH, ModelScorer
from ai.features.sandbox_policy import FEATURE_VERSION, POLICY_VERSION
from ai.tests.http_server import serve
from ai.training.export_sandbox_model import MODEL_VERSION, export_model
from ai.training.sandbox_dataset import ROOT, write_dataset
from ai.training.train import DatasetIntegrityError


class SandboxModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (ROOT / ".local").mkdir(exist_ok=True)
        cls.temporary = tempfile.TemporaryDirectory(dir=ROOT / ".local")
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.directory = Path(cls.temporary.name)
        cls.dataset = cls.directory / "dataset"
        cls.default_before = (DEFAULT_MODEL_PATH.read_bytes(), DEFAULT_MANIFEST_PATH.read_bytes())
        write_dataset(cls.dataset, num_groups=10)
        cls.model_path = export_model(cls.dataset, cls.directory / "bundle")
        cls.bundle = cls.model_path.parent
        cls.request = json.loads((cls.bundle / "score-request.json").read_text(encoding="utf-8"))
        cls.expected = json.loads((cls.bundle / "expected-response.json").read_text(encoding="utf-8"))

    def test_export_has_verified_provenance_and_keeps_default_artifact(self):
        manifest = json.loads((self.bundle / "manifest.json").read_text(encoding="utf-8"))
        report = json.loads((self.bundle / "evaluation.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["sha256"], hashlib.sha256(self.model_path.read_bytes()).hexdigest())
        self.assertEqual(manifest["evaluation_sha256"],
                         hashlib.sha256((self.bundle / "evaluation.json").read_bytes()).hexdigest())
        self.assertEqual(manifest["dataset_checksums"], report["dataset_checksums"])
        self.assertEqual(manifest["policy_version"], POLICY_VERSION)
        self.assertEqual(manifest["feature_version"], FEATURE_VERSION)
        self.assertEqual(manifest["usage"], "local_experiment_not_default")
        self.assertEqual(manifest["scaler_fit_split"], "train")
        self.assertEqual(manifest["threshold_selection_split"], "validation")
        self.assertEqual((DEFAULT_MODEL_PATH.read_bytes(), DEFAULT_MANIFEST_PATH.read_bytes()), self.default_before)
        self.assertEqual((self.bundle / "LICENSE").read_bytes(), (ROOT / "LICENSE").read_bytes())

    def test_runtime_matches_offline_scores_and_keeps_unresolved_numeric(self):
        scorer = ModelScorer(self.model_path)
        self.assertTrue(scorer.ready)
        self.assertEqual(scorer.score(self.request), self.expected)
        self.assertEqual(len(self.expected["predictions"]), 23)
        # Unresolved rows are included in the sample. The API still returns scores;
        # five numeric features cannot replace event/context policy decisions.
        self.assertTrue(all(set(pair) == {"pair_id", "features"} for pair in self.request["pairs"]))
        self.assertTrue(all(0 <= pair["score"] <= 1 for pair in self.expected["predictions"]))

    def test_explicit_environment_path_loads_new_model_over_http(self):
        secret = secrets.token_hex(32)
        config = read_config({"SCORER_SERVICE_SECRET": secret, "SCORER_MODE": "model",
                              "SCORER_MODEL_PATH": str(self.model_path), "APP_ENV": "test"})
        with serve(create_app(config)) as address:
            with urlopen(address + "/health/ready", timeout=5) as response:
                self.assertEqual(response.status, 200)
            request = Request(address + "/internal/v1/score-pairs",
                              data=json.dumps(self.request).encode("utf-8"), method="POST",
                              headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"})
            with urlopen(request, timeout=5) as response:
                body = json.loads(response.read())
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers["X-Scorer-Method"], "model")
                self.assertEqual(body["model_version"], MODEL_VERSION)
                self.assertEqual(body, self.expected)

    def test_existing_bundle_is_preserved(self):
        before = self.model_path.read_bytes()
        with self.assertRaises(FileExistsError):
            export_model(self.dataset, self.bundle)
        self.assertEqual(self.model_path.read_bytes(), before)

    def test_modified_dataset_cannot_produce_an_artifact(self):
        dataset = self.directory / "corrupt-dataset"
        write_dataset(dataset, num_groups=10)
        with (dataset / "train.json").open("ab") as handle:
            handle.write(b" ")
        output = self.directory / "rejected-bundle"
        with self.assertRaises(DatasetIntegrityError):
            export_model(dataset, output)
        self.assertFalse(output.exists())

    def test_export_outside_local_storage_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                export_model(self.dataset, Path(directory) / "bundle")


if __name__ == "__main__":
    unittest.main()
