# Architecture decisions

Use short architecture decision records (ADRs) for choices that affect multiple
workspaces or are expensive to reverse. Copy [the template](template.md) into
`NNNN-short-title.md`, set a status, and link related issues or evidence.

## Baseline from the product design

- TypeScript npm workspaces; web, relay, client, CLI/MCP, and shared contracts.
- Fastify relay and Tiger Cloud PostgreSQL durable storage; Next.js/Tailwind website.
- Deep Agents change analyst as an optional source-investigation participant.
- Desktop companion over the shared bridge; GitHub release downloads lower priority.
- Explicit space-scoped subscriptions; immutable context versions; durable inboxes.
- HTTP polling first; SSE and semantic retrieval are optional later additions.
- Private spaces and explicit agent grants; automatic execution is off by default.

These are starting constraints, not claims of implementation. Record a new ADR
when changing one, including why and how dependent components migrate.

## Decisions needed before dependent implementation

| Decision | Needed before |
| --- | --- |
| Human auth provider and CLI sign-in/token lifecycle | Account and agent linking |
| SQL query/migration tooling and migration ownership | First schema migration |
| Runtime validation, module format, and package build tooling | Shared contracts |
| Browser-to-relay session boundary and origin topology | Authenticated dashboard |
| Hosting, domain, and TLS termination | Cross-machine shared demo |
| License and package naming | Public distribution |

## Accepted records

- [0001: Tiger Data storage and analytics](0001-tiger-data.md)
- [0002: Deep Agents analyst and product surfaces](0002-analyst-and-surfaces.md)

These accept implementation direction, not runtime readiness. Do not infer other
choices from example environment variables or placeholder manifests.
