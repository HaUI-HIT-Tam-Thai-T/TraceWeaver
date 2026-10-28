// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { workflowInput } from '../validations/workflow.validation.js';
export function createWorkflowService(repository) {
  async function protect(work) {
    try { return await work(); } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'CORE_NOT_READY', 'Workflow management is temporarily unavailable');
    }
  }
  return {
    create(app, subject, workspace, input) {
      return protect(() => repository.create(app, subject, workspace, workflowInput('WorkflowCreate', input, subject, workspace)));
    },
    get(app, subject, workspace, id) { return protect(() => repository.get(app, subject, workspace, id)); },
    transition(app, subject, workspace, id, input) {
      return protect(() => repository.transition(app, subject, workspace, id, workflowInput('WorkflowTransition', input, subject, workspace)));
    },
  };
}
