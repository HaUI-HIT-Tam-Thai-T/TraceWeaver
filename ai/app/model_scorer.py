# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Trained Model Scorer with SHA256 checksum verification and contract enforcement."""

import hashlib
import json
import math
from pathlib import Path

from ai.app.contracts import validate_request, validate_response


DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[1] / "artifacts" / "model_v1.json"
DEFAULT_MANIFEST_PATH = Path(__file__).resolve().parents[1] / "artifacts" / "manifest.json"
FEATURE_SCHEMA_VERSION = "1"
FEATURE_NAMES = (
    "delta_seconds",
    "shared_id_count",
    "text_similarity",
    "transition_allowed",
    "conflicting_id",
)
MODEL_ALGORITHM = "LogisticRegression (Pure Python SGD with L2)"


def sigmoid(z: float) -> float:
    z_clamped = max(-30.0, min(30.0, z))
    return 1.0 / (1.0 + math.exp(-z_clamped))


def _is_finite_number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def _validated_vector(value: object, *, positive: bool = False) -> list[float]:
    if not isinstance(value, list) or len(value) != len(FEATURE_NAMES):
        raise ValueError("model vector has an invalid length")
    if not all(_is_finite_number(item) for item in value):
        raise ValueError("model vector must contain finite numbers")
    if positive and not all(item > 0.0 for item in value):
        raise ValueError("scaler standard deviations must be positive")
    return [float(item) for item in value]


class ModelScorer:
    method = "model"

    def __init__(self, model_path: Path = DEFAULT_MODEL_PATH, manifest_path: Path | None = None):
        self.model_path = Path(model_path)
        self.manifest_path = (
            Path(manifest_path)
            if manifest_path is not None
            else self.model_path.with_name("manifest.json")
        )
        self.ready = False
        self._load_and_verify()

    def _load_and_verify(self):
        if not self.model_path.is_file() or not self.manifest_path.is_file():
            self.ready = False
            return

        try:
            model_bytes = self.model_path.read_bytes()
            computed_hash = hashlib.sha256(model_bytes).hexdigest()

            manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
            expected_hash = manifest.get("sha256")

            if not expected_hash or computed_hash != expected_hash:
                # Corrupted or tampered model artifact
                return

            model_data = json.loads(model_bytes.decode("utf-8"))
            if not isinstance(model_data, dict) or not isinstance(manifest, dict):
                raise ValueError("model and manifest must be JSON objects")

            model_version = model_data.get("model_version")
            if not isinstance(model_version, str) or not model_version.strip():
                raise ValueError("model version is missing")
            if model_data.get("feature_schema_version") != FEATURE_SCHEMA_VERSION:
                raise ValueError("unsupported feature schema version")
            if model_data.get("algorithm") != MODEL_ALGORITHM:
                raise ValueError("unsupported model algorithm")
            if model_data.get("feature_names") != list(FEATURE_NAMES):
                raise ValueError("model feature names do not match the scorer")

            if manifest.get("model_file") != self.model_path.name:
                raise ValueError("manifest points to a different model file")
            if manifest.get("model_version") != model_version:
                raise ValueError("manifest model version does not match")
            if manifest.get("feature_schema_version") != FEATURE_SCHEMA_VERSION:
                raise ValueError("manifest feature schema version does not match")

            scaler = model_data.get("scaler")
            if not isinstance(scaler, dict):
                raise ValueError("model scaler is missing")
            scaler_mean = _validated_vector(scaler.get("mean"))
            scaler_std = _validated_vector(scaler.get("std"), positive=True)
            weights = _validated_vector(model_data.get("weights"))
            bias = model_data.get("bias")
            if not _is_finite_number(bias):
                raise ValueError("model bias must be finite")

            self.model_version = model_version
            self.feature_names = list(FEATURE_NAMES)
            self.scaler_mean = scaler_mean
            self.scaler_std = scaler_std
            self.weights = weights
            self.bias = float(bias)
            self.ready = True
        except Exception:
            self.ready = False

    def predict_pair(self, features: dict) -> float:
        raw_values = [
            float(features["delta_seconds"]),
            float(features["shared_id_count"]),
            float(features["text_similarity"]),
            1.0 if features["transition_allowed"] else 0.0,
            1.0 if features["conflicting_id"] else 0.0,
        ]
        # Standardize features
        norm_values = [
            (val - m) / s
            for val, m, s in zip(raw_values, self.scaler_mean, self.scaler_std)
        ]
        z = self.bias + sum(w * val for w, val in zip(self.weights, norm_values))
        score = sigmoid(z)
        return round(min(1.0, max(0.0, score)), 6)

    def score(self, request: dict) -> dict:
        if not self.ready:
            raise RuntimeError("ModelScorer is not ready or failed integrity check")

        validate_request(request)
        response = {
            "model_version": self.model_version,
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
            "predictions": [
                {
                    "pair_id": pair["pair_id"],
                    "score": self.predict_pair(pair["features"]),
                }
                for pair in request["pairs"]
            ],
        }
        return validate_response(request, response)
