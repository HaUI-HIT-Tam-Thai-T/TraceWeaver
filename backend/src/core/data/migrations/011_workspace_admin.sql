-- SPDX-FileCopyrightText: 2026 TraceWeaver contributors
-- SPDX-License-Identifier: Apache-2.0
CREATE TABLE core.workspace_admin_versions (
  workspace_id uuid PRIMARY KEY REFERENCES core.workspaces(id),
  version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE core.account_provisionings (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  actor_subject varchar(255) NOT NULL,
  key_hash text NOT NULL,
  request_hash text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,actor_subject,key_hash)
);
