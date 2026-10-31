// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

const owner = { fact: 'valid_owner', op: 'true' },
  note = { fact: 'has_note', op: 'true' };
const evidence = { fact: 'evidence_count', op: 'positive' };
const writers = ['operator', 'reviewer'];
export const caseDefinition = {
  key: 'case_handling',
  version: 1,
  initial: 'new',
  states: ['new', 'assigned', 'investigating', 'awaiting_verification', 'closed'],
  transitions: {
    assign: { from: ['new'], to: 'assigned', roles: writers, assign_owner: true, guards: [owner] },
    start: {
      from: ['assigned'],
      to: 'investigating',
      roles: writers,
      owner_or_role: 'reviewer',
      guards: [owner],
    },
    request_verification: {
      from: ['investigating'],
      to: 'awaiting_verification',
      roles: writers,
      owner_or_role: 'reviewer',
      guards: [owner, note, evidence],
    },
    verify_close: {
      from: ['awaiting_verification'],
      to: 'closed',
      roles: ['reviewer'],
      guards: [owner, note, evidence, { fact: 'pending_links', op: 'zero' }],
    },
    verification_failed: {
      from: ['awaiting_verification'],
      to: 'investigating',
      roles: ['reviewer'],
      guards: [owner],
    },
    reopen: {
      from: ['closed'],
      to: 'investigating',
      roles: ['reviewer'],
      guards: [owner, { fact: 'new_reason', op: 'true' }],
    },
  },
};
export const documentReviewDefinition = {
  key: 'document_review',
  version: 1,
  initial: 'draft',
  states: ['draft', 'in_review', 'approved'],
  transitions: {
    submit: { from: ['draft'], to: 'in_review', roles: writers, guards: [] },
    approve: { from: ['in_review'], to: 'approved', roles: ['reviewer'], guards: [] },
    revise: { from: ['in_review'], to: 'draft', roles: ['reviewer'], guards: [] },
  },
};
