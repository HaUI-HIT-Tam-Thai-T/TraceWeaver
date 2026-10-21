// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { validBatch } from '../validations/ingestion.validation.js';
import { normalizeEvent, digest } from '../core/data/event-normalizer.js';

export function createIngestionService(repository) {
  return {
    async batch(subject, workspace, source, body) {
      if (!validBatch(body)) throw new ApiError(422, 'INVALID_BATCH', 'Batch envelope is invalid');
      try {
        return await repository.ingest(subject, workspace, source, (metadata) => {
          const items = body.events.map((event) => normalizeEvent(event, metadata));
          // Hash only sanitized data: rejected raw values never reach persistence.
          return { items, digest: digest(items) };
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(503, 'CORE_NOT_READY', 'Core is temporarily unavailable');
      }
    },
  };
}
