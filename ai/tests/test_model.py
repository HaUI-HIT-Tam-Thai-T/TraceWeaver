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
from ai.app.config import Config
from ai.app.model_scorer import DEFAULT_MANIFEST_PATH, DEFAULT_MODEL_PATH, ModelScorer
from ai.tests.http_server import serve


class ModelScorerTests(unittest.TestCase):
    def setUp(self):
        self.scorer = ModelScorer(DEFAULT_MODEL_PATH, DEFAULT_MANIFEST_PATH)
        self.sample_request = {
            "schema_version": "1",
            "pairs": [
                {
                    "pair_id": "pair-pos-1",
                    "features": {
                        "delta_seconds": 25.0,
                        "shared_id_count": 2,
                        "text_similarity": 0.4,
                        "transition_allowed": True,
                        "conflicting_id": False,
                    },
                },
                {
                    "pair_id": "pair-neg-conflict",
                    "features": {
                        "delta_seconds": 15.0,
                        "shared_id_count": 1,
                        "text_similarity": 0.3,
                        "transition_allowed": True,
                        "conflicting_id": True,
                    },
                },
                {
                    "pair_id": "pair-neg-reverse",
                    "features": {
                        "delta_seconds": -20.0,
                        "shared_id_count": 1,
                        "text_similarity": 0.2,
                        "transition_allowed": False,
                        "conflicting_id": False,
                    },
                },
            ],
        }

    def test_model_artifact_integrity_verification(self):
        self.assertTrue(self.scorer.ready)
        self.assertEqual(self.scorer.model_version, "logistic-regression-v1")
        self.assertEqual(self.scorer.method, "model")

    def test_tampered_model_artifact_fails_safely(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            tampered_model = tmp_path / "model_v1.json"
            tampered_manifest = tmp_path / "manifest.json"

            # Write model with modified weights
            data = json.loads(DEFAULT_MODEL_PATH.read_text(encoding="utf-8"))
            data["weights"][0] += 999.0
            tampered_model.write_text(json.dumps(data), encoding="utf-8")

            # Keep original manifest with old hash
            tampered_manifest.write_text(DEFAULT_MANIFEST_PATH.read_text(encoding="utf-8"), encoding="utf-8")

            broken_scorer = ModelScorer(tampered_model, tampered_manifest)
            self.assertFalse(broken_scorer.ready)
            with self.assertRaises(RuntimeError):
                broken_scorer.score(self.sample_request)

    def test_missing_files_fail_safely(self):
        missing = Path("/nonexistent/model.json")
        scorer = ModelScorer(missing, DEFAULT_MANIFEST_PATH)
        self.assertFalse(scorer.ready)

    def test_model_uses_sibling_manifest_when_loaded_from_another_directory(self):
        """A deployed model must be verified against its own manifest, not the default one."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            release_dir = Path(tmp_dir) / "release"
            release_dir.mkdir()
            model_path = release_dir / "model_v1.json"
            manifest_path = release_dir / "manifest.json"

            model = json.loads(DEFAULT_MODEL_PATH.read_text(encoding="utf-8"))
            model["bias"] = -2.5
            model_bytes = json.dumps(model).encode("utf-8")
            model_path.write_bytes(model_bytes)
            manifest_path.write_text(
                json.dumps(
                    {
                        "model_version": model["model_version"],
                        "feature_schema_version": model["feature_schema_version"],
                        "model_file": model_path.name,
                        "sha256": hashlib.sha256(model_bytes).hexdigest(),
                    }
                ),
                encoding="utf-8",
            )

            scorer = ModelScorer(model_path)

            self.assertTrue(scorer.ready)
            self.assertEqual(scorer.manifest_path, manifest_path)

    def test_structurally_invalid_model_artifacts_fail_safely(self):
        """A matching checksum must not make a malformed model executable."""
        source_model = json.loads(DEFAULT_MODEL_PATH.read_text(encoding="utf-8"))
        invalid_models = {
            "missing weights": {**source_model, "weights": []},
            "non-finite bias": {**source_model, "bias": float("nan")},
            "zero scaler std": {
                **source_model,
                "scaler": {
                    **source_model["scaler"],
                    "std": [0.0, *source_model["scaler"]["std"][1:]],
                },
            },
            "wrong feature order": {
                **source_model,
                "feature_names": list(reversed(source_model["feature_names"])),
            },
            "unsupported schema": {**source_model, "feature_schema_version": "2"},
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            model_path = tmp_path / "model_v1.json"
            manifest_path = tmp_path / "manifest.json"

            for name, model in invalid_models.items():
                with self.subTest(name=name):
                    model_bytes = json.dumps(model, allow_nan=True).encode("utf-8")
                    model_path.write_bytes(model_bytes)
                    manifest_path.write_text(
                        json.dumps(
                            {
                                "model_file": model_path.name,
                                "model_version": model["model_version"],
                                "feature_schema_version": model["feature_schema_version"],
                                "sha256": hashlib.sha256(model_bytes).hexdigest(),
                            }
                        ),
                        encoding="utf-8",
                    )

                    scorer = ModelScorer(model_path, manifest_path)
                    self.assertFalse(scorer.ready)
                    with self.assertRaises(RuntimeError):
                        scorer.score(self.sample_request)

    def test_predict_pair_score_range_and_semantics(self):
        res = self.scorer.score(self.sample_request)
        self.assertEqual(res["model_version"], "logistic-regression-v1")
        self.assertEqual(len(res["predictions"]), 3)

        scores = {p["pair_id"]: p["score"] for p in res["predictions"]}
        # Positive pair should have a high score (> 0.5)
        self.assertGreater(scores["pair-pos-1"], 0.5)

        # Conflicting ID should have a very low score (< 0.2)
        self.assertLess(scores["pair-neg-conflict"], 0.2)
        # Invalid transition should also have a low score (< 0.2)
        self.assertLess(scores["pair-neg-reverse"], 0.2)

        # All scores must be within [0.0, 1.0]
        for item in res["predictions"]:
            self.assertTrue(0.0 <= item["score"] <= 1.0)

    def test_model_mode_end_to_end_http(self):
        secret = secrets.token_hex(32)
        config = Config(
            service_secret=secret,
            mode="model",
            app_env="development",
            model_path=str(DEFAULT_MODEL_PATH),
        )
        with serve(create_app(config)) as address:
            # Check liveness and readiness
            req_live = Request(f"{address}/health/live")
            with urlopen(req_live, timeout=5) as resp:
                self.assertEqual(resp.status, 200)

            req_ready = Request(f"{address}/health/ready")
            with urlopen(req_ready, timeout=5) as resp:
                self.assertEqual(resp.status, 200)

            # Score request via HTTP
            headers = {"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}
            req_score = Request(
                f"{address}/internal/v1/score-pairs",
                data=json.dumps(self.sample_request).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urlopen(req_score, timeout=5) as resp:
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.headers.get("X-Scorer-Method"), "model")
                body = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(body["model_version"], "logistic-regression-v1")
                self.assertEqual(len(body["predictions"]), 3)


if __name__ == "__main__":
    unittest.main()
