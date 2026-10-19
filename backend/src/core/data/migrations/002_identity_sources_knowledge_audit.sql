CREATE TABLE core.memberships (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  subject varchar(255) NOT NULL CHECK (length(btrim(subject)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz CHECK (revoked_at >= created_at),
  PRIMARY KEY (workspace_id, subject)
);
CREATE INDEX memberships_subject_workspace_idx ON core.memberships(subject, workspace_id);

CREATE TABLE core.roles (
  role_key text PRIMARY KEY CHECK (role_key IN ('viewer', 'operator', 'reviewer', 'admin', 'ingest_service'))
);
INSERT INTO core.roles(role_key) VALUES ('viewer'), ('operator'), ('reviewer'), ('admin'), ('ingest_service');

CREATE TABLE core.membership_roles (
  workspace_id uuid NOT NULL,
  subject varchar(255) NOT NULL,
  role_key text NOT NULL REFERENCES core.roles(role_key),
  PRIMARY KEY (workspace_id, subject, role_key),
  FOREIGN KEY (workspace_id, subject) REFERENCES core.memberships(workspace_id, subject)
);

CREATE TABLE core.groups (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, name)
);

CREATE TABLE core.group_members (
  workspace_id uuid NOT NULL,
  group_id uuid NOT NULL,
  subject varchar(255) NOT NULL,
  PRIMARY KEY (workspace_id, group_id, subject),
  FOREIGN KEY (workspace_id, group_id) REFERENCES core.groups(workspace_id, id),
  FOREIGN KEY (workspace_id, subject) REFERENCES core.memberships(workspace_id, subject)
);
CREATE INDEX group_members_subject_idx ON core.group_members(workspace_id, subject, group_id);

CREATE TABLE core.sources (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  source_key text NOT NULL CHECK (source_key ~ '^[a-z][a-z0-9_-]{0,99}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  service text NOT NULL CHECK (length(btrim(service)) BETWEEN 1 AND 100),
  parser_version text NOT NULL CHECK (length(btrim(parser_version)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, source_key)
);

CREATE TABLE core.source_grants (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  source_id uuid NOT NULL,
  grantee_subject varchar(255),
  group_id uuid,
  permission text NOT NULL CHECK (permission IN ('read', 'ingest')),
  granted_by varchar(255) NOT NULL CHECK (length(btrim(granted_by)) > 0),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz CHECK (revoked_at >= granted_at),
  CHECK (num_nonnulls(grantee_subject, group_id) = 1),
  FOREIGN KEY (workspace_id, source_id) REFERENCES core.sources(workspace_id, id),
  FOREIGN KEY (workspace_id, grantee_subject) REFERENCES core.memberships(workspace_id, subject),
  FOREIGN KEY (workspace_id, group_id) REFERENCES core.groups(workspace_id, id)
);
CREATE UNIQUE INDEX source_grants_active_subject_idx
  ON core.source_grants(workspace_id, source_id, grantee_subject, permission)
  WHERE revoked_at IS NULL AND grantee_subject IS NOT NULL;
CREATE UNIQUE INDEX source_grants_active_group_idx
  ON core.source_grants(workspace_id, source_id, group_id, permission)
  WHERE revoked_at IS NULL AND group_id IS NOT NULL;
CREATE INDEX source_grants_subject_lookup_idx
  ON core.source_grants(workspace_id, grantee_subject, permission, source_id)
  WHERE revoked_at IS NULL AND grantee_subject IS NOT NULL;
CREATE INDEX source_grants_group_lookup_idx
  ON core.source_grants(workspace_id, group_id, permission, source_id)
  WHERE revoked_at IS NULL AND group_id IS NOT NULL;

CREATE TABLE core.knowledge_articles (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 100000),
  author_subject varchar(255) NOT NULL CHECK (length(btrim(author_subject)) > 0),
  source_ref text NOT NULL CHECK (source_ref ~ '^[A-Za-z][A-Za-z0-9+.-]*:'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id, version)
);
CREATE INDEX knowledge_articles_latest_idx ON core.knowledge_articles(workspace_id, id, version DESC);

CREATE TABLE core.audit_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  actor_subject varchar(255) NOT NULL CHECK (length(btrim(actor_subject)) > 0),
  action text NOT NULL CHECK (length(btrim(action)) BETWEEN 1 AND 200),
  entity_type text NOT NULL CHECK (length(btrim(entity_type)) BETWEEN 1 AND 100),
  entity_id text NOT NULL CHECK (length(btrim(entity_id)) BETWEEN 1 AND 255),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  before_ref jsonb CHECK (jsonb_typeof(before_ref) = 'object'),
  after_ref jsonb CHECK (jsonb_typeof(after_ref) = 'object')
);
CREATE INDEX audit_events_entity_idx ON core.audit_events(workspace_id, entity_type, entity_id, occurred_at, id);

CREATE FUNCTION core.reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON core.audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
