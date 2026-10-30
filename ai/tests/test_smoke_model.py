# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

import unittest

from ai.app.contracts import validate_request
from ai.scripts.smoke_model import make_benchmark_request, percentile_ms
from ai.training.prepare_samples import build_artifacts


class ModelSmokeBenchmarkTests(unittest.TestCase):
    def test_benchmark_request_has_exactly_one_hundred_unique_pair_ids(self):
        request = make_benchmark_request(build_artifacts()["score-request.json"], 100)

        validate_request(request)
        self.assertEqual(len(request["pairs"]), 100)
        self.assertEqual(len({pair["pair_id"] for pair in request["pairs"]}), 100)

    def test_p95_uses_nearest_rank_from_all_completed_requests(self):
        durations = [float(value) for value in range(1, 21)]

        self.assertEqual(percentile_ms(durations, 95), 19.0)
        with self.assertRaises(ValueError):
            percentile_ms([], 95)


if __name__ == "__main__":
    unittest.main()
