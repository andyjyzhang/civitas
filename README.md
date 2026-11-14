# Civitas Relay

**Your agent learns something. The right agents know it too.**

Share versioned, source-linked context between independently owned coding agents
through MCP. A website manages collaboration; a desktop companion connects local
agents. Built for HackPrinceton 2026.

The local demo supports password accounts, private spaces/invitations, separate
agent credentials with read/publish grants, immutable context versions, paginated
inboxes, explicit acknowledgements, and a live dashboard. An Electron companion
links agents and prints MCP configuration. PostgreSQL persistence works locally.
The Deep Agents runner is implemented; real model analysis needs a provider key.
Hosted Tiger Cloud verification and independent coding-model adaptation remain
pending. This is a loopback hackathon demo, not a deployed public service.

- [Design](docs/product.md): product, stack, prize strategy, and demo.
- [Work plan](docs/work-plan.md): current implementation, verified flows, and external blockers.
- [Agent instructions](AGENTS.md): short development rules.
- [Deep Agents runner](apps/change-analyst/README.md): analysis, review, and MCP publication.

## Layout

```text
apps/relay           Fastify API + database
apps/web             Next.js dashboard
apps/change-analyst   LangChain Deep Agents publisher
apps/desktop         Electron agent companion
packages/contracts   Shared schemas/types
packages/client      HTTP client
packages/cli         Local CLI/MCP bridge
```

## Run the relay

Use Node.js 22.12+ and npm 10+. The default setup uses memory; no database is needed.

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
disappear on restart.** Account identities, invitations, grants and dispositions
are also temporary in memory mode. Existing `.env` files should set this explicitly if no
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
immutable versions, subscriptions, retry keys, deliveries, dispositions,
accounts, grants, invitations, sessions, and first retrieval timestamps survive relay
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
The authenticated `GET /v1/spaces/:spaceId/analytics` route uses `time_bucket` to
return per-minute counts and mean/p50/p95 latency by transition kind. Optional
`from`/`to` timestamps select a range up to seven days; default is the last hour.
Latency runs from server publication to delivery or first inbox retrieval, includes
polling delay, and does not prove model comprehension or useful action. Telemetry
contains IDs/timing, not context bodies. Disabled analytics returns 503.

**Verified:** real PostgreSQL publish/retrieve, concurrent retries across two relay
processes, rollback on fanout failure, space isolation, and persistence after
relay and database restarts, including two real MCP bridge processes.
**Also verified locally:** TimescaleDB 2.32.0 in the official Docker image; migration
reruns, historical backfill, actual time buckets/latencies and restart persistence.
A two-event walkthrough measured 4 ms live delivery and 272 ms first retrieval,
including an intentional 250 ms polling wait. These are local demo observations,
not a benchmark. **Pending:** actual Tiger Cloud connection and hosted TLS/analytics.
Neither vanilla PostgreSQL nor a local Timescale container proves hosted Tiger use.

## Run the website

Keep the relay running, then in another terminal:

```sh
npm run build:web
npm run start:web
```

Open `http://127.0.0.1:3000` for the landing page, then **Open relay**
(`/relay`) for the live dashboard. Connect using the private `CIVITAS_AGENT_TOKEN` value
from one generated agent env file. Use a separate browser profile/incognito session
and the other key to demonstrate a second participant. `npm run dev:web` runs the
website in development mode instead.

Subscribe the receiver to `project/maintenance-api`, publish from the other session,
and retrieve the receiver's inbox. The feed polls real activity every three seconds.
The web server keeps credentials in temporary HttpOnly sessions, not browser storage.
Alternatively choose **Sign up** on `/` to create a local password account,
or log in to an existing one. Use `/settings` to create a space and link an agent. Save its one-time private env download, grant read/publish
access, then open the relay as that agent. Invite a collaborator by email and share
the invitation token privately; the accepting account must use that email. No mail
is sent and emails are not verified. A space owner grants access to a member's
agent ID. Disable both permissions to revoke access. Password recovery is unavailable.
Web restart disconnects browser sessions; sign back in to your persisted account
when using PostgreSQL. An existing agent key can reconnect with its space ID.
Read-only agents cannot publish; all access is enforced by the relay.

## Run the MCP bridge

```sh
npm run build:bridge
node --env-file=.local/receiver.env packages/cli/dist/index.js
```

Use `.local/publisher.env` for a separate publishing process. The bridge exposes `publish_context`, `subscribe`, `get_updates`, and
`acknowledge_update`; stdout is MCP protocol traffic.
For manual Claude Code integration, set the corresponding private env variables
in your shell and add the built bridge without replacing other MCP entries:

```sh
claude mcp add --scope local --transport stdio civitas -- node /absolute/path/to/civitas/packages/cli/dist/index.js
```

For guided, additive configuration without overwriting existing MCP servers:

```sh
node packages/cli/dist/index.js configure claude .local/receiver.env
node packages/cli/dist/index.js configure codex /absolute/path/private-agent.env
node packages/cli/dist/index.js configure json /absolute/path/private-agent.env
```

The helper prints commands/config referencing the private env file, never its token.
Use a different server name if `civitas` already exists. An actual Claude Code
receiver attempt failed before tool calls because its OAuth session expired; run
`claude auth login` privately before retrying. Three distinct admitted identities
have retrieved the same event through real MCP processes and run the local
consumers. These transport runs do not prove independent coding-model adaptation.

## Relay interface

Shared ESM schemas/types are exported from `@civitas/contracts` after its build.
Use a different agent env file per MCP process. Send bearer auth on these routes:

| Route | Body/result |
| --- | --- |
| `POST /v1/spaces/sp_demo/subscriptions` | `{ topic }` → `Subscription` |
| `POST /v1/spaces/sp_demo/contexts` | `PublishContextInput` → `ContextEvent` |
| `GET /v1/spaces/sp_demo/updates?limit=20&cursor=...` | `UpdatesPage` |
| `POST /v1/spaces/sp_demo/updates/:deliveryId/ack` | `{ status: "acknowledged" \| "dismissed" }` → `AckRecord` |
| `GET /v1/spaces/sp_demo/activity` | Authenticated `ActivitySnapshot` for the dashboard |
| `GET /v1/spaces/sp_demo/analytics` | Per-minute Timescale transition counts and latency; opt-in |

Subscribe before publishing. Topics match exactly. Publish requires `topic`,
`title`, `content`, `source: { uri, revision, excerpt? }`, and `idempotencyKey`.
Identical retries return the same event; changed bodies under that key return 409.
Append a version with `contextId` and `expectedVersion` together, plus a new retry
key. Only the original publishing agent can append, and the topic remains fixed.
A stale expected version returns 409. Each version is immutable and creates its own
delivery; an identical retry returns the original event even after newer appends.
MCP uses the same `contextId`/`expectedVersion` names and `idempotency_key`.

Inbox reads replay deliveries without acknowledging them. `limit` defaults to 100
(maximum 100). Follow `nextCursor` until null; a cursor freezes the original range
so later publications appear on a new first-page poll. Only returned deliveries
record first retrieval. Acknowledgement/dismissal is explicit, scoped to the caller's
delivery, and final: retries preserve the first timestamp; switching disposition
returns 409. MCP `acknowledge_update` takes `space_id`, `delivery_id`, and `status`.
Wildcards remain unsupported. `/readyz` reports actual storage/durability/analytics.

Account routes use account-session bearer credentials; data routes require agent
credentials. `POST /v1/accounts/register|login` returns a session, `GET /v1/account`
returns owned agents/spaces/grants, and `POST /v1/accounts/logout` revokes that session.
Creation routes are `POST /v1/spaces`, `/v1/agents`, `/v1/spaces/:spaceId/invites`,
`/v1/invites/accept`, and `/v1/spaces/:spaceId/grants`. Passwords use scrypt;
random session/agent/invitation credentials are stored hashed. Session lifetime is
seven days; invitations expire after 24 hours and acceptance is retry-safe.

## Desktop companion

```sh
# Electron's native runtime is a separate download in current Electron packages:
npm exec --workspace @civitas/desktop -- install-electron
npm run build:desktop
npm run start:desktop
```

Sign in with an account created on the website and create/link an agent in a space
you own, or link an existing agent key and space ID. Refresh space activity, subscribe,
retrieve your inbox, print MCP configuration, and open the website. The companion
uses the shared HTTP client and existing MCP bridge; received text never executes.
Agent persistence uses Electron safeStorage when an encrypted OS backend exists.
Account sessions stay in memory. **Set up MCP** explicitly writes a mode-0600 env
file under the app's user-data directory and prints configuration referencing it.
**Disconnect and forget key** removes that local file and encrypted key; it does
not revoke the agent's server grants. Revoke those on the website when needed.
Desktop build/native launch passed; native interactions remain unverified because
computer-use access was denied. Browser visual inspection was also unavailable.

## Maintenance demo and two-minute walkthrough

```sh
npm run demo:consumers
```

Open `http://127.0.0.1:4100`: switch between the synthetic maintenance-v1/v2
fixtures. P1 stays urgent in SDK decoding, triage presentation and dispatch routing;
unknown codes require manual review. These are checked-in local adapters, not live
customer systems. See [consumer commands](examples/api-change/README.md) to subscribe,
select an event ID through a separate MCP process, and save a private source-linked
receipt. See [analyst commands](apps/change-analyst/README.md) for model analysis and
explicit terminal approval; do not describe a hand-written packet as model output.

1. **0:00–0:20:** Explain how separate coding agents can miss an API change. Show the
   two selected synthetic source revisions and the explicit P1 → urgent mapping.
2. **0:20–0:50:** Show a receiving agent's subscription. If a provider-backed analysis
   has actually run, review its evidence and approve publication. Otherwise clearly
   label the publication as a hand-authored transport demonstration.
3. **0:50–1:20:** Retrieve the selected event through independent admitted MCP
   identities; show source revision and retry deduplication in the dashboard.
4. **1:20–1:45:** Run the SDK, triage UI and dispatch decision. Both source revisions
   preserve urgent handling. Explain that these adapters are implemented examples;
   independent coding-model adaptation still needs a successful model session.
5. **1:45–2:00:** Show retained PostgreSQL history after restart and scoped access.
   Label local PostgreSQL/Timescale separately from hosted Tiger Cloud.

This is a prepared walkthrough; a timed, in-person team rehearsal remains pending.

## Submission preparation

**Draft description:** Civitas shares explicitly selected, source-linked discoveries
between separately credentialed coding agents. Private spaces and grants control
who can read and publish. Immutable versions, durable inboxes and retry-safe
publication make API changes visible across tools. Our synthetic maintenance demo
preserves urgent triage when a wire field changes from `priority` to `priority_code`.
The dashboard and companion manage collaboration; a reviewed Deep Agents analyst
can publish through MCP. Live model execution and hosted Tiger Cloud remain pending.

Checked November 14, 2026: the [official rules](https://hackprinceton-fall-26.devpost.com/rules)
require public GitHub source linked on Devpost, all members listed (maximum four),
framework attribution, and an in-person presentation up to two minutes. They allow
one main track plus sponsor tracks. The rules say **8:00 AM ET November 15** while
the site banner says 8:30; plan for 8:00 and confirm with organizers. The team must
confirm check-in, eligibility, creation-window requirements and originality. No
submission or publication was performed.

The [event page](https://hackprinceton-fall-26.devpost.com/) lists Business & Enterprise
and a Tiger Data prize. It says track winners cannot win Best Overall. Detailed
LangChain/Amazon/Peri/CoStar criteria and the sponsor interpretation of that exclusion
still require organizer confirmation. Tiger eligibility must not be inferred from
vanilla PostgreSQL. No real developer-feedback loop or customer endorsement is claimed.

Our contributions are the contracts, authorization/routing/storage, client/MCP bridge,
dashboard, companion, reviewed analyst workflow and synthetic consumers. They build
on [TypeScript](https://www.typescriptlang.org/), [Fastify](https://fastify.dev/),
[Next.js](https://nextjs.org/), [React](https://react.dev/),
[PostgreSQL](https://www.postgresql.org/), [TimescaleDB](https://github.com/timescale/timescaledb),
[Zod](https://zod.dev/), [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk),
[LangChain/Deep Agents](https://github.com/langchain-ai/deepagentsjs), and
[Electron](https://www.electronjs.org/). The companion uses Electron's
[context isolation guidance](https://www.electronjs.org/docs/latest/tutorial/context-isolation/).
Document AI assistance accurately in the submission; the team must review and explain
its code. License/public package naming and signed installers remain undecided.
For a local source/self-host handoff without secrets or build artifacts, run:

```sh
mkdir -p .local
git archive --format=tar.gz --output=.local/civitas-local-source.tar.gz HEAD
```

Extract it, then follow the install/setup/build instructions above. This is a source
bundle requiring Node/npm, not a signed desktop installer or published npm package.
No release pipeline, cloud deployment or GitHub publication is included.
