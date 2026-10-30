# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Check the bundled Python reference using only the standard library."""

import json
import math
from pathlib import Path
import sys


def main():
    directory = Path(__file__).resolve().parent
    sys.path.insert(0, str(directory / "reference"))
    from ai.features.sandbox_policy import FEATURE_VERSION, POLICY_VERSION, extract_policy_features

    fixtures = json.loads((directory / "features-v2.json").read_text(encoding="utf-8"))
    if (fixtures["feature_version"], fixtures["policy_version"]) != (FEATURE_VERSION, POLICY_VERSION):
        raise ValueError("Reference and fixtures have incompatible versions")
    for case in fixtures["cases"]:
        actual = extract_policy_features(case["from_event"], case["to_event"])
        expected = case["expected_features"]
        if set(actual) != set(expected):
            raise ValueError(f"{case['id']}: incorrect feature keys")
        for key, value in expected.items():
            result = actual[key]
            if type(value) is bool or type(value) is int:
                valid = type(result) is type(value) and result == value
            else:
                valid = (type(result) in (int, float) and math.isfinite(result)
                         and abs(result - value) <= fixtures["numeric_tolerance"].get(key, 0))
            if not valid:
                raise ValueError(f"{case['id']}: incorrect {key}")
    print(f"Python reference: {len(fixtures['cases'])}/{len(fixtures['cases'])} fixtures passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
