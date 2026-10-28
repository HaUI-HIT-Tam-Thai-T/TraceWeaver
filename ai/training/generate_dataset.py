# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Generate a reproducible synthetic dataset partitioned strictly by journey."""

from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import random

from ai.features.pair_features import FEATURE_VERSION, PROCESS_VERSION, extract_pair_features


DATASET_VERSION = "synthetic-journey-v1"
ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / ".local" / "ai-dataset"

SERVICES = {
    "intake": ("intake", "request.received", [
        "Request received for cloud lab environment",
        "Student lab environment request initiated",
        "Compute resource request registered",
        "New practice environment requested by student",
    ]),
    "account": ("account", "account.created", [
        "Student user account provisioned successfully",
        "Lab account created with basic privileges",
        "User credentials and workspace allocated",
        "Account setup completed for student",
    ]),
    "provision": ("provision", "environment.provisioned", [
        "Cloud environment resources successfully provisioned",
        "Lab container and network attached to account",
        "Practice environment active and ready for use",
        "Provisioning completed with all containers ready",
    ]),
}


def make_event(service_key, journey_id, user_id, account_id, base_time, offset_seconds,
               outcome="success", message_idx=0, request_override=None, account_override=None):
    service, action, msgs = SERVICES[service_key]
    timestamp = base_time + timedelta(seconds=offset_seconds)
    req_val = request_override or f"req-{journey_id:04d}"
    acc_val = account_override or (f"acc-{journey_id:04d}" if account_id else None)
    usr_val = f"usr-{user_id:04d}"

    identifiers = [{"namespace": "request_id", "value": req_val}]
    if usr_val:
        identifiers.append({"namespace": "user_id", "value": usr_val})
    if acc_val and service_key in ("account", "provision"):
        identifiers.append({"namespace": "account_id", "value": acc_val})

    return {
        "source_event_id": f"evt-{service_key}-{journey_id:04d}-{offset_seconds}",
        "occurred_at": timestamp.isoformat().replace("+00:00", "Z"),
        "service": service,
        "action": action,
        "outcome": outcome,
        "identifiers": identifiers,
        "message": msgs[message_idx % len(msgs)],
        "payload": {"journey_id": journey_id},
    }


def generate_all_journeys(num_journeys=120, seed=42):
    rng = random.Random(seed)
    base_time = datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc)
    journeys = []

    for jid in range(1, num_journeys + 1):
        # Time progression for this journey
        start_offset = jid * 300 + rng.randint(0, 60)
        user_id = (jid % 40) + 1  # 40 users generating 120 requests (shared user_id test)
        t_intake = start_offset
        t_account = t_intake + rng.randint(5, 60)
        t_provision = t_account + rng.randint(10, 120)

        # Normal events
        e_intake = make_event("intake", jid, user_id, True, base_time, t_intake,
                              message_idx=rng.randint(0, 3))
        e_account = make_event("account", jid, user_id, True, base_time, t_account,
                               message_idx=rng.randint(0, 3))
        e_provision = make_event("provision", jid, user_id, True, base_time, t_provision,
                                 message_idx=rng.randint(0, 3))

        events = [e_intake, e_account, e_provision]
        journeys.append({
            "journey_id": jid,
            "user_id": user_id,
            "events": events,
        })

    return journeys


def extract_pairs_from_journeys(journeys, rng):
    """Create positive and hard negative pairs partitioned by journey."""
    pairs = []
    pair_counter = 1

    # Map journeys for cross-journey negative generation within the same partition
    by_user = {}
    for j in journeys:
        by_user.setdefault(j["user_id"], []).append(j)

    for j in journeys:
        jid = j["journey_id"]
        evts = j["events"]
        e_in, e_acc, e_prov = evts[0], evts[1], evts[2]

        # 1. Positive pairs: direct valid edges
        # intake -> account
        pairs.append({
            "pair_id": f"p-{pair_counter:04d}",
            "journey_id": jid,
            "from_event": e_in,
            "to_event": e_acc,
            "label": 1,
            "category": "direct_intake_to_account",
        })
        pair_counter += 1

        # account -> provision
        pairs.append({
            "pair_id": f"p-{pair_counter:04d}",
            "journey_id": jid,
            "from_event": e_acc,
            "to_event": e_prov,
            "label": 1,
            "category": "direct_account_to_provision",
        })
        pair_counter += 1

        # 2. Hard Negatives inside the same journey:
        # A. Skipped step: intake -> provision (same journey, but not a direct edge!)
        pairs.append({
            "pair_id": f"p-{pair_counter:04d}",
            "journey_id": jid,
            "from_event": e_in,
            "to_event": e_prov,
            "label": 0,
            "category": "skipped_step_intake_to_provision",
        })
        pair_counter += 1

        # B. Reversed edge: account -> intake (wrong direction)
        pairs.append({
            "pair_id": f"p-{pair_counter:04d}",
            "journey_id": jid,
            "from_event": e_acc,
            "to_event": e_in,
            "label": 0,
            "category": "reversed_edge_account_to_intake",
        })
        pair_counter += 1

        # C. Reverse edge: provision -> account
        pairs.append({
            "pair_id": f"p-{pair_counter:04d}",
            "journey_id": jid,
            "from_event": e_prov,
            "to_event": e_acc,
            "label": 0,
            "category": "reversed_edge_provision_to_account",
        })
        pair_counter += 1

    # 3. Cross-journey negatives (strictly within the same journey partition!):
    # A. Same user_id, different request_id (very tricky hard negative!)
    for user_id, user_journeys in by_user.items():
        if len(user_journeys) >= 2:
            for i in range(len(user_journeys) - 1):
                j1, j2 = user_journeys[i], user_journeys[i + 1]
                # intake of j1 with account of j2
                pairs.append({
                    "pair_id": f"p-{pair_counter:04d}",
                    "journey_id": j1["journey_id"],  # attribute to j1 partition
                    "from_event": j1["events"][0],
                    "to_event": j2["events"][1],
                    "label": 0,
                    "category": "shared_user_different_request",
                })
                pair_counter += 1

    # B. Conflicting account_id (account with acc-1, provision with acc-2)
    for j in journeys[:len(journeys) // 2]:
        jid = j["journey_id"]
        e_acc = j["events"][1]
        # create a synthetic provision with conflicting account_id
        conflicting_prov = make_event(
            "provision", jid, j["user_id"], True,
            datetime.fromisoformat(e_acc["occurred_at"].replace("Z", "+00:00")),
            offset_seconds=30,
            account_override=f"acc-conflict-{jid:04d}",
        )
        pairs.append({
            "pair_id": f"p-{pair_counter:04d}",
            "journey_id": jid,
            "from_event": e_acc,
            "to_event": conflicting_prov,
            "label": 0,
            "category": "conflicting_account_id",
        })
        pair_counter += 1

    # Compute features for each pair
    for item in pairs:
        item["features"] = extract_pair_features(item["from_event"], item["to_event"])

    return pairs


def build_and_save_dataset(output_dir: Path = OUTPUT_DIR, num_journeys: int = 120, seed: int = 42):
    rng = random.Random(seed)
    all_journeys = generate_all_journeys(num_journeys=num_journeys, seed=seed)

    # 70% Train, 15% Validation, 15% Test partitioned by Journey ID
    journey_ids = [j["journey_id"] for j in all_journeys]
    rng.shuffle(journey_ids)

    n_total = len(journey_ids)
    n_train = int(n_total * 0.70)
    n_val = int(n_total * 0.15)

    train_jids = set(journey_ids[:n_train])
    val_jids = set(journey_ids[n_train:n_train + n_val])
    test_jids = set(journey_ids[n_train + n_val:])

    train_journeys = [j for j in all_journeys if j["journey_id"] in train_jids]
    val_journeys = [j for j in all_journeys if j["journey_id"] in val_jids]
    test_journeys = [j for j in all_journeys if j["journey_id"] in test_jids]

    train_pairs = extract_pairs_from_journeys(train_journeys, rng)
    val_pairs = extract_pairs_from_journeys(val_journeys, rng)
    test_pairs = extract_pairs_from_journeys(test_journeys, rng)

    def prepare_split_payload(pairs, split_name):
        return {
            "dataset_version": DATASET_VERSION,
            "split": split_name,
            "feature_version": FEATURE_VERSION,
            "process_template_version": PROCESS_VERSION,
            "count": len(pairs),
            "positive_count": sum(1 for p in pairs if p["label"] == 1),
            "negative_count": sum(1 for p in pairs if p["label"] == 0),
            "pairs": [
                {
                    "pair_id": p["pair_id"],
                    "journey_id": p["journey_id"],
                    "label": p["label"],
                    "category": p["category"],
                    "features": p["features"],
                }
                for p in pairs
            ],
        }

    train_data = prepare_split_payload(train_pairs, "train")
    val_data = prepare_split_payload(val_pairs, "validation")
    test_data = prepare_split_payload(test_pairs, "test")

    output_dir.mkdir(parents=True, exist_ok=True)
    files = {
        "train.json": train_data,
        "validation.json": val_data,
        "test.json": test_data,
    }

    manifest = {
        "dataset_version": DATASET_VERSION,
        "num_journeys": num_journeys,
        "splits": {
            "train": {"journeys": len(train_jids), "pairs": len(train_pairs), "pos": train_data["positive_count"], "neg": train_data["negative_count"]},
            "validation": {"journeys": len(val_jids), "pairs": len(val_pairs), "pos": val_data["positive_count"], "neg": val_data["negative_count"]},
            "test": {"journeys": len(test_jids), "pairs": len(test_pairs), "pos": test_data["positive_count"], "neg": test_data["negative_count"]},
        },
        "sha256": {},
    }

    for name, content in files.items():
        text = json.dumps(content, indent=2, ensure_ascii=False) + "\n"
        path = output_dir / name
        content_bytes = text.encode("utf-8")
        path.write_bytes(content_bytes)
        manifest["sha256"][name] = hashlib.sha256(content_bytes).hexdigest()

    manifest_text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    (output_dir / "manifest.json").write_text(manifest_text, encoding="utf-8")

    return manifest


if __name__ == "__main__":
    res = build_and_save_dataset()
    print("Dataset generated successfully:")
    print(json.dumps(res, indent=2))
