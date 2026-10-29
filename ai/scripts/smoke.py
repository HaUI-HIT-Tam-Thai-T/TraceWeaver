# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Start a temporary baseline service, send sample pairs, and stop it."""

import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

from ai.app.baseline import BASELINE_VERSION
from ai.app.contracts import validate_response
from ai.training.prepare_samples import build_artifacts


def main():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    secret = secrets.token_hex(32)
    env = {**os.environ, "SCORER_SERVICE_SECRET": secret, "SCORER_MODE": "baseline",
           "APP_ENV": "test", "SCORER_HOST": "127.0.0.1", "SCORER_PORT": str(port)}
    root = Path(__file__).resolve().parents[2]
    child = subprocess.Popen([sys.executable, "-m", "ai.app"], cwd=root, env=env,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    address = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 10
        while True:
            if child.poll() is not None:
                raise RuntimeError("Scorer exited before becoming live")
            try:
                with urlopen(address + "/health/ready", timeout=1) as response:
                    if response.status == 200:
                        break
            except (URLError, TimeoutError):
                pass
            if time.monotonic() >= deadline:
                raise RuntimeError("Scorer startup timed out")
            time.sleep(0.05)
        payload = build_artifacts()["score-request.json"]
        request = Request(address + "/internal/v1/score-pairs", data=json.dumps(payload).encode(),
                          headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"})
        with urlopen(request, timeout=5) as response:
            result = json.loads(response.read())
            if response.headers.get("X-Scorer-Method") != "rule":
                raise RuntimeError("Unexpected scorer method")
        validate_response(payload, result)
        if result["model_version"] != BASELINE_VERSION:
            raise RuntimeError("Unexpected baseline version")
        print(f"Baseline HTTP smoke passed: {len(result['predictions'])} pairs; method=rule.")
        scores = {item["pair_id"]: item["score"] for item in result["predictions"]}
        print("Example scores (heuristics, not measured probabilities): " +
              json.dumps({key: scores[key] for key in ("p-01", "p-09", "p-17")}))
    finally:
        if child.poll() is None:
            child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=5)


if __name__ == "__main__":
    main()
