# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Build training rows exclusively from explicitly reviewed 0/1 labels."""

from dataclasses import dataclass
import json
from pathlib import Path

from ai.app.contracts import ContractError, strict_json_loads, validate_request


class DatasetError(ValueError):
    pass


@dataclass(frozen=True)
class ReviewedDataset:
    rows: tuple
    skipped_unlabeled: int


def reviewed_rows(score_request, review):
    """Do not mutate input or use suggested_label; null never becomes negative."""
    try:
        validate_request(score_request)
    except ContractError:
        raise DatasetError("Score request is invalid") from None
    if not isinstance(review, dict) or not isinstance(review.get("items"), list):
        raise DatasetError("Review must contain an items list")
    pairs = {pair["pair_id"]: pair["features"] for pair in score_request["pairs"]}
    rows, seen, skipped = [], set(), 0
    for item in review["items"]:
        if not isinstance(item, dict):
            raise DatasetError("Every review item must be an object")
        pair_id = item.get("pair_id")
        if not isinstance(pair_id, str) or pair_id not in pairs or pair_id in seen:
            raise DatasetError("Review IDs must match the request exactly once")
        seen.add(pair_id)
        if "label" not in item:
            raise DatasetError("Every review item needs label: 0, 1 or null")
        label = item["label"]
        if label is None:
            skipped += 1
            continue
        if type(label) is not int or label not in (0, 1):
            raise DatasetError("Reviewed label must be an integer 0/1 or null")
        if not all(isinstance(item.get(key), str) and item[key].strip() for key in ("reviewer", "reason")):
            raise DatasetError("A reviewed label requires reviewer and reason")
        rows.append({"pair_id": pair_id, "features": dict(pairs[pair_id]), "label": label})
    if seen != set(pairs):
        raise DatasetError("Review IDs must match the request exactly once")
    return ReviewedDataset(tuple(rows), skipped)


def require_trainable(dataset):
    if not dataset.rows:
        raise DatasetError("No reviewed labels: review the samples before training")
    if {row["label"] for row in dataset.rows} != {0, 1}:
        raise DatasetError("Training requires reviewed examples of both classes 0 and 1")
    # Both classes are necessary, not sufficient for a meaningful train/validation/test split.
    return dataset


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Inspect reviewed labels without training or writing files")
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--review", type=Path, required=True)
    parser.add_argument("--require-trainable", action="store_true")
    args = parser.parse_args()
    try:
        dataset = reviewed_rows(strict_json_loads(args.request.read_text(encoding="utf-8")),
                                strict_json_loads(args.review.read_text(encoding="utf-8")))
        if args.require_trainable:
            require_trainable(dataset)
    except (OSError, ValueError, RecursionError):
        print("DATASET_NOT_READY: check files, reviewed labels, reviewer/reason and both classes")
        return 1
    print(json.dumps({"reviewed": len(dataset.rows), "skipped_unlabeled": dataset.skipped_unlabeled,
                      "positive": sum(row["label"] == 1 for row in dataset.rows),
                      "negative": sum(row["label"] == 0 for row in dataset.rows)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
