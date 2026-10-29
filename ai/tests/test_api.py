# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

from copy import deepcopy
import json
import secrets
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ai.app.api import MAX_BODY_BYTES, create_app
from ai.app.baseline import BASELINE_VERSION, BaselineScorer
from ai.app.config import Config
from ai.app.contracts import validate
from ai.tests.http_server import serve
from ai.training.prepare_samples import build_artifacts


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.secret = secrets.token_hex(32)
        cls.config = Config(service_secret=cls.secret, mode="baseline", app_env="test")
        cls.context = serve(create_app(cls.config))
        cls.address = cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)

    def setUp(self):
        self.payload = build_artifacts()["score-request.json"]

    def request(self, payload=None, *, raw=None, path="/internal/v1/score-pairs",
                method="POST", headers=None, address=None):
        if raw is None and method == "POST":
            raw = json.dumps(self.payload if payload is None else payload).encode()
        request_headers = {"Authorization": f"Bearer {self.secret}", "Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
        request = Request((address or self.address) + path, data=raw, method=method, headers=request_headers)
        try:
            response = urlopen(request, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, json.loads(response.read())

    def assert_error(self, result, status, code):
        actual, headers, body = result
        self.assertEqual(actual, status)
        validate("Error", body)
        self.assertEqual(body["error"]["code"], code)
        self.assertEqual(body["request_id"], headers["X-Request-ID"])
        self.assertNotIn(self.secret, json.dumps(body))

    def test_success_for_one_and_one_hundred_pairs(self):
        for size in (1, 100):
            payload = {"schema_version": "1", "pairs": [
                {"pair_id": f"p-{index}", "features": deepcopy(self.payload["pairs"][0]["features"])}
                for index in range(size)
            ]}
            status, headers, response = self.request(payload)
            self.assertEqual(status, 200)
            validate("ScoreResponse", response)
            self.assertEqual(len(response["predictions"]), size)
            self.assertEqual(response["model_version"], BASELINE_VERSION)
            self.assertEqual(headers["X-Scorer-Method"], "rule")
            self.assertEqual(headers["Cache-Control"], "no-store")

    def test_authentication_happens_before_body_parsing(self):
        for credential in ("", "Bearer wrong", "Basic not-a-service-token"):
            self.assert_error(self.request(raw=b'{"secret":"must-not-echo"',
                              headers={"Authorization": credential}), 401, "UNAUTHORIZED")

    def test_errors_do_not_echo_payload_or_client_request_id(self):
        result = self.request(raw=b'{"password":"private-payload"', headers={"X-Request-ID": "client-id"})
        self.assert_error(result, 400, "INVALID_JSON")
        self.assertNotIn("private-payload", json.dumps(result[2]))
        self.assertNotEqual(result[1]["X-Request-ID"], "client-id")

    def test_invalid_batches_and_fields_are_rejected_as_whole_batch(self):
        invalid = [[], {"schema_version": "1", "pairs": []},
                   {"schema_version": "1", "pairs": self.payload["pairs"] * 5}]
        duplicate = deepcopy(self.payload)
        duplicate["pairs"].append(duplicate["pairs"][0])
        invalid.append(duplicate)
        for path, value in (("schema_version", "2"), ("unknown", True)):
            bad = deepcopy(self.payload)
            bad[path] = value
            invalid.append(bad)
        for field, value in (("delta_seconds", True), ("delta_seconds", None),
                             ("shared_id_count", -1), ("text_similarity", 1.1),
                             ("transition_allowed", "true"), ("label", 1)):
            bad = deepcopy(self.payload)
            bad["pairs"][0]["features"][field] = value
            invalid.append(bad)
        for payload in invalid:
            with self.subTest(payload=repr(payload)[:60]):
                self.assert_error(self.request(payload), 422, "INVALID_SCORE_REQUEST")

    def test_malformed_nonfinite_and_duplicate_key_json(self):
        for raw in (b"null", b'{"schema_version":"1","pairs":[],"pairs":[]}',
                    b'{"score": NaN}', b'{"score": Infinity}'):
            expected = 422 if raw == b"null" else 400
            code = "INVALID_SCORE_REQUEST" if expected == 422 else "INVALID_JSON"
            self.assert_error(self.request(raw=raw), expected, code)
        raw = json.dumps(self.payload).replace('"delta_seconds": 20.0', '"delta_seconds": 1e400').encode()
        self.assert_error(self.request(raw=raw), 422, "INVALID_SCORE_REQUEST")

    def test_body_and_encoding_limits(self):
        self.assert_error(self.request(raw=b"x" * (MAX_BODY_BYTES + 1)), 413, "PAYLOAD_TOO_LARGE")
        self.assert_error(self.request(headers={"Content-Type": "text/plain"}), 415, "UNSUPPORTED_MEDIA_TYPE")
        self.assert_error(self.request(headers={"Content-Type": "application/json;charset=latin1"}),
                          415, "UNSUPPORTED_MEDIA_TYPE")
        self.assert_error(self.request(headers={"Content-Encoding": "gzip"}), 415, "UNSUPPORTED_ENCODING")

    def test_deeply_nested_payload_is_a_client_error_not_an_internal_error(self):
        raw = ('{"unknown":' + '[' * 400 + '0' + ']' * 400 + '}').encode()
        self.assert_error(self.request(raw=raw), 422, "INVALID_SCORE_REQUEST")

    def test_liveness_readiness_and_unknown_routes(self):
        self.assertEqual(self.request(path="/health/live", method="GET")[2], {"status": "ok"})
        self.assertEqual(self.request(path="/health/ready", method="GET")[0], 200)
        self.assert_error(self.request(path="/not-implemented", method="GET"), 404, "NOT_FOUND")
        self.assert_error(self.request(method="GET"), 405, "METHOD_NOT_ALLOWED")

    def test_model_mode_does_not_silently_fall_back_to_baseline(self):
        config = Config(service_secret=self.secret, mode="model", app_env="test")
        with serve(create_app(config)) as address:
            self.assertEqual(self.request(path="/health/live", method="GET", address=address)[0], 200)
            self.assert_error(self.request(path="/health/ready", method="GET", address=address),
                              503, "SCORER_UNAVAILABLE")
            self.assert_error(self.request(address=address), 503, "SCORER_UNAVAILABLE")

    def test_broken_engine_and_invalid_output_are_sanitized(self):
        class Broken(BaselineScorer):
            def score(self, request):
                raise RuntimeError("private-model-details")

        class WrongIDs(BaselineScorer):
            def score(self, request):
                response = super().score(request)
                response["predictions"][0]["pair_id"] = "wrong"
                return response

        for engine in (Broken(), WrongIDs()):
            with self.subTest(engine=type(engine).__name__), serve(create_app(self.config, engine)) as address:
                result = self.request(address=address)
                self.assert_error(result, 503, "SCORER_UNAVAILABLE")
                self.assertNotIn("private-model-details", json.dumps(result[2]))
