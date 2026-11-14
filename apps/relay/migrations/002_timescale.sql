-- Separate opt-in migration. Fails on vanilla PostgreSQL; never fakes Timescale.
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE civitas_activity (
  occurred_at timestamptz NOT NULL,
  transition_id text NOT NULL,
  space_id text NOT NULL,
  event_id text NOT NULL,
  agent_id text NOT NULL,
  delivery_id text,
  kind text NOT NULL,
  latency_ms double precision,
  PRIMARY KEY (occurred_at, transition_id)
);
SELECT create_hypertable('civitas_activity', 'occurred_at', if_not_exists => TRUE);
CREATE INDEX ON civitas_activity (space_id, occurred_at DESC);

-- Installed once at database level: all relay instances mirror transitions, even
-- if a particular instance has analytics reads disabled. Backfill historical data.
CREATE FUNCTION civitas_mirror_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO civitas_activity
    (occurred_at, transition_id, space_id, event_id, agent_id, delivery_id, kind, latency_ms)
  VALUES (NEW.occurred_at, NEW.transition_id, NEW.space_id, NEW.event_id, NEW.agent_id,
          NEW.delivery_id, NEW.kind, NEW.latency_ms);
  RETURN NEW;
END;
$$;
CREATE TRIGGER civitas_activity_on_transition
  AFTER INSERT ON civitas_transitions FOR EACH ROW EXECUTE FUNCTION civitas_mirror_activity();
INSERT INTO civitas_activity
  (occurred_at, transition_id, space_id, event_id, agent_id, delivery_id, kind, latency_ms)
SELECT occurred_at, transition_id, space_id, event_id, agent_id, delivery_id, kind, latency_ms
FROM civitas_transitions;
