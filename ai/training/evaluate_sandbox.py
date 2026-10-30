# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Train/evaluate an offline experiment without replacing the deployed artifact."""

from collections import Counter, defaultdict
import hashlib
import json

from ai.app.baseline import pair_score
from ai.app.contracts import strict_json_loads, validate
from ai.features.sandbox_policy import FEATURE_VERSION, POLICY_VERSION, assess_pair, extract_policy_features
from ai.training.sandbox_dataset import DATASET_VERSION, OUTPUT_DIR, ROOT
from ai.training.train import (DatasetIntegrityError, compute_scaler, evaluate_metrics,
                               extract_vector, find_best_threshold, predict_proba,
                               train_logistic_regression, transform, verify_dataset_integrity)


REPORT_DIR = ROOT / ".local" / "ai-sandbox-evaluation-features-2"


def load_dataset(directory):
    manifest = verify_dataset_integrity(directory)
    if (manifest.get("policy_version"), manifest.get("feature_version"), manifest.get("dataset_version")) != (
            POLICY_VERSION, FEATURE_VERSION, DATASET_VERSION):
        raise DatasetIntegrityError("Dataset policy/feature/version is incompatible with this experiment")
    files = {}
    for filename in ("train.json", "validation.json", "test.json", "oracle.json"):
        raw = (directory / filename).read_bytes()
        if hashlib.sha256(raw).hexdigest() != manifest["sha256"].get(filename):
            raise DatasetIntegrityError(f"Dataset checksum mismatch: {filename}")
        files[filename] = strict_json_loads(raw.decode("utf-8"))
    oracle = files["oracle.json"]
    if oracle.get("policy_version") != POLICY_VERSION:
        raise DatasetIntegrityError("Oracle policy is incompatible")
    edges = {tuple(edge) for edge in oracle["confirmed_edges"]}
    non_edges = {tuple(edge) for edge in oracle["confirmed_non_edges"]}
    if edges & non_edges:
        raise DatasetIntegrityError("Oracle contains conflicting labels")
    seen_groups, seen_events, seen_pairs = set(), set(), set()
    for split in ("train", "validation", "test"):
        data = files[f"{split}.json"]
        if (data.get("policy_version"), data.get("feature_version"), data.get("dataset_version"),
                data.get("split")) != (POLICY_VERSION, FEATURE_VERSION, DATASET_VERSION, split):
            raise DatasetIntegrityError("Split metadata does not match the manifest")
        groups = set(data["group_ids"])
        if not groups or groups & seen_groups:
            raise DatasetIntegrityError("Scenario groups overlap across splits")
        seen_groups.update(groups)
        events = set()
        for collection in ("pairs", "unresolved"):
            for row in data[collection]:
                if row["group_id"] not in groups or row["pair_id"] in seen_pairs:
                    raise DatasetIntegrityError("Invalid scenario membership or duplicate pair")
                seen_pairs.add(row["pair_id"])
                left, right = row["from_event"], row["to_event"]
                validate("EventInput", left)
                validate("EventInput", right)
                validate("PairFeatures", row["features"])
                if row["features"] != extract_policy_features(left, right):
                    raise DatasetIntegrityError("Features do not match observable events")
                edge = (left["source_event_id"], right["source_event_id"])
                events.update(edge)
                expected = 1 if edge in edges else 0 if edge in non_edges else None
                if collection == "unresolved":
                    if row["label"] is not None or expected is not None:
                        raise DatasetIntegrityError("Unresolved cases must not contain supervised labels")
                elif type(row["label"]) is not int or row["label"] not in (0, 1) or row["label"] != expected:
                    raise DatasetIntegrityError("Supervised label is not confirmed by the oracle")
                elif assess_pair(left, right, ambiguous=row["ambiguous_attempts"])["status"] == "unresolved":
                    raise DatasetIntegrityError("Insufficient-evidence scenarios cannot enter supervised training")
        if events & seen_events:
            raise DatasetIntegrityError("Events overlap across splits")
        seen_events.update(events)
        if {row["label"] for row in data["pairs"]} != {0, 1}:
            raise DatasetIntegrityError("Every evaluation split needs both supervised classes")
    return files, manifest


def evaluate(directory=OUTPUT_DIR):
    files, manifest = load_dataset(directory)
    splits = {name: files[f"{name}.json"] for name in ("train", "validation", "test")}
    vectors = {name: [extract_vector(row["features"]) for row in data["pairs"]]
               for name, data in splits.items()}
    labels = {name: [row["label"] for row in data["pairs"]] for name, data in splits.items()}
    scaler = compute_scaler(vectors["train"])
    weights, bias = train_logistic_regression(transform(vectors["train"], scaler), labels["train"],
                                              epochs=2000, lr=0.15, l2=0.01)
    threshold = find_best_threshold(labels["validation"],
                                   predict_proba(transform(vectors["validation"], scaler), weights, bias))
    rows = splits["test"]["pairs"]
    scores = {
        "model": predict_proba(transform(vectors["test"], scaler), weights, bias),
        "legacy_baseline": [pair_score(row["features"]) for row in rows],
        "two_flag_rule": [float(row["features"]["transition_allowed"] and
                                not row["features"]["conflicting_id"]) for row in rows],
    }
    thresholds = {"model": threshold, "legacy_baseline": 0.5, "two_flag_rule": 0.5}
    decisions = [assess_pair(row["from_event"], row["to_event"], ambiguous=row["ambiguous_attempts"])
                 for row in rows]
    filtered = {name: [score if decision["status"] == "eligible" else 0.0
                       for score, decision in zip(values, decisions)] for name, values in scores.items()}

    def metrics(values, indices):
        return {name: evaluate_metrics([labels["test"][i] for i in indices],
                                      [items[i] for i in indices], thresholds[name])
                for name, items in values.items()}

    by_category = defaultdict(list)
    for index, row in enumerate(rows):
        by_category[row["category"]].append(index)
    unresolved = splits["test"]["unresolved"]
    unresolved_scores = predict_proba(transform([extract_vector(row["features"]) for row in unresolved],
                                               scaler), weights, bias)
    reasons = Counter()
    unresolved_groups = defaultdict(list)
    for row, score in zip(unresolved, unresolved_scores):
        decision = assess_pair(row["from_event"], row["to_event"], ambiguous=row["ambiguous_attempts"])
        reasons[decision["reason"] or decision["status"]] += 1
        unresolved_groups[row["category"]].append(score)
    collisions = defaultdict(set)
    for row in rows:
        collisions[json.dumps(row["features"], sort_keys=True)].add(row["label"])
    return {
        "policy_version": POLICY_VERSION, "dataset_version": DATASET_VERSION,
        "feature_version": FEATURE_VERSION, "dataset_checksums": manifest["sha256"],
        "experiment": "offline_only_not_promoted_to_runtime",
        "model": {"algorithm": "LogisticRegression", "weights": weights, "bias": bias,
                  "scaler_fit_split": "train", "scaler": scaler, "threshold": threshold,
                  "threshold_selection_split": "validation"},
        "counts": {name: {"groups": len(data["group_ids"]), "supervised": len(data["pairs"]),
                           "unresolved_excluded": len(data["unresolved"])} for name, data in splits.items()},
        "raw_scores": metrics(scores, list(range(len(rows)))),
        "eligible_candidates_only": metrics(scores, [index for index, decision in enumerate(decisions)
                                                     if decision["status"] == "eligible"]),
        "after_offline_policy_filter": metrics(filtered, list(range(len(rows)))),
        "by_category": {category: {"raw_scores": metrics(scores, indices),
                                   "after_offline_policy_filter": metrics(filtered, indices)}
                        for category, indices in sorted(by_category.items())},
        "unresolved_test": {
            "count": len(unresolved), "reasons": dict(reasons), "supervised_metrics": None,
            "raw_model_scores_by_category": {
                category: {"count": len(values), "min": min(values), "max": max(values),
                           "at_or_above_threshold": sum(value >= threshold for value in values)}
                for category, values in sorted(unresolved_groups.items())}},
        "feature_vectors_with_conflicting_oracle_labels": sum(values == {0, 1} for values in collisions.values()),
        "limitations": [
            "Synthetic scenario suite repeated across disjoint groups; not real-world generalization evidence.",
            "Oracle-confirmed non-edge is a controlled feature-collision test, not a newly approved business rule.",
            "BE confirmed that unknown/mismatched outcomes remain unresolved; backend implementation must be verified.",
            "shared_id_count still counts all matching namespaces; strong-ID evidence stays outside model input.",
            "Offline policy filtering has event/context evidence unavailable to the five-feature runtime scorer.",
            "BE owns unresolved/reasons; schema 1 keeps all five features and all-ID shared count.",
        ],
    }


def write_report(report, directory=REPORT_DIR):
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "evaluation.json"
    path.write_bytes((json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8"))
    return path


if __name__ == "__main__":
    report = evaluate()
    path = write_report(report)
    print(json.dumps({"report": str(path), "counts": report["counts"],
                      "raw_scores": report["raw_scores"],
                      "after_offline_policy_filter": report["after_offline_policy_filter"],
                      "unresolved_test": report["unresolved_test"]["count"]}, indent=2))
