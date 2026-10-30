// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { reader, visibleSource } from '../identity/access-repository.js';

export const artifactScope = `${reader} AND NOT EXISTS (
  SELECT 1 FROM core.run_sources rs WHERE rs.workspace_id=r.workspace_id AND rs.run_id=r.id
  AND NOT EXISTS (SELECT 1 FROM core.sources s WHERE s.workspace_id=rs.workspace_id AND s.id=rs.source_id AND ${visibleSource}))`;
