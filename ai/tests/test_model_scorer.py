# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ai.app.api import create_app
from ai.app.config import Config, read_config
from ai.app.model_scorer import ModelScorer
from ai.tests.http_server import serve

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / 'artifacts/sandbox-v2/model_sandbox_v2.json'
FIXTURES = Path(__file__).parent / 'fixtures/scorer-v2'
VERSION = 'logistic-regression-sandbox-features-2-experiment-1'


class TrainedModelTests(unittest.TestCase):
    def test_imported_model_and_twenty_three_predictions_match_handoff(self):
        self.assertEqual(hashlib.sha256(ARTIFACT.read_bytes()).hexdigest(),
                         'f06fc43f8784cb93e1d4b52b230e8ca7ec4fc846d9cd068a97a75f6145e76420')
        model = ModelScorer(ARTIFACT)
        self.assertTrue(model.ready)
        self.assertEqual(model.model_version, VERSION)
        request = json.loads((FIXTURES / 'score-request.json').read_text())
        expected = json.loads((FIXTURES / 'expected-response.json').read_text())
        self.assertEqual(len(request['pairs']), 23)
        self.assertEqual(model.score(request), expected)

    def test_missing_corrupted_and_structurally_invalid_artifacts_fail_closed(self):
        with TemporaryDirectory() as directory:
            target = Path(directory) / ARTIFACT.name
            manifest_path = target.with_name('manifest.json')
            self.assertFalse(ModelScorer(target).ready)
            original = json.loads(ARTIFACT.read_text())
            original_manifest = json.loads(ARTIFACT.with_name('manifest.json').read_text())
            for field, value in [('weights', [0]), ('weights', [float('inf')] * 5),
                                 ('bias', True), ('feature_schema_version', '2'),
                                 ('feature_names', list(reversed(original['feature_names']))),
                                 ('scaler', {'mean': [0] * 5, 'std': [0] * 5})]:
                with self.subTest(field=field, value=value):
                    model = deepcopy(original)
                    model[field] = value
                    data = json.dumps(model).encode()
                    target.write_bytes(data)
                    manifest = {**original_manifest, 'sha256': hashlib.sha256(data).hexdigest()}
                    manifest_path.write_text(json.dumps(manifest))
                    self.assertFalse(ModelScorer(target).ready)
            target.write_bytes(ARTIFACT.read_bytes() + b' ')
            manifest_path.write_text(json.dumps(original_manifest))
            self.assertFalse(ModelScorer(target).ready)

    def test_model_is_explicit_and_default_remains_unavailable(self):
        secret = 'test-only-model-secret-with-32-characters'
        self.assertEqual(read_config({'SCORER_SERVICE_SECRET': secret}).model_path, '')
        for path in ('', str(ARTIFACT)):
            config = Config(service_secret=secret, mode='model', model_path=path)
            with serve(create_app(config)) as address:
                request = Request(address + '/health/ready')
                if not path:
                    with self.assertRaises(HTTPError) as error:
                        urlopen(request, timeout=5)
                    self.assertEqual(error.exception.code, 503)
                else:
                    payload = (FIXTURES / 'score-request.json').read_bytes()
                    request = Request(address + '/internal/v1/score-pairs', data=payload,
                                      headers={'Authorization': 'Bearer ' + secret, 'Content-Type': 'application/json'})
                    with urlopen(request, timeout=5) as response:
                        self.assertEqual(response.status, 200)
                        self.assertEqual(response.headers['X-Scorer-Method'], 'model')
                        self.assertEqual(json.loads(response.read()), json.loads((FIXTURES / 'expected-response.json').read_text()))
