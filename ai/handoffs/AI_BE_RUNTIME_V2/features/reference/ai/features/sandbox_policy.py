# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Offline reference for the team-confirmed policy; not a backend guard."""

from datetime import datetime

from ai.features.pair_features import text_similarity


POLICY_VERSION = "sandbox-rules-1"
FEATURE_VERSION = "sandbox-observable-features-2"
REDACTION_MARKER = "[REDACTED]"
STRONG_NAMESPACES = frozenset({"request", "account", "job"})
EXPECTED_OUTCOMES = {
    ("intake", "request.accepted"): "success",
    ("account", "account.created"): "success",
    ("provision", "provision.completed"): "success",
    ("provision", "provision.failed"): "failed",
}
ALLOWED_TRANSITIONS = frozenset({
    (("intake", "request.accepted"), ("account", "account.created")),
    (("account", "account.created"), ("provision", "provision.completed")),
    (("account", "account.created"), ("provision", "provision.failed")),
})


def identifiers(event):
    """Masked values, including partially masked IDs, carry no identity evidence."""
    return {(item["namespace"], item["value"]) for item in event["identifiers"]
            if REDACTION_MARKER not in item["value"]}


def extract_policy_features(left, right):
    """Count all unmasked matching IDs, preserving the agreed schema-1 semantics."""
    a, b = identifiers(left), identifiers(right)
    conflict = False
    for namespace in STRONG_NAMESPACES:
        av = {value for ns, value in a if ns == namespace}
        bv = {value for ns, value in b if ns == namespace}
        conflict |= any(x != y for x in av for y in bv)
    start = datetime.fromisoformat(left["occurred_at"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(right["occurred_at"].replace("Z", "+00:00"))
    transition = ((left["service"], left["action"]), (right["service"], right["action"]))
    return {
        "delta_seconds": (end - start).total_seconds(),
        "shared_id_count": len(a & b),
        "text_similarity": text_similarity(left["message"].replace(REDACTION_MARKER, " "),
                                           right["message"].replace(REDACTION_MARKER, " ")),
        "transition_allowed": transition in ALLOWED_TRANSITIONS,
        "conflicting_id": conflict,
    }


def assess_pair(left, right, *, ambiguous=False):
    """Classify observable evidence; eligibility is never a ground-truth label."""
    features = extract_policy_features(left, right)
    if not features["transition_allowed"]:
        return {"status": "rejected", "reason": "TRANSITION_NOT_ALLOWED"}
    if not -5 <= features["delta_seconds"] <= 3600:
        return {"status": "rejected", "reason": "OUTSIDE_TIME_WINDOW"}
    if features["conflicting_id"]:
        return {"status": "rejected", "reason": "STRONG_ID_CONFLICT"}
    for event in (left, right):
        outcome = event["outcome"]
        expected = EXPECTED_OUTCOMES[(event["service"], event["action"])]
        if outcome == "unknown":
            return {"status": "unresolved", "reason": "OUTCOME_UNKNOWN"}
        if outcome != expected:
            return {"status": "unresolved", "reason": "OUTCOME_ACTION_MISMATCH"}
    if ambiguous:
        return {"status": "unresolved", "reason": "AMBIGUOUS_MATCH"}
    shared_strong = {(ns, value) for ns, value in identifiers(left) & identifiers(right)
                     if ns in STRONG_NAMESPACES}
    if not shared_strong:
        return {"status": "unresolved", "reason": "NO_SHARED_STRONG_ID"}
    return {"status": "eligible", "reason": None}
