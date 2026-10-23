ALTER TABLE core.run_links ADD CONSTRAINT run_links_scoped_id UNIQUE(workspace_id, run_id, id);

CREATE TABLE core.link_reviews (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  run_id uuid NOT NULL,
  link_id uuid NOT NULL,
  link_version integer NOT NULL CHECK(link_version >= 2),
  decision text NOT NULL CHECK(decision IN ('accepted','rejected')),
  reason varchar(1000) NOT NULL CHECK(reason ~ '\S'),
  actor_subject varchar(255) NOT NULL CHECK(length(actor_subject) > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(workspace_id, run_id, link_id, link_version),
  FOREIGN KEY(workspace_id, run_id, link_id) REFERENCES core.run_links(workspace_id, run_id, id)
);
CREATE TRIGGER link_reviews_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON core.link_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION core.reject_audit_mutation();
