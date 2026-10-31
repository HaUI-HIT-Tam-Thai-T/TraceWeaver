// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

// Compatibility entry point; application wiring stays outside the reusable workflow repository.
import { createWorkflowRepository as createRepository } from '../workflow/repository.js';
import { documentReviewDefinition } from '../workflow/definitions.js';
import { createCaseWorkflowAdapter } from '../../adapters/case-workflow.js';

export function createWorkflowRepository(pool) {
  return createRepository(pool, {
    definitions: [
      {
        definition: documentReviewDefinition,
        entityType: 'document',
        createRoles: ['operator', 'reviewer'],
      },
    ],
    adapters: [createCaseWorkflowAdapter(pool)],
  });
}
