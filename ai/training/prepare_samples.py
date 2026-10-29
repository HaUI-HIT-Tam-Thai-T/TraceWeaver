# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Create 24 local review samples. This does not produce training ground truth."""

from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path

from ai.features.pair_features import FEATURE_VERSION, PROCESS_VERSION, extract_pair_features


DATASET_VERSION = "bootstrap-review-1"
ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / ".local" / "ai-bootstrap"
STAGES = {
    "I": ("intake", "request.received", "Lab environment request received"),
    "A": ("account", "account.created", "Lab environment account created"),
    "P": ("provision", "environment.provisioned", "Lab environment provisioned"),
}


def event(stage, offset, identifiers, message=None, outcome="success"):
    service, action, default_message = STAGES[stage]
    timestamp = datetime(2026, 10, 21, 3, tzinfo=timezone.utc) + timedelta(seconds=offset)
    return {
        "source_event_id": "assigned-after-sample-creation",
        "occurred_at": timestamp.isoformat().replace("+00:00", "Z"),
        "service": service,
        "action": action,
        "outcome": outcome,
        "identifiers": [{"namespace": ns, "value": value} for ns, value in identifiers],
        "message": default_message if message is None else message,
        "payload": {},
    }


def build_artifacts():
    """Proposals are isolated from scorer input; every reviewed label starts unset."""
    req = [("request_id", "synthetic-r1")]
    other_req = [("request_id", "synthetic-r2")]
    user = [("user_id", "synthetic-u1")]
    account = [("account_id", "synthetic-a1")]
    other_account = [("account_id", "synthetic-a2")]
    samples = []

    def add(title, left, right, suggestion, reason):
        pair_id = f"p-{len(samples) + 1:02d}"
        left["source_event_id"] = f"synthetic-{pair_id}-from"
        right["source_event_id"] = f"synthetic-{pair_id}-to"
        samples.append((pair_id, title, left, right, suggestion, reason))

    add("Intake sang account", event("I", 0, req), event("A", 20, req), 1,
        "Chung request_id và đúng bước liền kề trong template đề xuất.")
    add("Account sang provision", event("A", 20, req), event("P", 60, req), 1,
        "Chung request_id và đúng bước liền kề.")
    add("Chung request và user", event("I", 0, req + user), event("A", 30, req + user), 1,
        "Có hai định danh chung; user_id chỉ là bằng chứng bổ sung.")
    add("Thiếu user ở một phía", event("I", 0, req + user), event("A", 30, req), 1,
        "Vẫn có request_id chung; thiếu user không phải mâu thuẫn.")
    add("Khoảng cách 20 phút", event("I", 0, req), event("A", 1200, req), 1,
        "Chậm không tự động biến liên kết có định danh đúng thành sai.")
    add("Message rỗng", event("I", 0, req, ""), event("A", 10, req, ""), 1,
        "Không có text evidence nhưng vẫn có request_id chung.")
    add("Cùng timestamp", event("I", 0, req), event("A", 0, req), 1,
        "Timestamp bằng nhau không tự động loại quan hệ theo bước.")
    add("Chung account_id", event("A", 0, account), event("P", 40, account), 1,
        "Định danh account chung là bằng chứng cho hai bước liền kề.")

    add("Khác request, cùng user", event("I", 0, req + user), event("A", 15, other_req + user), 0,
        "Một user có thể gửi nhiều yêu cầu; request_id mâu thuẫn.")
    add("Đảo cạnh account về intake", event("A", 20, req), event("I", 40, req), 0,
        "Sai hướng trong template tạm; cần backend xác nhận template.")
    add("Cùng bước account", event("A", 0, req), event("A", 10, other_req), 0,
        "Không có cạnh account→account và request_id khác nhau.")
    add("Text giống, request khác", event("I", 0, req, "Create lab environment"),
        event("A", 5, other_req, "Create lab environment"), 0,
        "Text giống hoàn toàn không xóa được mâu thuẫn request_id.")
    add("Cùng request, account mâu thuẫn", event("A", 0, req + account),
        event("P", 30, req + other_account), 0,
        "Đề xuất request_id/account_id đơn trị; cần xem có account thay thế hợp lệ không.")
    add("Provision quay về intake", event("P", 0, req), event("I", 5, req), 0,
        "Không có cạnh này trong template tạm.")
    add("Khác cả request lẫn user", event("I", 0, req + user),
        event("A", 5, other_req + [("user_id", "synthetic-u2")]), 0,
        "Cặp gần thời gian nhưng có request_id mâu thuẫn.")
    add("Khác account", event("A", 0, account), event("P", 15, other_account), 0,
        "account_id mâu thuẫn trong quy ước đơn trị đề xuất.")

    add("Không có ID", event("I", 0, []), event("A", 20, []), None,
        "Thời gian và bước chưa đủ để khẳng định cùng yêu cầu.")
    add("Chỉ chung user", event("I", 0, user), event("A", 20, user), None,
        "Không phân biệt được nhiều yêu cầu của cùng user.")
    add("Một phía thiếu request_id", event("I", 0, req), event("A", 20, []), None,
        "Không mâu thuẫn, nhưng thiếu bằng chứng nối cặp.")
    add("Nhảy intake sang provision", event("I", 0, req), event("P", 30, req), None,
        "Cùng hành trình không đồng nghĩa cạnh trực tiếp; cần chốt semantics bước thiếu.")
    add("Timestamp ngược", event("I", 30, req), event("A", 10, req), None,
        "Có thể clock skew; cần quy tắc thời gian trước khi gán nhãn.")
    add("Account báo lỗi, provision thành công", event("A", 0, req, outcome="failed"),
        event("P", 30, req), None,
        "Có thể retry hoặc log thiếu; outcome hiện không nằm trong năm feature.")
    add("Cùng giá trị, khác namespace", event("I", 0, [("request_id", "synthetic-x")]),
        event("A", 20, [("account_id", "synthetic-x")]), None,
        "Không tính là chung ID chỉ vì string bằng nhau.")
    add("Outcome unknown", event("A", 0, req, outcome="unknown"), event("P", 30, req), None,
        "Cần thống nhất quan hệ giữa outcome và transition_allowed.")

    observable = {"dataset_version": DATASET_VERSION, "samples": [
        {"pair_id": pid, "from_event": left, "to_event": right}
        for pid, _, left, right, _, _ in samples
    ]}
    request = {"schema_version": "1", "pairs": [
        {"pair_id": pid, "features": extract_pair_features(left, right)}
        for pid, _, left, right, _, _ in samples
    ]}
    review = {
        "status": "pending_team_review",
        "label_semantics_proposal": "A should connect directly to B, not merely share a journey",
        "process_template_version": PROCESS_VERSION,
        "instructions": "Set label to 1/0 and add reviewer/reason only after team agreement. Null is not 0.",
        "items": [
            {"pair_id": pid, "title": title, "suggested_label": suggestion,
             "label": None, "reviewer": None, "reason": None, "discussion": reason}
            for pid, title, _, _, suggestion, reason in samples
        ],
    }
    artifacts = {
        "observable.json": observable,
        "score-request.json": request,
        "review.json": review,
    }
    manifest = {
        "dataset_version": DATASET_VERSION,
        "feature_version": FEATURE_VERSION,
        "process_template_version": PROCESS_VERSION,
        "schema_version": "1",
        "generation": "fixed_synthetic_examples_no_randomness",
        "pair_count": len(samples),
        "reviewed_label_count": 0,
        "intended_use": "team review and contract smoke input; not a training/test benchmark",
        "source_license": "Apache-2.0; samples generated by TraceWeaver contributors",
        "sha256": {
            name: hashlib.sha256(encode(value).encode("utf-8")).hexdigest()
            for name, value in artifacts.items()
        },
    }
    return {**artifacts, "manifest.json": manifest}


def encode(value):
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def write_artifacts(directory: Path):
    artifacts = build_artifacts()
    if any((directory / name).exists() for name in artifacts):
        raise FileExistsError("Sample files already exist; kept unchanged to preserve review work.")
    directory.mkdir(parents=True, exist_ok=True)
    for name, value in artifacts.items():
        with (directory / name).open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(encode(value))
    return directory


if __name__ == "__main__":
    try:
        write_artifacts(OUTPUT)
    except FileExistsError as error:
        raise SystemExit(str(error)) from error
    print(f"Prepared 24 sample pairs in {OUTPUT}")
    print("8 suggested positive, 8 suggested negative, 8 undecided; all 24 labels await review.")
