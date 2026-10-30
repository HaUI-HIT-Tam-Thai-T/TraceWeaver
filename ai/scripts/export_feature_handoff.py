# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Export a versioned, self-contained feature reference bundle for BE."""

import hashlib
import json
from pathlib import Path
import platform
import shutil
import unicodedata
import zipfile

from ai.app.contracts import validate
from ai.features.conformance import build_feature_fixtures
from ai.features.sandbox_policy import extract_policy_features


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / ".local" / "ai-be-feature-handoff"


def write_bundle(directory=OUTPUT_DIR):
    fixtures = build_feature_fixtures()
    for case in fixtures["cases"]:
        validate("EventInput", case["from_event"])
        validate("EventInput", case["to_event"])
        actual = extract_policy_features(case["from_event"], case["to_event"])
        validate("PairFeatures", actual)
        if actual != case["expected_features"]:
            raise ValueError(f"Reference does not match independently authored fixture: {case['id']}")
    directory.mkdir(parents=True, exist_ok=True)
    fixture_path = directory / "features-v2.json"
    fixture_path.write_bytes((json.dumps(fixtures, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8"))
    copies = {
        "README.md": ROOT / "ai/FEATURE_HANDOFF.md",
        "reference/ai/features/sandbox_policy.py": ROOT / "ai/features/sandbox_policy.py",
        "reference/ai/features/pair_features.py": ROOT / "ai/features/pair_features.py",
        "check_features.py": ROOT / "ai/scripts/check_feature_fixtures.py",
        "check_features.cjs": ROOT / "ai/scripts/check_feature_fixtures.cjs",
        "LICENSE": ROOT / "LICENSE",
    }
    for target, source in copies.items():
        destination = directory / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
    names = ["features-v2.json", *copies]
    manifest = {key: fixtures[key] for key in ("fixture_version", "policy_version", "feature_version", "feature_schema_version")}
    manifest["case_count"] = len(fixtures["cases"])
    manifest["reference_runtime"] = {"python": platform.python_version(), "unicode": unicodedata.unidata_version}
    manifest["sha256"] = {name: hashlib.sha256((directory / name).read_bytes()).hexdigest() for name in names}
    (directory / "manifest.json").write_bytes((json.dumps(manifest, indent=2) + "\n").encode("utf-8"))
    return manifest


def write_archive(directory, manifest):
    """Archive only declared deliverables, excluding Python caches or unrelated files."""
    destination = directory.parent / "AI_BE_FEATURE_HANDOFF_V2.zip"
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in [*manifest["sha256"], "manifest.json"]:
            archive.write(directory / name, arcname=f"ai-be-feature-handoff/{name}")
    return destination


if __name__ == "__main__":
    manifest = write_bundle()
    print(f"Exported {manifest['case_count']} feature fixtures and Python/Node checkers to {OUTPUT_DIR}")
    print(f"Archive: {write_archive(OUTPUT_DIR, manifest)}")
