# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

from ai.app.contracts import validate
from ai.features.conformance import build_feature_fixtures
from ai.features.sandbox_policy import extract_policy_features
from ai.scripts.export_feature_handoff import write_archive, write_bundle


class FeatureHandoffTests(unittest.TestCase):
    def test_independently_authored_expected_values_match_reference(self):
        fixtures = build_feature_fixtures()
        self.assertEqual(len({case["id"] for case in fixtures["cases"]}), len(fixtures["cases"]))
        for case in fixtures["cases"]:
            with self.subTest(case=case["id"]):
                validate("EventInput", case["from_event"])
                validate("EventInput", case["to_event"])
                validate("PairFeatures", case["expected_features"])
                self.assertEqual(extract_policy_features(case["from_event"], case["to_event"]),
                                 case["expected_features"])

    def test_exported_bundle_is_self_contained_and_hashes_match(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            manifest = write_bundle(path)
            self.assertEqual(manifest["feature_version"], "sandbox-observable-features-2")
            self.assertIn("README.md", manifest["sha256"])
            self.assertIn("sandbox-observable-features-2", (path / "README.md").read_text(encoding="utf-8"))
            for filename, expected in manifest["sha256"].items():
                self.assertEqual(hashlib.sha256((path / filename).read_bytes()).hexdigest(), expected)
            result = subprocess.run([sys.executable, "-I", str(path / "check_features.py")],
                                    cwd=path, text=True, capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("fixtures passed", result.stdout)

    def test_archive_includes_documentation_and_only_declared_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bundle"
            manifest = write_bundle(path)
            (path / "personal-note.txt").write_text("not a deliverable", encoding="utf-8")
            archive_path = write_archive(path, manifest)
            with zipfile.ZipFile(archive_path) as archive:
                expected_names = {f"ai-be-feature-handoff/{name}" for name in [*manifest["sha256"], "manifest.json"]}
                self.assertEqual(set(archive.namelist()), expected_names)
                self.assertIn("ai-be-feature-handoff/README.md", archive.namelist())
                for filename, expected_hash in manifest["sha256"].items():
                    self.assertEqual(hashlib.sha256(archive.read(f"ai-be-feature-handoff/{filename}")).hexdigest(),
                                     expected_hash)

    @unittest.skipUnless(shutil.which("node"), "Node is required to verify the optional BE checker")
    def test_node_checker_detects_type_precision_and_extra_field_mismatches(self):
        script = Path(__file__).resolve().parents[1] / "scripts/check_feature_fixtures.cjs"
        code = """
const assert = require('node:assert/strict');
const {checkFeatures} = require(process.argv[1]);
const expected = {delta_seconds: 0.000001, shared_id_count: 1, text_similarity: 2/3,
                  transition_allowed: true, conflicting_id: false};
const tolerance = {delta_seconds: 1e-9, text_similarity: 1e-12};
checkFeatures({...expected}, expected, tolerance);
for (const bad of [{...expected, delta_seconds: 0}, {...expected, shared_id_count:'1'},
                   {...expected, transition_allowed:1}, {...expected, extra:0},
                   {...expected, text_similarity:NaN}]) {
  assert.throws(() => checkFeatures(bad, expected, tolerance));
}
"""
        result = subprocess.run([shutil.which("node"), "-e", code, str(script)],
                                text=True, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
