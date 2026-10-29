# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Draft feature conventions for synthetic review samples, not a production parser."""

from datetime import datetime
import re
import unicodedata


FEATURE_VERSION = "bootstrap-features-1"
PROCESS_VERSION = "bootstrap-direct-edges-1"
ALLOWED_TRANSITIONS = frozenset({
    (("intake", "request.received"), ("account", "account.created")),
    (("account", "account.created"), ("provision", "environment.provisioned")),
})
EXCLUSIVE_NAMESPACES = frozenset({"request_id", "account_id"})


def text_similarity(left: str, right: str) -> float:
    """Jaccard over normalized Unicode word sets; empty text carries no evidence."""
    def tokens(value):
        normalized = unicodedata.normalize("NFKC", value).casefold()
        return set(re.findall(r"\w+", normalized))

    a, b = tokens(left), tokens(right)
    return len(a & b) / len(a | b) if a and b else 0.0


def extract_pair_features(left: dict, right: dict) -> dict:
    """Read only observable EventInput fields; never accept labels or oracle state."""
    a = {(item["namespace"], item["value"]) for item in left["identifiers"]}
    b = {(item["namespace"], item["value"]) for item in right["identifiers"]}
    conflict = False
    for namespace in EXCLUSIVE_NAMESPACES:
        av = {value for ns, value in a if ns == namespace}
        bv = {value for ns, value in b if ns == namespace}
        conflict = conflict or bool(av and bv and av.isdisjoint(bv))
    start = datetime.fromisoformat(left["occurred_at"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(right["occurred_at"].replace("Z", "+00:00"))
    transition = ((left["service"], left["action"]), (right["service"], right["action"]))
    return {
        "delta_seconds": (end - start).total_seconds(),
        "shared_id_count": len(a & b),
        "text_similarity": text_similarity(left["message"], right["message"]),
        "transition_allowed": transition in ALLOWED_TRANSITIONS,
        "conflicting_id": conflict,
    }
