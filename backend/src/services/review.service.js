// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { reviewInput, manualLinkInput } from '../validations/review.validation.js';
export function createReviewService(repository) {
  async function protect(work) {
    try { return await work(); } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'CORE_NOT_READY', 'Link editing is temporarily unavailable');
    }
  }
  return {
    review(subject, workspace, run, link, input) {
      return protect(() => repository.review(subject, workspace, run, link, reviewInput(input)));
    },
    manual(subject, workspace, run, input) {
      return protect(() => repository.manual(subject, workspace, run, manualLinkInput(input)));
    },
  };
}
