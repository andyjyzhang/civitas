# Civitas Relay

**Your agent learns something. The right agents know it too.**

Share versioned, source-linked context between independently owned coding agents
through MCP. A website manages collaboration; a desktop companion connects local
agents. Built for HackPrinceton 2026.

Tasks 1A and 1B are integrated: the in-memory relay, shared schemas, HTTP client,
and MCP bridge exchange real events. A live web dashboard supports demo-key access,
publishing, subscriptions, inbox retrieval, and activity. Desktop, Deep Agents,
public sign-in, invitations, and persistent storage are not implemented yet.

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

## Run the relay

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

## Run the website

Keep the relay running, then in another terminal:

```sh
npm run build:web
npm run start:web
```

Open `http://127.0.0.1:3000`. Connect using the private `CIVITAS_AGENT_TOKEN` value
from one generated agent env file. Use a separate browser profile/incognito session
and the other key to demonstrate a second participant. `npm run dev:web` runs the
website in development mode instead.

Subscribe the receiver to `project/maintenance-api`, publish from the other session,
and retrieve the receiver's inbox. The feed polls real activity every three seconds.
The web server keeps credentials in temporary HttpOnly sessions, not browser storage.
These are demo identities, not public account sign-in or invitations. Relay restart
clears shared activity; web restart disconnects browser sessions.

## Run the MCP bridge

```sh
npm run build:bridge
node --env-file=.local/receiver.env packages/cli/dist/index.js
```

Use `.local/publisher.env` for a separate publishing process. The bridge exposes
`publish_context`, `subscribe`, and `get_updates`; stdout is MCP protocol traffic.
For manual Claude Code integration, set the corresponding private env variables
in your shell and add the built bridge without replacing other MCP entries:

```sh
claude mcp add --scope local --transport stdio civitas -- node /absolute/path/to/civitas/packages/cli/dist/index.js
```

This command shape was inspected by 1B; a live Claude Code model session has not
been demonstrated. Two real SDK MCP clients have published/retrieved through the
actual relay, including change metadata and idempotent retries.

## Relay interface

Shared ESM schemas/types are exported from `@civitas/contracts` after its build.
Use a different agent env file per MCP process. Send bearer auth on these routes:

| Route | Body/result |
| --- | --- |
| `POST /v1/spaces/sp_demo/subscriptions` | `{ topic }` → `Subscription` |
| `POST /v1/spaces/sp_demo/contexts` | `PublishContextInput` → `ContextEvent` |
| `GET /v1/spaces/sp_demo/updates` | `UpdatesPage` |
| `GET /v1/spaces/sp_demo/activity` | Authenticated `ActivitySnapshot` for the dashboard |

Subscribe before publishing. Topics match exactly. Publish requires `topic`,
`title`, `content`, `source: { uri, revision, excerpt? }`, and `idempotencyKey`.
Identical retries return the same event; changed bodies under that key return 409.
Inbox reads replay all deliveries and do not acknowledge them. Omit cursor/limit:
version appends, pagination, wildcards, and acknowledgement are not implemented.
`/readyz` reports `storage: "memory", durable: false` rather than database readiness.

PostgreSQL/Tiger Cloud persistence is follow-up work. The existing Docker Compose
file remains available for local PostgreSQL when that slice begins. License and
public package naming are undecided.
