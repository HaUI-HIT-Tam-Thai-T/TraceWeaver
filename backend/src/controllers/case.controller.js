// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { workspaceId } from '../validations/access.validation.js';
import { caseQuery } from '../validations/case.validation.js';
import { labCommand } from '../validations/lab.validation.js';
export function createCaseController(cases) {
  function scope(req, list = false) {
    if (!list && Object.keys(req.query).length)
      throw new ApiError(400, 'INVALID_QUERY', 'Case query parameters are invalid');
    if (req.method === 'POST' && !req.is('application/json'))
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    const workspace = workspaceId(req.params.wid);
    if (!cases)
      throw new ApiError(503, 'CORE_NOT_READY', 'Case management is temporarily unavailable');
    return workspace;
  }
  return {
    async sandbox(req, res) {
      const workspace = scope(req);
      let command;
      if (req.method === 'POST') {
        const { expected_case_version, ...input } = req.body ?? {};
        if (
          !Number.isSafeInteger(expected_case_version) ||
          expected_case_version < 1 ||
          Object.hasOwn(input, 'request_id') ||
          input.action === 'submit'
        )
          throw new ApiError(400, 'INVALID_INPUT', 'Invalid case sandbox command');
        const parsed = labCommand({
          ...input,
          ...(input.action === 'capacity' ? {} : { request_id: 'server-bound' }),
        });
        const { request_id, ...bound } = parsed;
        command = { ...bound, expected_case_version };
      }
      res.json(
        await cases.sandbox(req.identity.subject, workspace, workspaceId(req.params.cid), command),
      );
    },
    async verifications(req, res) {
      const workspace = scope(req);
      res.json(
        await cases.verifications(req.identity.subject, workspace, workspaceId(req.params.cid)),
      );
    },
    async verify(req, res) {
      const workspace = scope(req);
      if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length)
        throw new ApiError(400, 'INVALID_INPUT', 'Verification accepts an empty object');
      res
        .status(201)
        .json(await cases.verify(req.identity.subject, workspace, workspaceId(req.params.cid)));
    },
    async create(req, res) {
      const workspace = scope(req),
        result = await cases.create(
          req.identity.subject,
          workspace,
          req.body,
          req.get('Idempotency-Key'),
        );
      res.location(`/api/v1/workspaces/${workspace}/cases/${result.id}`).status(201).json(result);
    },
    async list(req, res) {
      const workspace = scope(req, true);
      res.json(await cases.page(req.identity.subject, workspace, caseQuery(req.query)));
    },
    async get(req, res) {
      const workspace = scope(req);
      res.json(await cases.get(req.identity.subject, workspace, workspaceId(req.params.cid)));
    },
    async assignees(req, res) {
      const workspace = scope(req);
      res.json(await cases.assignees(req.identity.subject, workspace, workspaceId(req.params.cid)));
    },
    async evidence(req, res) {
      const workspace = scope(req);
      res
        .status(201)
        .json(
          await cases.evidence(
            req.identity.subject,
            workspace,
            workspaceId(req.params.cid),
            req.body,
          ),
        );
    },
    async transition(req, res) {
      const workspace = scope(req);
      res.json(
        await cases.transition(
          req.identity.subject,
          workspace,
          workspaceId(req.params.cid),
          req.body,
          req.get('Idempotency-Key'),
        ),
      );
    },
  };
}
