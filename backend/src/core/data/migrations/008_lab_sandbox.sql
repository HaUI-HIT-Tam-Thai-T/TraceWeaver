-- SPDX-FileCopyrightText: 2026 TraceWeaver contributors
-- SPDX-License-Identifier: Apache-2.0
-- Explicit opt-in: no sandbox is created by this migration.
CREATE TABLE core.lab_sandboxes (
  workspace_id uuid PRIMARY KEY REFERENCES core.workspaces(id),
  source_ids uuid[] NOT NULL CHECK(cardinality(source_ids)=3),
  document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
