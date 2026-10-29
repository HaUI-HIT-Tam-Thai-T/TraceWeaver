ALTER TABLE core.events ADD CONSTRAINT events_workspace_event_unique UNIQUE (workspace_id, event_id);
ALTER TABLE core.events ADD CONSTRAINT events_workspace_source_event_unique UNIQUE (workspace_id, source_id, event_id);

CREATE TABLE core.reconstruction_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  creator_subject varchar(255) NOT NULL,
  root_event_id uuid NOT NULL,
  input_snapshot_id uuid NOT NULL UNIQUE,
  request jsonb NOT NULL CHECK (jsonb_typeof(request) = 'object'),
  policy jsonb NOT NULL CHECK (jsonb_typeof(policy) = 'object'),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  graph_metadata jsonb NOT NULL CHECK (jsonb_typeof(graph_metadata) = 'object'),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, root_event_id) REFERENCES core.events(workspace_id, event_id)
);
CREATE TABLE core.run_sources (
  workspace_id uuid NOT NULL,
  run_id uuid NOT NULL,
  source_id uuid NOT NULL,
  PRIMARY KEY (workspace_id, run_id, source_id),
  FOREIGN KEY (workspace_id, run_id) REFERENCES core.reconstruction_runs(workspace_id, id),
  FOREIGN KEY (workspace_id, source_id) REFERENCES core.sources(workspace_id, id)
);
CREATE TABLE core.run_events (
  workspace_id uuid NOT NULL,
  run_id uuid NOT NULL,
  source_id uuid NOT NULL,
  event_id uuid NOT NULL,
  PRIMARY KEY (workspace_id, run_id, event_id),
  FOREIGN KEY (workspace_id, run_id, source_id) REFERENCES core.run_sources(workspace_id, run_id, source_id),
  FOREIGN KEY (workspace_id, source_id, event_id) REFERENCES core.events(workspace_id, source_id, event_id)
);
ALTER TABLE core.reconstruction_runs ADD CONSTRAINT run_root_in_snapshot
  FOREIGN KEY (workspace_id, id, root_event_id) REFERENCES core.run_events(workspace_id, run_id, event_id)
  DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE core.run_links (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  run_id uuid NOT NULL,
  from_event_id uuid NOT NULL,
  to_event_id uuid NOT NULL,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  CHECK (from_event_id <> to_event_id),
  UNIQUE (workspace_id, run_id, from_event_id, to_event_id),
  FOREIGN KEY (workspace_id, run_id, from_event_id) REFERENCES core.run_events(workspace_id, run_id, event_id),
  FOREIGN KEY (workspace_id, run_id, to_event_id) REFERENCES core.run_events(workspace_id, run_id, event_id)
);
CREATE TABLE core.run_idempotency (
  workspace_id uuid NOT NULL,
  actor_subject varchar(255) NOT NULL,
  route text NOT NULL CHECK (route = 'runs'),
  key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  run_id uuid NOT NULL,
  response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, actor_subject, route, key_hash),
  FOREIGN KEY (workspace_id, run_id) REFERENCES core.reconstruction_runs(workspace_id, id)
);
CREATE TRIGGER reconstruction_runs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.reconstruction_runs
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
CREATE TRIGGER run_sources_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.run_sources
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
CREATE TRIGGER run_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.run_events
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
CREATE TRIGGER run_links_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.run_links
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
