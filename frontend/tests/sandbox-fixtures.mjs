import { CID } from "./case-fixtures.mjs";
export const OID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const AID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export function attempt(overrides = {}) {
  return {
    id: AID,
    operation_id: OID,
    number: 1,
    at: "2026-10-30T03:00:00.000Z",
    source_version: 4,
    checker_version: "lab-state-2",
    result: "failed",
    reason: "IMAGE_UNAVAILABLE",
    blockers: ["IMAGE_UNAVAILABLE"],
    checks: [
      { step: "ram", passed: true, reason: "RAM_AVAILABLE" },
      { step: "image", passed: false, reason: "IMAGE_UNAVAILABLE" },
      { step: "account", passed: true, reason: "ACCOUNT_ACTIVE" },
    ],
    required_ram: 8,
    available_ram: 12,
    image_id: "bound-image",
    account_id: "bound-account",
    image_available: false,
    account_active: true,
    ...overrides,
  };
}
export function sandbox(overrides = {}) {
  return {
    case_id: CID,
    case_version: 1,
    observation: {
      source: "lab-sandbox",
      simulated: true,
      checker_version: "lab-state-2",
      source_version: 4,
      request_id: "REQ-FIXTURE",
      result: "failed",
      reason: "IMAGE_UNAVAILABLE",
      conditions: {
        required_ram: 8,
        image_id: "bound-image",
        account_id: "bound-account",
        image_available: false,
        account_active: true,
      },
      attempts: [attempt()],
      attempt: attempt(),
      environment: null,
      delivery: { status: "pending", total: 3, delivered: 1 },
    },
    ...overrides,
  };
}
export function proof(overrides = {}) {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    case_id: CID,
    case_version: 1,
    actor_subject: "fixture-reviewer",
    checked_at: "2026-10-30T03:01:00.000Z",
    observation: { result: "inconclusive", reason: "SOURCE_REQUEST_NOT_FOUND" },
    ...overrides,
  };
}
export function proofs(items = []) {
  return { case_id: CID, case_version: 1, items };
}
export const command = (action = "provision") =>
  action === "provision"
    ? { action, operation_id: OID, expected_case_version: 1, expected_version: 4 }
    : { action: "capacity", ram: 24, expected_case_version: 1, expected_version: 4 };
