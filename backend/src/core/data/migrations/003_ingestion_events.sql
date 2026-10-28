CREATE TABLE core.ingestion_batches (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  source_id uuid NOT NULL,
  creator_subject varchar(255) NOT NULL,
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  accepted integer NOT NULL DEFAULT 0 CHECK (accepted >= 0),
  duplicate integer NOT NULL DEFAULT 0 CHECK (duplicate >= 0),
  rejected integer NOT NULL DEFAULT 0 CHECK (rejected >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_id, id),
  FOREIGN KEY (workspace_id, source_id) REFERENCES core.sources(workspace_id, id)
);

CREATE TABLE core.events (
  event_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  source_id uuid NOT NULL,
  source_event_id varchar(200) NOT NULL CHECK (length(source_event_id) > 0),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  batch_id uuid NOT NULL,
  locator text NOT NULL,
  UNIQUE (workspace_id, source_id, source_event_id),
  FOREIGN KEY (workspace_id, source_id) REFERENCES core.sources(workspace_id, id),
  FOREIGN KEY (workspace_id, source_id, batch_id) REFERENCES core.ingestion_batches(workspace_id, source_id, id)
);
CREATE INDEX events_source_time_idx ON core.events(workspace_id, source_id, occurred_at, event_id);
CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON core.events
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
