# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Start a temporary trained model service, send sample pairs, and measure performance."""

import json
import math
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

from ai.app.contracts import validate_response
from ai.training.prepare_samples import build_artifacts


WARMUP_REQUESTS = 3
MEASURED_REQUESTS = 20
BENCHMARK_BATCH_SIZES = (24, 100)


def make_benchmark_request(template: dict, batch_size: int) -> dict:
    """Repeat fixture features into a contract-valid request with unique pair IDs."""
    source_pairs = template.get("pairs")
    if not isinstance(source_pairs, list) or not source_pairs:
        raise ValueError("Benchmark template must contain at least one pair")
    if not isinstance(batch_size, int) or not 1 <= batch_size <= 100:
        raise ValueError("Benchmark batch size must be between 1 and 100")

    return {
        "schema_version": template["schema_version"],
        "pairs": [
            {
                "pair_id": f"benchmark-{index + 1:03d}",
                "features": dict(source_pairs[index % len(source_pairs)]["features"]),
            }
            for index in range(batch_size)
        ],
    }


def percentile_ms(durations: list[float], percentile: int) -> float:
    """Compute a nearest-rank percentile from completed request durations."""
    if not durations:
        raise ValueError("Cannot calculate a percentile without measurements")
    if not 0 < percentile <= 100:
        raise ValueError("Percentile must be between 1 and 100")
    ordered = sorted(float(duration) for duration in durations)
    return ordered[math.ceil((percentile / 100) * len(ordered)) - 1]


def score_request(address: str, secret: str, payload: dict) -> tuple[dict, str, float]:
    request = Request(
        address + "/internal/v1/score-pairs",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
    )
    t_start = time.perf_counter()
    with urlopen(request, timeout=5) as response:
        body = response.read()
        scorer_method = response.headers.get("X-Scorer-Method")
    duration_ms = (time.perf_counter() - t_start) * 1000.0
    result = json.loads(body.decode("utf-8"))
    validate_response(payload, result)
    return result, scorer_method, duration_ms


def benchmark(address: str, secret: str, template: dict, batch_size: int) -> dict:
    payload = make_benchmark_request(template, batch_size)
    for _ in range(WARMUP_REQUESTS):
        _, scorer_method, _ = score_request(address, secret, payload)
        if scorer_method != "model":
            raise RuntimeError(f"Expected X-Scorer-Method: model, got {scorer_method}")

    durations = []
    for _ in range(MEASURED_REQUESTS):
        _, scorer_method, duration_ms = score_request(address, secret, payload)
        if scorer_method != "model":
            raise RuntimeError(f"Expected X-Scorer-Method: model, got {scorer_method}")
        durations.append(duration_ms)

    return {
        "batch_size": batch_size,
        "warmup_requests": WARMUP_REQUESTS,
        "measured_requests": MEASURED_REQUESTS,
        "p95_ms": percentile_ms(durations, 95),
        "min_ms": min(durations),
        "max_ms": max(durations),
    }


def main():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    secret = secrets.token_hex(32)
    root = Path(__file__).resolve().parents[2]
    model_path = root / "ai" / "artifacts" / "model_v1.json"

    if not model_path.is_file():
        raise FileNotFoundError(f"Model artifact not found at {model_path}. Run ai.training.train first.")

    env = {
        **os.environ,
        "SCORER_SERVICE_SECRET": secret,
        "SCORER_MODE": "model",
        "APP_ENV": "development",
        "SCORER_HOST": "127.0.0.1",
        "SCORER_PORT": str(port),
        "SCORER_MODEL_PATH": str(model_path),
    }

    child = subprocess.Popen([sys.executable, "-m", "ai.app"], cwd=root, env=env,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    address = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 10
        while True:
            if child.poll() is not None:
                raise RuntimeError("Model scorer exited before becoming ready")
            try:
                with urlopen(address + "/health/ready", timeout=1) as response:
                    if response.status == 200:
                        break
            except (URLError, TimeoutError):
                pass
            if time.monotonic() >= deadline:
                raise RuntimeError("Model scorer startup timed out")
            time.sleep(0.05)

        payload = build_artifacts()["score-request.json"]
        result, scorer_method, _ = score_request(address, secret, payload)

        if scorer_method != "model":
            raise RuntimeError(f"Expected X-Scorer-Method: model, got {scorer_method}")
        if result["model_version"] != "logistic-regression-v1":
            raise RuntimeError(f"Unexpected model version: {result['model_version']}")

        benchmarks = [
            benchmark(address, secret, payload, batch_size)
            for batch_size in BENCHMARK_BATCH_SIZES
        ]

        print("=" * 60)
        print("Trained Model Scorer Smoke Test: PASSED")
        print(f"Server Method: {scorer_method}")
        print(f"Model Version: {result['model_version']}")
        print("Bootstrap demo scores are uncalibrated; they do not confirm graph edges.")
        print("Loopback benchmark: full response body read, 3 warm-ups, 20 measured requests")
        for stats in benchmarks:
            print(
                f"  Batch {stats['batch_size']:>3}: p95={stats['p95_ms']:.2f} ms "
                f"(min={stats['min_ms']:.2f}, max={stats['max_ms']:.2f}; target < 1000 ms)"
            )
        print("-" * 60)
        scores = {item["pair_id"]: item["score"] for item in result["predictions"]}
        print("Sample predictions from trained Model:")
        print(f"  p-01 (Intake -> Account)                  : {scores['p-01']}")
        print(f"  p-09 (Different request, same user)       : {scores['p-09']}")
        print(f"  p-13 (Conflicting account_id)             : {scores['p-13']}")
        print(f"  p-20 (Intake -> Provision, skipped step)  : {scores['p-20']}")
        print("=" * 60)

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
