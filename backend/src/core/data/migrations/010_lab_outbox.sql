-- SPDX-FileCopyrightText: 2026 TraceWeaver contributors
-- SPDX-License-Identifier: Apache-2.0
CREATE TABLE core.lab_outbox (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.lab_sandboxes(workspace_id),
  source_id uuid NOT NULL,
  document jsonb NOT NULL,
  delivered_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  FOREIGN KEY(workspace_id,source_id) REFERENCES core.sources(workspace_id,id)
);
