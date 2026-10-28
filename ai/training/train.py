# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Train a Logistic Regression model on normalized synthetic journey features."""

from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path

from ai.app.baseline import pair_score


ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = ROOT / ".local" / "ai-dataset"
ARTIFACTS_DIR = ROOT / "ai" / "artifacts"

FEATURE_NAMES = [
    "delta_seconds",
    "shared_id_count",
    "text_similarity",
    "transition_allowed",
    "conflicting_id",
]
DATASET_SPLIT_FILENAMES = ("train.json", "validation.json", "test.json")


class DatasetIntegrityError(ValueError):
    """Raised when a dataset split does not match its recorded manifest."""


def verify_dataset_integrity(dataset_dir: Path) -> dict:
    """Return a verified dataset manifest or fail before training can start."""
    manifest_path = dataset_dir / "manifest.json"
    if not manifest_path.is_file():
        raise DatasetIntegrityError("Dataset manifest is missing. Run generate_dataset first.")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise DatasetIntegrityError("Dataset manifest is unreadable.") from error

    if not isinstance(manifest, dict) or not isinstance(manifest.get("sha256"), dict):
        raise DatasetIntegrityError("Dataset manifest has no split checksums.")

    checksums = manifest["sha256"]
    for filename in DATASET_SPLIT_FILENAMES:
        split_path = dataset_dir / filename
        expected_hash = checksums.get(filename)
        if not split_path.is_file() or not isinstance(expected_hash, str):
            raise DatasetIntegrityError(f"Dataset split or checksum is missing: {filename}")
        actual_hash = hashlib.sha256(split_path.read_bytes()).hexdigest()
        if actual_hash != expected_hash:
            raise DatasetIntegrityError(f"Dataset checksum mismatch: {filename}")

    return manifest


def extract_vector(features: dict) -> list[float]:
    return [
        float(features["delta_seconds"]),
        float(features["shared_id_count"]),
        float(features["text_similarity"]),
        1.0 if features["transition_allowed"] else 0.0,
        1.0 if features["conflicting_id"] else 0.0,
    ]


def compute_scaler(x_train: list[list[float]]):
    n = len(x_train)
    num_features = len(FEATURE_NAMES)
    means = [sum(row[j] for row in x_train) / n for j in range(num_features)]
    stds = []
    for j in range(num_features):
        variance = sum((row[j] - means[j]) ** 2 for row in x_train) / n
        std = math.sqrt(variance)
        # Avoid division by zero for low-variance features
        stds.append(std if std > 1e-6 else 1.0)
    return {"mean": means, "std": stds}


def transform(x: list[list[float]], scaler: dict) -> list[list[float]]:
    means, stds = scaler["mean"], scaler["std"]
    return [
        [(val - m) / s for val, m, s in zip(row, means, stds)]
        for row in x
    ]


def sigmoid(z: float) -> float:
    z_clamped = max(-30.0, min(30.0, z))
    return 1.0 / (1.0 + math.exp(-z_clamped))


def predict_proba(x_norm: list[list[float]], weights: list[float], bias: float) -> list[float]:
    probs = []
    for row in x_norm:
        z = bias + sum(w * val for w, val in zip(weights, row))
        probs.append(sigmoid(z))
    return probs


def train_logistic_regression(x_train_norm, y_train, epochs=1500, lr=0.1, l2=0.01):
    n = len(x_train_norm)
    num_features = len(FEATURE_NAMES)
    weights = [0.0] * num_features
    bias = 0.0

    for _ in range(epochs):
        # Forward pass
        probs = [sigmoid(bias + sum(w * val for w, val in zip(weights, row))) for row in x_train_norm]

        # Gradients
        grad_w = [0.0] * num_features
        grad_b = 0.0
        for i in range(n):
            err = probs[i] - y_train[i]
            grad_b += err
            for j in range(num_features):
                grad_w[j] += err * x_train_norm[i][j]

        # L2 Regularization & Update
        bias -= lr * (grad_b / n)
        for j in range(num_features):
            grad_w[j] = (grad_w[j] / n) + (l2 / n) * weights[j]
            weights[j] -= lr * grad_w[j]

    return weights, bias


def evaluate_metrics(y_true: list[int], probs: list[float], threshold=0.5):
    tp = sum(1 for y, p in zip(y_true, probs) if y == 1 and p >= threshold)
    fp = sum(1 for y, p in zip(y_true, probs) if y == 0 and p >= threshold)
    fn = sum(1 for y, p in zip(y_true, probs) if y == 1 and p < threshold)
    tn = sum(1 for y, p in zip(y_true, probs) if y == 0 and p < threshold)

    accuracy = (tp + tn) / len(y_true) if y_true else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "total": len(y_true),
    }


def find_best_threshold(y_val: list[int], val_probs: list[float]) -> float:
    best_f1, best_t = 0.0, 0.5
    for t_step in range(20, 81, 5):
        t = t_step / 100.0
        metrics = evaluate_metrics(y_val, val_probs, threshold=t)
        if metrics["f1"] > best_f1:
            best_f1 = metrics["f1"]
            best_t = t
    return best_t


def run_pipeline():
    train_file = DATASET_DIR / "train.json"
    val_file = DATASET_DIR / "validation.json"
    test_file = DATASET_DIR / "test.json"

    verify_dataset_integrity(DATASET_DIR)

    train_data = json.loads(train_file.read_text(encoding="utf-8"))
    val_data = json.loads(val_file.read_text(encoding="utf-8"))
    test_data = json.loads(test_file.read_text(encoding="utf-8"))

    x_train_raw = [extract_vector(p["features"]) for p in train_data["pairs"]]
    y_train = [p["label"] for p in train_data["pairs"]]

    x_val_raw = [extract_vector(p["features"]) for p in val_data["pairs"]]
    y_val = [p["label"] for p in val_data["pairs"]]

    x_test_raw = [extract_vector(p["features"]) for p in test_data["pairs"]]
    y_test = [p["label"] for p in test_data["pairs"]]

    # 1. Fit scaler ONLY on train data
    scaler = compute_scaler(x_train_raw)

    # 2. Transform splits
    x_train = transform(x_train_raw, scaler)
    x_val = transform(x_val_raw, scaler)
    x_test = transform(x_test_raw, scaler)

    # 3. Train Logistic Regression
    weights, bias = train_logistic_regression(x_train, y_train, epochs=2000, lr=0.15, l2=0.01)

    # 4. Find optimal threshold on validation set
    val_probs = predict_proba(x_val, weights, bias)
    best_threshold = find_best_threshold(y_val, val_probs)

    # 5. Evaluate Model on held-out test set
    test_probs = predict_proba(x_test, weights, bias)
    model_metrics = evaluate_metrics(y_test, test_probs, threshold=best_threshold)

    # 6. Evaluate Baseline on held-out test set
    baseline_probs = [pair_score(p["features"]) for p in test_data["pairs"]]
    # Baseline decision threshold is typically 0.5 (or >= 0.5)
    baseline_metrics = evaluate_metrics(y_test, baseline_probs, threshold=0.5)

    # 7. Build Model Artifact
    model_artifact = {
        "model_version": "logistic-regression-v1",
        "feature_schema_version": "1",
        "algorithm": "LogisticRegression (Pure Python SGD with L2)",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "feature_names": FEATURE_NAMES,
        "scaler": scaler,
        "weights": [round(w, 6) for w in weights],
        "bias": round(bias, 6),
        "decision_threshold": best_threshold,
        "test_metrics": {
            "model": model_metrics,
            "baseline": baseline_metrics,
        },
    }

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    model_json = json.dumps(model_artifact, indent=2, ensure_ascii=False) + "\n"
    model_path = ARTIFACTS_DIR / "model_v1.json"
    with model_path.open("w", encoding="utf-8", newline="\n") as f:
        f.write(model_json)

    model_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()

    manifest = {
        "model_version": "logistic-regression-v1",
        "feature_schema_version": "1",
        "model_file": "model_v1.json",
        "sha256": model_hash,
        "trained_on": DATASET_DIR.name,
        "metrics_summary": {
            "model_f1": model_metrics["f1"],
            "model_precision": model_metrics["precision"],
            "model_recall": model_metrics["recall"],
            "baseline_f1": baseline_metrics["f1"],
            "baseline_precision": baseline_metrics["precision"],
            "baseline_recall": baseline_metrics["recall"],
        },
    }

    manifest_json = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    with (ARTIFACTS_DIR / "manifest.json").open("w", encoding="utf-8", newline="\n") as f:
        f.write(manifest_json)


    return model_artifact, manifest


if __name__ == "__main__":
    artifact, manifest = run_pipeline()
    print("=" * 60)
    print(f"Model Version: {artifact['model_version']}")
    print(f"Decision Threshold: {artifact['decision_threshold']}")
    print(f"Model Weights: {dict(zip(FEATURE_NAMES, artifact['weights']))}")
    print(f"Model Bias: {artifact['bias']}")
    print("-" * 60)
    print("EVALUATION ON TEST SET (103 pairs):")
    print(f"Model    -> F1: {artifact['test_metrics']['model']['f1']}, Precision: {artifact['test_metrics']['model']['precision']}, Recall: {artifact['test_metrics']['model']['recall']}")
    print(f"Baseline -> F1: {artifact['test_metrics']['baseline']['f1']}, Precision: {artifact['test_metrics']['baseline']['precision']}, Recall: {artifact['test_metrics']['baseline']['recall']}")
    print("-" * 60)
    print(f"SHA256: {manifest['sha256']}")
    print(f"Saved artifacts to {ARTIFACTS_DIR}")
    print("=" * 60)
