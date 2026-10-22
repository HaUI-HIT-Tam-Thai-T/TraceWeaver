// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

// Supported sandbox actions, not a generic parser or a learned process template.
export function sandboxRulePolicy() {
  return { version: 'sandbox-rules-1', strong_namespaces: ['request', 'account', 'job'], clock_skew_ms: 5000,
    transitions: [
      { id: 'intake-account', from: { service: 'intake', action: 'request.accepted' },
        to: { service: 'account', action: 'account.created' }, max_gap_ms: 3600000 },
      ...['completed', 'failed'].map((outcome) => ({ id: `account-provision-${outcome}`,
        from: { service: 'account', action: 'account.created' },
        to: { service: 'provision', action: `provision.${outcome}` }, max_gap_ms: 3600000 })),
    ] };
}

export function missingSteps(events) {
  const stages = [
    ['intake', new Set(['request.accepted'])], ['account', new Set(['account.created'])],
    ['provision', new Set(['provision.completed', 'provision.failed'])],
  ];
  return stages.filter(([service, actions]) => !events.some((event) => event.service === service && actions.has(event.action)))
    .map(([step]) => ({ step, process_template_version: 'sandbox-process-1', label: 'chưa có bằng chứng' }));
}
