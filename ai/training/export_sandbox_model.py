# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Export a verified sandbox experiment for opt-in local API testing.

The default bootstrap artifact is never an output of this command. Training
is repeated from checksum-verified data so a stale evaluation report cannot
silently supply the exported weights.
"""

import argparse
import hashlib
import json
from pathlib import Path

from ai.app.model_scorer import FEATURE_NAMES, FEATURE_SCHEMA_VERSION, ModelScorer
from ai.features.sandbox_policy import FEATURE_VERSION, POLICY_VERSION
from ai.training.evaluate_sandbox import evaluate, load_dataset
from ai.training.sandbox_dataset import DATASET_VERSION, OUTPUT_DIR, ROOT
from ai.training.train import extract_vector, predict_proba, transform


ARTIFACT_DIR = ROOT / ".local" / "ai-artifacts" / "sandbox-features-2"
MODEL_VERSION = "logistic-regression-sandbox-features-2-experiment-1"
MODEL_FILENAME = "model_sandbox_v2.json"


def _json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")


def export_model(dataset_directory=OUTPUT_DIR, output_directory=ARTIFACT_DIR):
    dataset_directory, output_directory = Path(dataset_directory), Path(output_directory)
    # Refuse to overwrite reviewed evidence or any existing artifact bundle.
    if output_directory.exists() and (not output_directory.is_dir() or any(output_directory.iterdir())):
        raise FileExistsError("Choose an empty output directory; existing bundles are preserved")
    # Restrict generated model bundles to local storage, including resolved symlinks.
    local_root = (ROOT / ".local").resolve()
    if local_root not in output_directory.resolve().parents:
        raise ValueError("Experimental model bundles must be written under .local")

    report = evaluate(dataset_directory)
    files, dataset_manifest = load_dataset(dataset_directory)
    if report["dataset_checksums"] != dataset_manifest["sha256"]:
        raise ValueError("Dataset changed during training; rerun with stable input files")
    trained = report["model"]
    metadata = {
        "model_version": MODEL_VERSION,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "policy_version": POLICY_VERSION,
        "feature_version": FEATURE_VERSION,
        "dataset_version": DATASET_VERSION,
        "usage": "local_experiment_not_default",
    }
    model = {
        **metadata,
        "algorithm": "LogisticRegression",
        "training_method": "full_batch_gradient_descent_with_l2",
        "feature_names": list(FEATURE_NAMES),
        "weights": trained["weights"], "bias": trained["bias"], "scaler": trained["scaler"],
        "evaluation_threshold": trained["threshold"],
        "threshold_usage": "offline_evaluation_only_not_edge_confirmation",
    }
    model_bytes = _json_bytes(model)
    manifest = {
        **metadata,
        "model_file": MODEL_FILENAME,
        "sha256": hashlib.sha256(model_bytes).hexdigest(),
        "dataset_checksums": report["dataset_checksums"],
        "evaluation_sha256": hashlib.sha256(_json_bytes(report)).hexdigest(),
        "scaler_fit_split": trained["scaler_fit_split"],
        "threshold_selection_split": trained["threshold_selection_split"],
        "metrics_summary": report["raw_scores"]["model"],
        "license": "Apache-2.0",
    }
    test = files["test.json"]
    group = test["group_ids"][0]
    rows = [row for row in test["pairs"] + test["unresolved"] if row["group_id"] == group]
    request = {"schema_version": FEATURE_SCHEMA_VERSION, "pairs": [
        {"pair_id": row["pair_id"], "features": row["features"]} for row in rows
    ]}
    scores = predict_proba(transform([extract_vector(row["features"]) for row in rows], trained["scaler"]),
                          trained["weights"], trained["bias"])
    expected = {
        "model_version": MODEL_VERSION, "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "predictions": [{"pair_id": row["pair_id"], "score": round(score, 6)}
                        for row, score in zip(rows, scores)],
    }

    output_directory.mkdir(parents=True, exist_ok=True)
    model_path = output_directory / MODEL_FILENAME
    model_path.write_bytes(model_bytes)
    (output_directory / "manifest.json").write_bytes(_json_bytes(manifest))
    scorer = ModelScorer(model_path)
    if not scorer.ready or scorer.score(request) != expected:
        raise ValueError("Exported runtime model does not match offline predictions")
    for filename, value in (("evaluation.json", report), ("score-request.json", request),
                            ("expected-response.json", expected)):
        (output_directory / filename).write_bytes(_json_bytes(value))
    (output_directory / "LICENSE").write_bytes((ROOT / "LICENSE").read_bytes())
    (output_directory / "README.md").write_text(
        "# Model sandbox thử nghiệm\n\n"
        f"- Model: `{MODEL_VERSION}`.\n"
        f"- Policy: `{POLICY_VERSION}`; feature: `{FEATURE_VERSION}`; schema API: `1`.\n"
        "- `model_sandbox_v2.json`: weights, bias và scaler để API tính score.\n"
        "- `manifest.json`: checksum model, dataset nguồn, phiên bản và chỉ số đánh giá.\n"
        "- `evaluation.json`: báo cáo train/eval vừa chạy lại từ dataset đã kiểm checksum.\n"
        "- `score-request.json` và `expected-response.json`: 23 cặp mẫu và score kỳ vọng, "
        "không có oracle/label trong request.\n\n"
        "Đây là model thử nghiệm trên dữ liệu synthetic, chưa được chọn làm model mặc định. "
        "Score chưa được hiệu chuẩn thành xác suất đúng; threshold chỉ dùng đánh giá offline. "
        "Score cao không xác nhận cạnh và không thay thế guard/unresolved của backend.\n\n"
        "Để chọn model này, đặt `SCORER_MODEL_PATH` thành đường dẫn tuyệt đối đến "
        "`model_sandbox_v2.json` trước khi chạy `python -m ai.app` từ thư mục gốc dự án. "
        "API còn cần `SCORER_SERVICE_SECRET` tối thiểu 32 ký tự không có khoảng trắng. "
        "Chỉ chạy thử trên `127.0.0.1`.\n\n"
        "Kiểm tra tự động luồng export → config → API HTTP từ thư mục gốc:\n\n"
        "```powershell\n.\\.venv\\Scripts\\python.exe -m unittest ai.tests.test_sandbox_model -v\n```\n\n"
        "Các test tạo model tạm riêng; kết quả kiểm tra bundle này được lưu ở "
        "`api-verification.json` nếu đã chạy kiểm chứng local.\n",
        encoding="utf-8", newline="\n",
    )
    return model_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--output-dir", type=Path, default=ARTIFACT_DIR)
    arguments = parser.parse_args()
    path = export_model(arguments.dataset_dir, arguments.output_dir)
    print(json.dumps({"model_path": str(path), "model_version": MODEL_VERSION,
                      "feature_version": FEATURE_VERSION, "default_model_changed": False}, indent=2))


if __name__ == "__main__":
    main()
