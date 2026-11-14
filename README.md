# Civitas Relay

**Your agent learns something. The right agents know it too.**

Share versioned, source-linked context between independently owned coding agents
through MCP. A website manages collaboration; a desktop companion connects local
agents. Built for HackPrinceton 2026.

Tasks 1A and 1B are integrated: the in-memory relay, shared schemas, HTTP client,
and MCP bridge exchange real events. A live web dashboard supports demo-key access,
publishing, subscriptions, inbox retrieval, and activity. PostgreSQL persistence
works locally; optional Timescale analytics awaits a real Tiger Cloud connection.
The Deep Agents analyst is implemented; a real model run awaits a provider key.
Desktop, public sign-in, and invitations are not implemented yet.

- [Design](docs/product.md): product, stack, prize strategy, and demo.
- [Work plan](docs/work-plan.md): milestones and two parallel first-section assignments.
- [Agent instructions](AGENTS.md): short development rules.
- [Deep Agents runner](apps/change-analyst/README.md): analysis, review, and MCP publication.

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

Use Node.js 22+ and npm 10+. The default setup uses memory; no database is needed.

```sh
npm install
npm run setup:demo
npm run build:relay
npm run start:relay
```

Or use `npm run dev:relay` to rebuild contracts and watch relay source changes.
The relay reads the root `.env`, binds to `http://127.0.0.1:4000`, and admits two
agents (`ag_publisher`, `ag_receiver`) to `sp_demo`. Override the port/space in `.env`.
With `RELAY_STORAGE=memory`, **all events, subscriptions, retry keys, and inboxes
disappear on restart.** Existing `.env` files should set this explicitly if no
database is running. Without an explicit mode, a `DATABASE_URL` selects PostgreSQL.

Setup creates/preserves private credentials in `.env` and writes ignored,
user-only `.local/publisher.env` and `.local/receiver.env`. Each agent file contains
`CIVITAS_RELAY_URL`, `CIVITAS_AGENT_TOKEN`, and `CIVITAS_DEMO_SPACE_ID` for the bridge.
Never commit or paste these tokens into chat. Re-running setup preserves credentials.

## Persistent storage and Tiger Data

For local PostgreSQL, use the included Docker Compose service:

```sh
docker compose up -d db
```

In your ignored `.env`, set `RELAY_STORAGE=postgres`, keep `DATABASE_URL` matched
to Compose's credentials/port, and leave `RELAY_ANALYTICS_ENABLED=false`. Then:

```sh
npm run db:migrate
npm run start:relay
```

Migrations are explicit and safe to rerun; do not edit applied SQL files. Events,
subscriptions, retry keys, deliveries, and first retrieval timestamps survive relay
and database restarts. Publish and fanout commit together. Concurrent retries across
relay processes create one event; changed content under the same key returns 409.
`/readyz` checks the database and reports `storage: "postgres", durable: true`.
Database failures return errors and never silently switch to memory.

For **Tiger Cloud**, provision a PostgreSQL service with TimescaleDB enabled, put
its connection URI in `.env` as `DATABASE_URL`, and set
`RELAY_ANALYTICS_ENABLED=true`. Run `npm run db:migrate` again, then restart the
relay. Remote connections require verified TLS; set `DATABASE_CA_FILE` to a trusted
CA bundle path when your service requires one. Never commit the URI or expose it
through a `NEXT_PUBLIC_` variable.

The separate Timescale migration creates a hypertable mirroring the unique
published/delivered/first-retrieved transition ledger, including existing history.
The authenticated `GET /v1/spaces/sp_demo/analytics` route uses `time_bucket` to
return per-minute counts and mean/p50/p95 latency by transition kind. Optional
`from`/`to` timestamps select a range up to seven days; default is the last hour.
Latency runs from server publication to delivery or first inbox retrieval, includes
polling delay, and does not prove model comprehension or useful action. Telemetry
contains IDs/timing, not context bodies. Disabled analytics returns 503.

**Verified:** real PostgreSQL publish/retrieve, concurrent retries across two relay
processes, rollback on fanout failure, space isolation, and persistence after
relay and database restarts, including two real MCP bridge processes.
**Pending:** Tiger Cloud connection, Timescale migration execution,
and live analytics results. Vanilla PostgreSQL alone is not a Tiger integration.

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
clears shared activity only in memory mode; web restart disconnects browser sessions.

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
| `GET /v1/spaces/sp_demo/analytics` | Per-minute Timescale transition counts and latency; opt-in |

Subscribe before publishing. Topics match exactly. Publish requires `topic`,
`title`, `content`, `source: { uri, revision, excerpt? }`, and `idempotencyKey`.
Identical retries return the same event; changed bodies under that key return 409.
Inbox reads replay all deliveries and do not acknowledge them. Omit cursor/limit:
version appends, pagination, wildcards, and acknowledgement are not implemented.
`/readyz` reports actual storage, durability, and whether analytics is enabled.

Version appends and acknowledgements remain follow-up work. License and public
package naming are undecided.
