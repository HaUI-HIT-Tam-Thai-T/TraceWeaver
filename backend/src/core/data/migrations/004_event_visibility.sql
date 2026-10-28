-- Stamp top-level transaction IDs, including existing immutable events at migration time.
-- This avoids subtransaction IDs and wraparound ambiguity from tuple xmin.
ALTER TABLE core.events ADD COLUMN insert_xid xid8 NOT NULL DEFAULT pg_current_xact_id();
CREATE INDEX events_workspace_time_idx ON core.events(workspace_id, occurred_at, event_id);
