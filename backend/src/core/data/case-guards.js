// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../identity/api-error.js';
import { latestWorkflow } from './workflow-store.js';
// Call only after acquiring the run lock used by closure/reopen and graph writers.
export async function assertRunEditable(client, workspace, run) {
  const {
    rows: [row],
  } = await client.query(
    `SELECT EXISTS(SELECT 1 FROM core.cases c
    JOIN LATERAL (${latestWorkflow}) h ON true WHERE c.workspace_id=$1 AND c.run_id=$2 AND h.to_state='closed') AS closed`,
    [workspace, run],
  );
  if (row.closed)
    throw new ApiError(409, 'CASE_CLOSED', 'Reopen closed cases before changing this run graph');
}
