export const WID = "10000000-0000-4000-8000-000000000001";
export const SID = "30000000-0000-4000-8000-000000000001";
export const EID = "11111111-1111-4111-8111-111111111111";
export const EID2 = "22222222-2222-4222-8222-222222222222";
export function event(id = EID) {
  return {
    event_id: id,
    source_id: SID,
    source_event_id: `source-${id}`,
    occurred_at: "2026-10-26T06:00:00.000001Z",
    received_at: "2026-10-26T06:00:01Z",
    service: "intake",
    action: "request.accepted",
    outcome: "success",
    identifiers: [{ namespace: "request", value: "example" }],
    message: "<script>unsafe</script>",
    payload_redacted: { safe: "<img src=x onerror=bad()>" },
    parser_version: "v1",
    provenance: {
      batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      locator: "events[1]",
      sha256_redacted: "a".repeat(64),
    },
  };
}
export function scope(canWrite = true) {
  return { subject: "user-a", workspaceId: WID, canWrite, accessKey: {} };
}
