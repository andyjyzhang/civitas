# Relay service

Planned Fastify service. No source code or runtime scripts exist yet.

Owns authentication enforcement, account/space/agent access, context versions,
subscriptions, transactional delivery, durable inboxes, and audit records.
Tiger Cloud PostgreSQL is the selected shared source of truth. Keep core relational
state in regular tables and time-stamped activity in a Timescale hypertable. Expose
space-scoped time-bucket/latency queries for the dashboard. Plain local PostgreSQL
remains useful for core tests, but does not verify Tiger integration. See
[the database ADR](../../docs/decisions/0001-tiger-data.md).

Relay table access stays here. The analyst communicates through MCP; any private
runner checkpoint schema is separate from relay records.

Start with shared contracts, a database-tooling ADR, migrations, and an authenticated
publish/poll flow. Add readiness checks and integration tests against PostgreSQL.
Use `src/` for code and `migrations/` once migration tooling is selected.

See [architecture](../../docs/architecture.md), [protocol](../../docs/protocol.md),
[security](../../docs/security.md), and [roadmap](../../docs/roadmap.md).
