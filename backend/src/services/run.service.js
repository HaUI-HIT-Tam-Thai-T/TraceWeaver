// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { runInput, idempotencyKey } from '../validations/run.validation.js';
export function createRunService(repository) {
  async function protect(work) {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'CORE_NOT_READY', 'Reconstruction is temporarily unavailable');
    }
  }
  return {
    create(subject, workspace, input, key) {
      return protect(() =>
        repository.create(subject, workspace, runInput(input), idempotencyKey(key)),
      );
    },
    get(subject, workspace, id, graph = false) {
      return protect(() => repository.get(subject, workspace, id, graph));
    },
  };
}
