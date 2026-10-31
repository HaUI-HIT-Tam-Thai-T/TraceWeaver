// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { createCaseRepository } from '../core/data/case-repository.js';
import { artifactScope } from '../core/reconstruction/run-scope.js';
import { caseInput } from '../validations/case.validation.js';
import { ApiError } from '../core/identity/api-error.js';
import { authorize } from '../core/identity/workspace-access.js';

// TraceWeaver owns case/run/evidence scope. The shared workflow repository does not.
export function createCaseWorkflowAdapter(pool) {
  const cases = createCaseRepository(pool);
  return {
    definitionKey: 'case_handling',
    definitionVersion: 1,
    entityType: 'case',
    async authorizeRead(client, { subject, workspace, row }) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM core.cases c
        JOIN core.reconstruction_runs r ON r.workspace_id=c.workspace_id AND r.id=c.run_id
        WHERE c.workspace_id=$2 AND c.id=$3 AND c.workflow_instance_id=$4 AND ${artifactScope}`,
        [subject, workspace, row.entity_id, row.id],
      );
      if (!rowCount) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
    },
    async create(client, { subject, workspace, input }) {
      // Never create an orphan case workflow. Reuse the transaction connection.
      await authorize(client, subject, workspace, [], true);
      await cases.get(subject, workspace, input.entity_ref.id, client);
      throw new ApiError(
        409,
        'WORKFLOW_EXISTS',
        'Case workflow already exists; use its workflow_instance_id',
      );
    },
    transition({ app, subject, workspace, row, input, serviceMember, respond }) {
      const command = caseInput('CaseTransition', {
        action: input.action,
        expected_version: input.expected_version,
        reason: input.reason,
        ...(input.owner_subject === undefined ? {} : { owner_id: input.owner_subject }),
      });
      return cases.transition(subject, workspace, row.entity_id, command, null, {
        authorize: serviceMember,
        evidenceRefs: input.evidence_refs,
        appSubject: app,
        respond,
      });
    },
  };
}
