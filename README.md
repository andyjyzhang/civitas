# Civitas Relay

**Your agent learns something. The right agents know it too.**

Share versioned, source-linked context between independently owned coding agents
through MCP. A website manages collaboration; a desktop companion connects local
agents. Built for HackPrinceton 2026.

Task 1A is implemented: a local in-memory relay and shared schemas. The website,
desktop, Deep Agents analyst, HTTP client, and MCP bridge are not implemented yet.

- [Design](docs/product.md): product, stack, prize strategy, and demo.
- [Work plan](docs/work-plan.md): milestones and two parallel first-section assignments.
- [Agent instructions](AGENTS.md): short development rules.

## Layout

```text
apps/relay           Fastify API + database
apps/web             Next.js dashboard
apps/change-analyst   LangChain Deep Agents publisher
apps/desktop         Desktop companion (shell undecided)
packages/contracts   Shared schemas/types
packages/client      HTTP client
packages/cli         Local CLI/MCP bridge
```

## Run task 1A

Use Node.js 22+ and npm 10+. No database is needed for this sprint.

```sh
npm install
npm run setup:demo
npm run build:relay
npm run start:relay
```

Or use `npm run dev:relay` to rebuild contracts and watch relay source changes.
The relay reads the root `.env`, binds to `http://127.0.0.1:4000`, and admits two
agents (`ag_publisher`, `ag_receiver`) to `sp_demo`. Override the port/space in `.env`.
**All events, subscriptions, retry keys, and inboxes disappear on restart.**

Setup creates/preserves private credentials in `.env` and writes ignored,
user-only `.local/publisher.env` and `.local/receiver.env`. Each agent file contains
`CIVITAS_RELAY_URL`, `CIVITAS_AGENT_TOKEN`, and `CIVITAS_DEMO_SPACE_ID` for the bridge.
Never commit or paste these tokens into chat. Re-running setup preserves credentials.

### Bridge handoff (1B)

Shared ESM schemas/types are exported from `@civitas/contracts` after its build.
Use a different agent env file per MCP process. Send bearer auth on these routes:

| Route | Body/result |
| --- | --- |
| `POST /v1/spaces/sp_demo/subscriptions` | `{ topic }` → `Subscription` |
| `POST /v1/spaces/sp_demo/contexts` | `PublishContextInput` → `ContextEvent` |
| `GET /v1/spaces/sp_demo/updates` | `UpdatesPage` |

Subscribe before publishing. Topics match exactly. Publish requires `topic`,
`title`, `content`, `source: { uri, revision, excerpt? }`, and `idempotencyKey`.
Identical retries return the same event; changed bodies under that key return 409.
Inbox reads replay all deliveries and do not acknowledge them. Omit cursor/limit:
version appends, pagination, wildcards, and acknowledgement are not implemented.
`/readyz` reports `storage: "memory", durable: false` rather than database readiness.

PostgreSQL/Tiger Cloud persistence is follow-up work. The existing Docker Compose
file remains available for local PostgreSQL when that slice begins. License and
public package naming are undecided.
