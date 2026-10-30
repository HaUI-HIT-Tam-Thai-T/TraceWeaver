# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Generate policy scenarios with a separate, explicit synthetic edge oracle."""

from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import random

from ai.features.sandbox_policy import FEATURE_VERSION, POLICY_VERSION, extract_policy_features


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / ".local" / "ai-sandbox-rules-1-features-2"
DATASET_VERSION = "sandbox-oracle-scenarios-1"
STAGES = {
    "I": ("intake", "request.accepted", "success"),
    "A": ("account", "account.created", "success"),
    "P": ("provision", "provision.completed", "success"),
    "F": ("provision", "provision.failed", "failed"),
}


def scenario_rows(group_id, seed):
    rng = random.Random(seed + group_id)
    base = datetime(2026, 10, 20, tzinfo=timezone.utc) + timedelta(days=group_id)
    request = [("request", f"R{group_id}")]
    account = [("account", f"A{group_id}")]
    job = [("job", f"J{group_id}")]
    user = [("user", f"U{group_id % 20}")]
    rows, oracle = [], {"confirmed_edges": [], "confirmed_non_edges": []}

    def add(category, label, stages=("A", "P"), ids=None, delta=20,
            outcome=None, ambiguous=False):
        pair_id = f"g{group_id:04d}-{category}"
        ids = (request, request) if ids is None else ids
        events = []
        for index, stage in enumerate(stages):
            service, action, expected_outcome = STAGES[stage]
            events.append({
                "source_event_id": f"{pair_id}-{'from' if index == 0 else 'to'}",
                "occurred_at": (base + timedelta(seconds=delta if index else 0)).isoformat().replace("+00:00", "Z"),
                "service": service,
                "action": action,
                "outcome": outcome if index == 0 and outcome else expected_outcome,
                "identifiers": [{"namespace": ns, "value": value} for ns, value in ids[index]],
                "message": "synthetic lab event",
                "payload": {},
            })
        left, right = events
        edge = [left["source_event_id"], right["source_event_id"]]
        if label is not None:
            oracle["confirmed_edges" if label == 1 else "confirmed_non_edges"].append(edge)
        rows.append({
            "pair_id": pair_id, "group_id": group_id, "category": category,
            "from_event": left, "to_event": right,
            "ambiguous_attempts": ambiguous,
            "features": extract_policy_features(left, right),
        })

    add("direct_intake", 1, stages=("I", "A"), delta=rng.randint(5, 60))
    add("direct_completed", 1)
    add("direct_failed", 1, stages=("A", "F"))
    add("shared_account_missing_request", 1, ids=(request + account, account))
    add("shared_job", 1, ids=(job, job))
    add("skew_boundary", 1, delta=-5)
    add("same_timestamp", 1, delta=0)
    add("window_boundary", 1, delta=3600)
    add("before_skew_boundary", 0, delta=-5.001)
    add("after_window_boundary", 0, delta=3600.001)
    add("skipped_step", 0, stages=("I", "P"))
    add("reversed_transition", 0, stages=("P", "A"))
    add("request_conflict_despite_shared_account", 0,
        ids=(request + account, [("request", f"other-R{group_id}")] + account))
    add("account_conflict_despite_shared_request", 0,
        ids=(request + account, request + [("account", f"other-A{group_id}")]))
    add("job_conflict", 0, ids=(job, [("job", f"other-J{group_id}")]))
    # Explicit counterexample: oracle confirms no direct edge despite equal features.
    # It is not a retry case and is not labeled from transition/ID/time rules.
    add("oracle_confirmed_non_edge", 0)
    add("no_ids", None, ids=([], []))
    add("user_only", None, ids=(user, user))
    add("missing_id_one_side", None, ids=(request, []))
    add("same_value_different_namespace", None,
        ids=([("request", "same")], [("account", "same")]))
    add("ambiguous_retry", None, ambiguous=True)
    add("outcome_mismatch", None, outcome="failed")
    add("unknown_outcome", None, outcome="unknown")

    positives = {tuple(edge) for edge in oracle["confirmed_edges"]}
    negatives = {tuple(edge) for edge in oracle["confirmed_non_edges"]}
    for row in rows:
        edge = (row["from_event"]["source_event_id"], row["to_event"]["source_event_id"])
        row["label"] = 1 if edge in positives else 0 if edge in negatives else None
    return rows, oracle


def build_dataset(num_groups=120, seed=42):
    if type(num_groups) is not int or num_groups < 10:
        raise ValueError("At least ten scenario groups are required for three nonempty splits")
    group_ids = list(range(1, num_groups + 1))
    random.Random(seed).shuffle(group_ids)
    train_end, val_end = int(num_groups * 0.70), int(num_groups * 0.85)
    partitions = {"train": group_ids[:train_end], "validation": group_ids[train_end:val_end],
                  "test": group_ids[val_end:]}
    artifacts = {}
    oracle = {"policy_version": POLICY_VERSION, "source": "explicit_synthetic_scenario_oracle",
              "confirmed_edges": [], "confirmed_non_edges": []}
    for split, groups in partitions.items():
        rows = []
        for group_id in groups:
            group_rows, group_oracle = scenario_rows(group_id, seed)
            rows.extend(group_rows)
            for key in ("confirmed_edges", "confirmed_non_edges"):
                oracle[key].extend(group_oracle[key])
        artifacts[f"{split}.json"] = {
            "dataset_version": DATASET_VERSION, "policy_version": POLICY_VERSION,
            "feature_version": FEATURE_VERSION, "split": split, "group_ids": groups,
            "pairs": [row for row in rows if row["label"] is not None],
            "unresolved": [row for row in rows if row["label"] is None],
        }
    artifacts["oracle.json"] = oracle
    return artifacts


def write_dataset(output_dir=OUTPUT_DIR, num_groups=120, seed=42):
    artifacts = build_dataset(num_groups, seed)
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"dataset_version": DATASET_VERSION, "policy_version": POLICY_VERSION,
                "feature_version": FEATURE_VERSION, "seed": seed, "groups": num_groups,
                "source_license": "Apache-2.0; generated synthetic scenarios", "sha256": {}}
    for filename, value in artifacts.items():
        raw = (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")
        (output_dir / filename).write_bytes(raw)
        manifest["sha256"][filename] = hashlib.sha256(raw).hexdigest()
    (output_dir / "manifest.json").write_bytes(
        (json.dumps(manifest, indent=2) + "\n").encode("utf-8"))
    return manifest


if __name__ == "__main__":
    print(json.dumps(write_dataset(), indent=2))
