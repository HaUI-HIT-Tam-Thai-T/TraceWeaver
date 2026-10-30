# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Copied into the portable runtime bundle as run_scorer.py; no training needed."""

import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
from threading import Thread
import time
from urllib.request import Request, urlopen


BUNDLE_VERSION = "ai-be-runtime-2"
MODEL_VERSION = "logistic-regression-sandbox-features-2-experiment-1"
FEATURE_VERSION = "sandbox-observable-features-2"
POLICY_VERSION = "sandbox-rules-1"
MODEL_FILE = "model/model_sandbox_v2.json"


def verify_bundle(directory):
    directory = Path(directory).resolve()
    manifest = json.loads((directory / "bundle-manifest.json").read_text(encoding="utf-8"))
    expected = {"bundle_version": BUNDLE_VERSION, "model_version": MODEL_VERSION,
                "feature_version": FEATURE_VERSION, "policy_version": POLICY_VERSION,
                "feature_schema_version": "1", "model_file": MODEL_FILE}
    if any(manifest.get(key) != value for key, value in expected.items()):
        raise ValueError("Bundle version/model/feature metadata is incompatible")
    required = {MODEL_FILE, "model/manifest.json", "run_scorer.py", "check_http.cjs",
                "samples/score-request.json", "samples/expected-response.json",
                "features/features-v2.json", "features/check_features.py", "ai/app/model_scorer.py",
                "backend/contracts/schemas/domain.schema.json", "ai/requirements.txt"}
    hashes = manifest.get("sha256")
    if not isinstance(hashes, dict) or not required <= hashes.keys():
        raise ValueError("Bundle is missing declared runtime files")
    for name, expected_hash in hashes.items():
        target = (directory / name).resolve()
        if directory not in target.parents or not target.is_file():
            raise ValueError("Bundle contains an invalid or missing file path")
        if hashlib.sha256(target.read_bytes()).hexdigest() != expected_hash:
            raise ValueError(f"Bundle checksum mismatch: {name}")
    model = json.loads((directory / MODEL_FILE).read_text(encoding="utf-8"))
    model_manifest = json.loads((directory / "model/manifest.json").read_text(encoding="utf-8"))
    for value in (model, model_manifest):
        if any(value.get(key) != expected[key] for key in
               ("model_version", "feature_version", "policy_version", "feature_schema_version")):
            raise ValueError("Model provenance does not match the bundle")
    return manifest


def make_app(directory, secret, port):
    sys.path.insert(0, str(directory))
    from ai.app.api import create_app
    from ai.app.config import Config
    from ai.app.model_scorer import ModelScorer

    model_path = directory / MODEL_FILE
    scorer = ModelScorer(model_path)
    if not scorer.ready or scorer.model_version != MODEL_VERSION:
        raise ValueError("Trained model failed loader verification")
    config = Config(service_secret=secret, mode="model", app_env="development",
                    host="127.0.0.1", port=port or 8000, model_path=str(model_path))
    return create_app(config, scorer=scorer)


@contextmanager
def temporary_server(app):
    import uvicorn

    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(128)
        server = uvicorn.Server(uvicorn.Config(app, log_level="critical", access_log=False,
                                               server_header=False, lifespan="off"))
        thread = Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 10
            while not server.started:
                if not thread.is_alive() or time.monotonic() >= deadline:
                    raise RuntimeError("Scorer startup timed out")
                time.sleep(0.01)
            yield f"http://127.0.0.1:{listener.getsockname()[1]}"
        finally:
            server.should_exit = True
            thread.join(timeout=6)
            if thread.is_alive():
                raise RuntimeError("Temporary scorer did not stop")


def check(directory, manifest):
    secret = secrets.token_hex(32)
    app = make_app(directory, secret, 0)
    with temporary_server(app) as address:
        with urlopen(address + "/health/ready", timeout=5) as response:
            if response.status != 200:
                raise RuntimeError("Scorer is not ready")
        request = Request(address + "/internal/v1/score-pairs", method="POST",
                          data=(directory / "samples/score-request.json").read_bytes(),
                          headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"})
        with urlopen(request, timeout=5) as response:
            status = response.status
            method = response.headers.get("X-Scorer-Method")
            actual = json.loads(response.read())
        expected = json.loads((directory / "samples/expected-response.json").read_text(encoding="utf-8"))
        if status != 200 or method != "model" or actual != expected or actual["model_version"] != MODEL_VERSION:
            raise ValueError("HTTP predictions do not match offline model scores")
        node_result = {"status": "not_run_node_unavailable"}
        if node := shutil.which("node"):
            result = subprocess.run([node, str(directory / "check_http.cjs")], cwd=directory,
                                    env={**os.environ, "SCORER_INTERNAL_URL": address, "SCORER_SERVICE_SECRET": secret},
                                    capture_output=True, text=True, timeout=15,
                                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            if result.returncode:
                raise RuntimeError("Node HTTP probe failed")
            node_result = json.loads(result.stdout)
    fixtures = subprocess.run([sys.executable, "-I", str(directory / "features/check_features.py")],
                              cwd=directory, capture_output=True, text=True, timeout=15,
                              creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if fixtures.returncode:
        raise RuntimeError("Bundled Python feature reference failed")
    return {"status": "passed", "model_version": MODEL_VERSION, "feature_version": FEATURE_VERSION,
            "policy_version": POLICY_VERSION, "feature_schema_version": "1",
            "model_sha256": manifest["sha256"][MODEL_FILE],
            "bundle_manifest_sha256": hashlib.sha256((directory / "bundle-manifest.json").read_bytes()).hexdigest(),
            "http_status": 200, "method": method, "checked_pairs": len(actual["predictions"]),
            "matches_offline_scores": True, "node_http": node_result,
            "python_fixtures": fixtures.stdout.strip(), "training_required": False,
            "scope": "portable_scorer_and_node_probe_not_backend_adapter_or_guard_acceptance"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--check", action="store_true", help="Check integrity, real HTTP and fixtures; stop automatically")
    modes.add_argument("--serve", action="store_true", help="Serve the packaged trained v2 model on loopback")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--report", type=Path, help="Optional JSON verification output for --check")
    arguments = parser.parse_args()
    directory = Path(__file__).resolve().parent
    try:
        manifest = verify_bundle(directory)
        if arguments.check:
            proof = check(directory, manifest)
            if arguments.report:
                arguments.report.write_bytes((json.dumps(proof, indent=2) + "\n").encode("utf-8"))
            print(json.dumps(proof, indent=2))
        else:
            if not 1 <= arguments.port <= 65535:
                raise ValueError("Port must be in 1..65535")
            app = make_app(directory, os.environ.get("SCORER_SERVICE_SECRET", ""), arguments.port)
            import uvicorn
            print(f"Serving trained model {MODEL_VERSION} at http://127.0.0.1:{arguments.port}", flush=True)
            uvicorn.run(app, host="127.0.0.1", port=arguments.port, access_log=False, server_header=False)
    except (OSError, ValueError, RuntimeError, ImportError, subprocess.SubprocessError) as error:
        print(f"Scorer handoff failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
