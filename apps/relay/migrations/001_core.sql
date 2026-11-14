CREATE TABLE civitas_subscriptions (
  subscription_id text PRIMARY KEY,
  space_id text NOT NULL,
  agent_id text NOT NULL,
  topic text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (space_id, agent_id, topic)
);
CREATE INDEX ON civitas_subscriptions (space_id, topic);

CREATE TABLE civitas_events (
  event_id text PRIMARY KEY,
  space_id text NOT NULL,
  publisher_agent_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_body jsonb NOT NULL,
  context_id text NOT NULL,
  version integer NOT NULL CHECK (version = 1),
  published_at timestamptz NOT NULL,
  event jsonb NOT NULL,
  UNIQUE (space_id, publisher_agent_id, idempotency_key),
  UNIQUE (space_id, context_id, version),
  UNIQUE (space_id, event_id)
);
CREATE INDEX ON civitas_events (space_id, published_at DESC, event_id);

CREATE TABLE civitas_deliveries (
  delivery_id text PRIMARY KEY,
  space_id text NOT NULL,
  event_id text NOT NULL,
  agent_id text NOT NULL,
  delivered_at timestamptz NOT NULL,
  retrieved_at timestamptz,
  UNIQUE (space_id, event_id, agent_id),
  FOREIGN KEY (space_id, event_id) REFERENCES civitas_events (space_id, event_id)
);
CREATE INDEX ON civitas_deliveries (space_id, agent_id, delivered_at, delivery_id);

CREATE TABLE civitas_agent_activity (
  space_id text NOT NULL,
  agent_id text NOT NULL,
  last_activity_at timestamptz NOT NULL,
  PRIMARY KEY (space_id, agent_id)
);

-- Authoritative transition ledger: retries cannot inflate telemetry. No private bodies.
CREATE TABLE civitas_transitions (
  transition_id text PRIMARY KEY,
  space_id text NOT NULL,
  event_id text NOT NULL,
  agent_id text NOT NULL,
  delivery_id text,
  kind text NOT NULL CHECK (kind IN ('published', 'delivered', 'retrieved')),
  occurred_at timestamptz NOT NULL,
  latency_ms double precision CHECK (latency_ms IS NULL OR latency_ms >= 0),
  UNIQUE (space_id, event_id, agent_id, kind),
  FOREIGN KEY (space_id, event_id) REFERENCES civitas_events (space_id, event_id)
);
CREATE INDEX ON civitas_transitions (space_id, occurred_at);
