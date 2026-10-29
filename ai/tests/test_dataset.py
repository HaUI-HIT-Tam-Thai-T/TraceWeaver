# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

from copy import deepcopy
import unittest

from ai.training.dataset import DatasetError, require_trainable, reviewed_rows
from ai.training.prepare_samples import build_artifacts


class DatasetTests(unittest.TestCase):
    def setUp(self):
        artifacts = build_artifacts()
        self.request = artifacts["score-request.json"]
        self.review = artifacts["review.json"]

    def approve(self, index, label):
        self.review["items"][index].update(label=label, reviewer="synthetic-reviewer", reason="Test fixture review")

    def test_all_null_means_no_training_rows_not_twenty_four_negative_labels(self):
        result = reviewed_rows(self.request, self.review)
        self.assertEqual(result.rows, ())
        self.assertEqual(result.skipped_unlabeled, 24)
        with self.assertRaisesRegex(DatasetError, "No reviewed labels"):
            require_trainable(result)

    def test_use_only_reviewed_labels_and_do_not_change_suggestions(self):
        self.approve(0, 0)  # Deliberately differs from suggested_label=1.
        self.approve(1, 1)
        original = deepcopy(self.review)
        result = require_trainable(reviewed_rows(self.request, self.review))
        self.assertEqual([row["label"] for row in result.rows], [0, 1])
        self.assertEqual(result.skipped_unlabeled, 22)
        self.assertEqual(self.review, original)
        self.assertEqual(set(result.rows[0]), {"pair_id", "features", "label"})

    def test_missing_class_cannot_start_training(self):
        self.approve(0, 0)
        with self.assertRaisesRegex(DatasetError, "both classes"):
            require_trainable(reviewed_rows(self.request, self.review))

    def test_label_types_and_review_provenance_are_checked(self):
        for invalid in (True, False, 0.0, 1.0, "0", "1", 2, -1, [], {}):
            self.approve(0, invalid)
            with self.subTest(invalid=invalid), self.assertRaises(DatasetError):
                reviewed_rows(self.request, self.review)
        self.approve(0, 1)
        self.review["items"][0]["reason"] = " "
        with self.assertRaisesRegex(DatasetError, "reviewer and reason"):
            reviewed_rows(self.request, self.review)

    def test_stale_missing_duplicate_or_unknown_review_ids_fail(self):
        reviews = []
        missing = deepcopy(self.review)
        missing["items"].pop()
        reviews.append(missing)
        unknown = deepcopy(self.review)
        unknown["items"][0]["pair_id"] = "unknown"
        reviews.append(unknown)
        duplicate = deepcopy(self.review)
        duplicate["items"][1] = duplicate["items"][0]
        reviews.append(duplicate)
        missing_label = deepcopy(self.review)
        del missing_label["items"][0]["label"]
        reviews.append(missing_label)
        for review in reviews:
            with self.subTest(review=repr(review)[:50]), self.assertRaises(DatasetError):
                reviewed_rows(self.request, review)
