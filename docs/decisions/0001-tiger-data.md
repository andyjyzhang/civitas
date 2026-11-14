# 0001: Tiger Data for shared storage and relay analytics

Date: 2026-11-14

Status: accepted for the implementation plan; no service provisioned yet.

## Context and decision

The team wants one database sponsor target with substantive product value. Civitas
already needs relational memberships, immutable versions, transactional fanout,
durable inboxes, and time-stamped propagation activity.

Choose **Tiger Cloud (Tiger Data)** as the shared demo database. Keep PostgreSQL
for local relay development. Add a Timescale hypertable for event telemetry in the
same database; do not introduce MongoDB Atlas as a second store just for a prize.

Atlas could model the application and offers integrated search, but changing the
storage design provides no immediate benefit to our explicit topic-based MVP.
This choice minimizes implementation changes while supporting useful metrics.
Reference: [Atlas overview](https://www.mongodb.com/docs/atlas/).

## Schema boundaries

Regular tables own accounts, roles, agent grants, contexts/versions, subscriptions,
deliveries, idempotency, and audit authority. Preserve unique `(event_id, agent_id)`
deliveries and `(context_id, version)` versions. They remain the source of truth.

Add `relay_activity` as a time-partitioned hypertable for instrumentation, with
`occurred_at` (server `timestamptz`), `space_id`, `event_id`, optional `agent_id` and
`delivery_id`, activity kind, and numeric latency when relevant. No content bodies,
source excerpts, or credentials. `activity_id` plus `occurred_at` can form its
primary key. Globally unique retry/deduplication belongs in regular tables, since
hypertable unique constraints must include partition keys.
See [hypertable constraints](https://www.tigerdata.com/docs/build/performance-optimization/hypertables-and-unique-indexes).

Write transition telemetry transactionally with authoritative state, or through a
durable outbox. Emit retrieval telemetry only on the first successful retrieval
transition for each delivery; repeated polling must not inflate unique reuse.
Reports and acknowledgements are separate kinds. Telemetry loss must never change
inbox eligibility or authorization.

## Product queries and metrics

Use `time_bucket` to count publication, delivery, first retrieval, and reports by
minute and space. Compute publish-to-delivery and publish-to-first-retrieval
latencies from server times. Return sample counts with medians/p95; tiny demo
samples do not support throughput or scale claims. Count unique event/agent pairs
when showing reach. Polling interval affects retrieval latency and must be shown.

The live dashboard reads authorized relay endpoints; no browser/agent receives
database credentials. Apply space predicates and membership checks to every query,
including summaries. Do not expose cross-space aggregate totals.

Start with raw time-bucket queries and indexes. Add a continuous aggregate only
after measuring a need and verifying refresh behavior on the selected service.
If used, show its freshness watermark and explicitly configure recent-data
handling. See [continuous aggregates](https://www.tigerdata.com/docs/learn/continuous-aggregates)
and [real-time aggregation](https://www.tigerdata.com/docs/learn/continuous-aggregates/real-time-aggregates).

## Setup and verification

Provision a Tiger Cloud service manually when authorized. Use its connection
details with TLS, least-privilege roles, and server-only `DATABASE_URL`. Never put a
connection URI into an issue, trace, screenshot, or browser config. See
[connection guidance](https://www.tigerdata.com/docs/integrate/find-connection-details).

Separate portable core migrations from Timescale migrations. Extension-enabled
deployments must fail clearly if analytics prerequisites are missing. Plain local
PostgreSQL can test relay behavior with analytics explicitly disabled; it does not
verify the sponsor integration. The checked-in Compose file remains that baseline.
Add extension integration checks on Tiger Cloud before claiming the feature works.

Acceptance: real stored event survives relay restart; actual hypertable metadata
is inspectable; dashboard data comes from a real time-bucket query; first retrieval
metrics remain stable after retry; unauthorized aggregate access fails. A seeded
load test must be labeled synthetic and isolated from live metrics. No compression
or performance improvement claim without a measured comparison.
