# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Golden feature cases with expected values authored independently of the extractor."""

from copy import deepcopy

from ai.features.sandbox_policy import FEATURE_VERSION, POLICY_VERSION


def build_feature_fixtures():
    shared = [{"namespace": "request", "value": "R1"}, {"namespace": "user", "value": "U1"}]
    left = {"source_event_id": "synthetic-a", "occurred_at": "2026-10-28T10:00:00Z",
            "service": "intake", "action": "request.accepted", "outcome": "success",
            "identifiers": shared, "message": "Create lab account", "payload": {}}
    right = {**left, "source_event_id": "synthetic-b", "occurred_at": "2026-10-28T10:00:20Z",
             "service": "account", "action": "account.created", "message": "lab account ready"}
    expected = {"delta_seconds": 20.0, "shared_id_count": 2, "text_similarity": 0.5,
                "transition_allowed": True, "conflicting_id": False}
    cases = []

    def ids(*values):
        return [{"namespace": namespace, "value": value} for namespace, value in values]

    def add(name, a=None, b=None, **features):
        cases.append({"id": name, "from_event": deepcopy({**left, **(a or {})}),
                      "to_event": deepcopy({**right, **(b or {})}),
                      "expected_features": {**expected, **features}})

    add("request_and_user_count_as_two")
    add("duplicate_ids_count_once", a={"identifiers": shared + shared})
    add("same_value_in_two_namespaces_counts_twice",
        a={"identifiers": ids(("request", "X"), ("account", "X"))},
        b={"identifiers": ids(("request", "X"), ("account", "X"))})
    add("user_only_is_still_counted", a={"identifiers": ids(("user", "U1"))}, shared_id_count=1)
    add("namespace_collision_is_not_shared", a={"identifiers": ids(("request", "X"))},
        b={"identifiers": ids(("account", "X"))}, shared_id_count=0)
    add("identifier_value_is_case_sensitive", b={"identifiers": ids(("request", "r1"), ("user", "U1"))},
        shared_id_count=1, conflicting_id=True)
    add("identifier_namespace_is_case_sensitive", a={"identifiers": ids(("Request", "R1"))},
        shared_id_count=0)
    add("alias_mapping_is_upstream", a={"identifiers": ids(("request_id", "R1"), ("user", "U1"))},
        shared_id_count=1)
    add("missing_ids_on_both_sides", a={"identifiers": []}, b={"identifiers": []}, shared_id_count=0)
    add("request_conflict_despite_shared_user", b={"identifiers": ids(("request", "R2"), ("user", "U1"))},
        shared_id_count=1, conflicting_id=True)
    add("account_conflict_despite_shared_request", a={"identifiers": shared + ids(("account", "A1"))},
        b={"identifiers": shared + ids(("account", "A2"))}, conflicting_id=True)
    add("job_conflict_despite_shared_request", a={"identifiers": shared + ids(("job", "J1"))},
        b={"identifiers": shared + ids(("job", "J2"))}, conflicting_id=True)
    add("redacted_ids_are_not_shared", a={"identifiers": ids(("request", "[REDACTED]"))},
        b={"identifiers": ids(("request", "[REDACTED]"))}, shared_id_count=0)
    add("redacted_vs_visible_is_not_conflict", a={"identifiers": ids(("request", "[REDACTED]"))},
        b={"identifiers": ids(("request", "R1"))}, shared_id_count=0)
    add("partially_redacted_id_is_excluded", a={"identifiers": ids(("request", "prefix-[REDACTED]-suffix"))},
        b={"identifiers": ids(("request", "prefix-[REDACTED]-suffix"))}, shared_id_count=0)
    add("redaction_preserves_shared_account",
        a={"identifiers": ids(("request", "[REDACTED]"), ("account", "A1"))},
        b={"identifiers": ids(("account", "A1"))}, shared_id_count=1)
    add("redaction_does_not_hide_real_conflict", a={"identifiers": shared + ids(("job", "[REDACTED]"))},
        b={"identifiers": ids(("request", "R2"), ("user", "U1"), ("job", "[REDACTED]"))},
        shared_id_count=1, conflicting_id=True)
    add("redacted_user_is_also_excluded", a={"identifiers": ids(("user", "[REDACTED]"))},
        b={"identifiers": ids(("user", "[REDACTED]"))}, shared_id_count=0)
    for name, timestamp, delta in (
        ("skew_boundary", "09:59:55Z", -5.0),
        ("one_microsecond_outside_skew", "09:59:54.999999Z", -5.000001),
        ("same_timestamp", "10:00:00Z", 0.0),
        ("one_microsecond_delta", "10:00:00.000001Z", 0.000001),
        ("window_boundary", "11:00:00Z", 3600.0),
        ("one_microsecond_outside_window", "11:00:00.000001Z", 3600.000001),
    ):
        add(name, b={"occurred_at": "2026-10-28T" + timestamp}, delta_seconds=delta)
    for name, a_text, b_text, similarity in (
        ("empty_text", "", "", 0.0),
        ("empty_vs_nonempty_text", "", "lab", 0.0),
        ("word_set_ignores_duplicates", "account account lab", "account lab", 1.0),
        ("fractional_jaccard", "one two three", "two three", 2 / 3),
        ("nfkc_width_and_digit", "ＬＡＢ ①", "lab 1", 1.0),
        ("unicode_casefold_expansion", "Straße", "STRASSE", 1.0),
        ("vietnamese_composed_and_decomposed", "TA\u0323O", "tạo", 1.0),
        ("underscore_is_a_word_character", "request_id", "request id", 0.0),
        ("redacted_text_only", "[REDACTED]", "[REDACTED]", 0.0),
        ("redacted_text_preserves_visible_words", "lab [REDACTED] ready", "lab done", 1 / 3),
        ("redacted_text_separates_words", "lab[REDACTED]ready", "lab ready", 1.0),
    ):
        add(name, a={"message": a_text}, b={"message": b_text}, text_similarity=similarity)
    account = {"service": "account", "action": "account.created"}
    add("account_to_provision_completed", a=account,
        b={"service": "provision", "action": "provision.completed"})
    add("account_to_provision_failed", a=account,
        b={"service": "provision", "action": "provision.failed", "outcome": "failed"})
    add("skipped_transition", b={"service": "provision", "action": "provision.completed"},
        transition_allowed=False)
    add("reversed_transition", a=account, b={"service": "intake", "action": "request.accepted"},
        transition_allowed=False)
    add("legacy_action_is_not_aliased", a={"action": "request.received"}, transition_allowed=False)
    add("outcome_guard_is_separate_from_features", a={"outcome": "failed"})
    add("unknown_outcome_does_not_change_numeric_features", a={"outcome": "unknown"})
    return {"fixture_version": "sandbox-feature-conformance-2", "policy_version": POLICY_VERSION,
            "feature_version": FEATURE_VERSION, "feature_schema_version": "1",
            "numeric_tolerance": {"delta_seconds": 1e-9, "text_similarity": 1e-12},
            "cases": cases}
