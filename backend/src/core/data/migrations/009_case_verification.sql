-- SPDX-FileCopyrightText: 2026 TraceWeaver contributors
-- SPDX-License-Identifier: Apache-2.0
CREATE TABLE core.case_verifications (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  case_id uuid NOT NULL,
  case_version integer NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(workspace_id,case_id) REFERENCES core.cases(workspace_id,id)
);
CREATE INDEX case_verifications_case ON core.case_verifications(workspace_id,case_id,created_at DESC);
CREATE TRIGGER case_verifications_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.case_verifications
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
