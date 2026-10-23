CREATE TABLE core.workflow_instances (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  definition_key text NOT NULL,
  definition_version integer NOT NULL CHECK(definition_version > 0),
  definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object'),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  creator_subject varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,entity_type,entity_id)
);
CREATE TABLE core.workflow_history (
  workspace_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  version integer NOT NULL CHECK(version > 0),
  from_state text,
  to_state text NOT NULL,
  owner_subject varchar(255),
  actor_subject varchar(255) NOT NULL,
  action text NOT NULL,
  reason varchar(1000) NOT NULL CHECK(reason ~ '\S'),
  evidence_refs uuid[] NOT NULL DEFAULT '{}',
  evidence_snapshot jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(evidence_snapshot)='object'),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,instance_id,version),
  FOREIGN KEY(workspace_id,instance_id) REFERENCES core.workflow_instances(workspace_id,id)
);
CREATE TABLE core.cases (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  run_id uuid NOT NULL,
  workflow_instance_id uuid NOT NULL UNIQUE,
  title varchar(300) NOT NULL CHECK(title ~ '\S'),
  creator_subject varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,id,run_id),
  FOREIGN KEY(workspace_id,run_id) REFERENCES core.reconstruction_runs(workspace_id,id),
  FOREIGN KEY(workspace_id,workflow_instance_id) REFERENCES core.workflow_instances(workspace_id,id)
);
CREATE INDEX cases_run_idx ON core.cases(workspace_id,run_id,id);
CREATE TABLE core.case_evidence (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  case_id uuid NOT NULL,
  run_id uuid NOT NULL,
  document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'),
  UNIQUE(workspace_id,case_id,id,run_id),
  FOREIGN KEY(workspace_id,case_id,run_id) REFERENCES core.cases(workspace_id,id,run_id)
);
CREATE INDEX case_evidence_case_idx ON core.case_evidence(workspace_id,case_id,id);
CREATE TABLE core.case_evidence_events (
  workspace_id uuid NOT NULL,
  case_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  run_id uuid NOT NULL,
  event_id uuid NOT NULL,
  PRIMARY KEY(workspace_id,evidence_id,event_id),
  FOREIGN KEY(workspace_id,case_id,evidence_id,run_id) REFERENCES core.case_evidence(workspace_id,case_id,id,run_id),
  FOREIGN KEY(workspace_id,run_id,event_id) REFERENCES core.run_events(workspace_id,run_id,event_id)
);
CREATE TABLE core.case_idempotency (
  workspace_id uuid NOT NULL,
  actor_subject varchar(255) NOT NULL,
  route text NOT NULL,
  key_hash text NOT NULL,
  request_hash text NOT NULL,
  case_id uuid NOT NULL,
  response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,actor_subject,route,key_hash),
  FOREIGN KEY(workspace_id,case_id) REFERENCES core.cases(workspace_id,id)
);
CREATE TRIGGER workflow_instances_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.workflow_instances
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
CREATE TRIGGER workflow_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.workflow_history
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
CREATE TRIGGER cases_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.cases
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
CREATE TRIGGER case_evidence_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.case_evidence
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
CREATE TRIGGER case_evidence_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.case_evidence_events
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
