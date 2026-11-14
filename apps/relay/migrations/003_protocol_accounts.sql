ALTER TABLE civitas_events DROP CONSTRAINT civitas_events_version_check;
ALTER TABLE civitas_events ADD CONSTRAINT civitas_events_version_check CHECK (version > 0);
ALTER TABLE civitas_deliveries ADD COLUMN sequence bigint GENERATED ALWAYS AS IDENTITY;
CREATE INDEX ON civitas_deliveries (space_id, agent_id, sequence);
ALTER TABLE civitas_deliveries ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','dismissed'));
ALTER TABLE civitas_deliveries ADD COLUMN acknowledged_at timestamptz;
ALTER TABLE civitas_deliveries ADD CONSTRAINT civitas_delivery_disposition CHECK ((status = 'pending') = (acknowledged_at IS NULL));
-- Durable private identity records. Separate from context events and telemetry;
-- token/password plaintext is never stored. Mutations serialize on a DB lock.
CREATE TABLE civitas_identity_records (
  kind text NOT NULL,
  record_id text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (kind, record_id)
);
