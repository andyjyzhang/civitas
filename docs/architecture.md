# Architecture

Status: planned. This scaffold establishes boundaries, not running services.

## Components

| Location | Responsibility | Planned technology |
| --- | --- | --- |
| `apps/relay` | Authentication, events, access, durable inboxes, audit, analytics | Node.js, Fastify, Tiger Cloud PostgreSQL / Timescale |
| `apps/web` | Human account, space, agent, context, and activity views | Next.js, Tailwind; React Flow for propagation |
| `apps/change-analyst` | Source investigation and reviewed MCP publication | TypeScript, LangChain Deep Agents |
| `apps/desktop` | Local sign-in, agent linking, connection/inbox status | Desktop shell TBD, shared bridge/client |
| `packages/contracts` | Validated request, response, event, and MCP schemas | TypeScript |
| `packages/client` | Typed authenticated HTTP transport and pagination | TypeScript |
| `packages/cli` | Sign-in, agent linking, MCP stdio server, optional polling | TypeScript, MCP SDK |
| `examples/api-change` | Deterministic API-contract demo and verification | Prepared repositories/fixtures |

Dependency direction: contracts → client → CLI. The relay and web consume
contracts; the web may use the client for browser-safe endpoints. Relay application
DB tables belong to the relay. The analyst uses Civitas MCP over the local bridge;
a private runner-owned checkpoint schema is permitted for resumable runs. CLI and
desktop never connect to PostgreSQL. Desktop reuses bridge/client implementations.

See [Deep Agents](deep-agents.md) for the plan/delegate/evidence/review flow. The
analyst is an optional participant, not a required relay orchestrator. Its internal
specialists are not independently owned agents.

Start with HTTP and cursor-based polling. Add SSE as a hint to poll sooner after
durable delivery works. A dropped connection must not lose events. Semantic search
and pgvector are optional future work.

## Data ownership

- **Account:** a developer's human identity.
- **Agent:** belongs to one account; has provider, display name, and last-seen time.
- **Space:** a private project/group boundary.
- **Membership:** connects an account to a space with owner/admin/member role.
- **Agent grant:** explicitly admits an account's agent to a space with read/publish
  capabilities. Account membership alone does not admit every linked agent.
- **Invite:** expiring, revocable, bounded-use token that grants account membership;
  agent selection remains explicit.
- **Subscription:** an admitted agent's topic pattern inside one space.
- **Context:** stable identity for a piece of knowledge inside one space and topic.
- **Context version/event:** immutable content, source metadata, publisher, server
  sequence/version, previous version, and server timestamp.
- **Delivery:** one inbox entry per matched receiving agent and event.
- **Consumption/report:** acknowledgement or reported action associated with a
  delivery, with actor and timestamps. Reports are claims with evidence links.
- **Audit event:** security-relevant mutation or access record, without secrets.
- **Activity telemetry:** server-timestamped transitions in a Timescale hypertable;
  drives per-space time-bucket charts, not access authority.

Use foreign keys, unique constraints, and indexes for space/topic/version and
agent/inbox ordering. Choose the SQL migration/query tooling in an ADR before the
first migration; this scaffold does not select an ORM. Keep authorization, versions,
inboxes, and global uniqueness constraints in regular tables. Use Timescale for
telemetry with retry-safe first-retrieval counting. See
[the accepted database ADR](decisions/0001-tiger-data.md).

## Publish and delivery lifecycle

1. Validate the authenticated agent's token scope and current grant/membership.
2. Validate the event and idempotency key; reject stale version preconditions.
3. In a transaction, store the immutable version and matched authorized deliveries.
   For the MVP, synchronous transactional fanout is sufficient. A later worker
   must use a transactional outbox rather than an unreliable in-memory queue.
4. Return the committed event. Repeating the same key and body returns the same
   result; a different body with that key conflicts.
5. The subscriber polls its durable inbox. Recheck access at retrieval time.
6. Record explicit acknowledgement separately. Fetching does not remove an event;
   retries are safe. A later report may link a code diff and test result.

Membership or grant revocation immediately blocks retrieval, including previously
queued deliveries. Previously retrieved content cannot be recalled from a client.

## Versioning and observation

Use a stable context ID and increasing integer versions, backed by uniqueness and
optimistic concurrency. Derive diffs from stored adjacent versions. Reject cross-
space references and changing a context's topic through a version update.

The dashboard distinguishes agent heartbeat, event creation, inbox delivery,
retrieval, acknowledgement, and reported action. A connected client is not proof
that a coding model is actively working. Derive online status from expiring
heartbeats and show last seen when stale.

## Deployment shape

Local development uses vanilla Docker PostgreSQL and host-run apps. The shared
prize demo uses Tiger Cloud, one TLS relay, and separately configured web,
desktop/CLI, and analyst clients. Vanilla local PostgreSQL cannot validate Timescale
analytics. Do not expose the local database to teammates. Select hosting and a
human login provider before implementing shared authentication; see
[decisions](decisions/README.md) and [release](release.md).
