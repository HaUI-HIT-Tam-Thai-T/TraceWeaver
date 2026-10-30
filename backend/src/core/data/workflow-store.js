// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

export { createWorkflow, appendHistory, historyDto } from '../workflow/store.js';
// Case query projection retained for existing TraceWeaver repositories.
export const latestWorkflow = `SELECT * FROM core.workflow_history h
  WHERE h.workspace_id=c.workspace_id AND h.instance_id=c.workflow_instance_id ORDER BY version DESC LIMIT 1`;
