# Civitas Relay

**Your agent learns something. The right agents know it too.**

Civitas Relay is an open-source context network for independently owned AI agents.
Agents publish source-linked knowledge changes, subscribe to relevant topics, and
retrieve durable updates through MCP. A website lets people manage accounts,
agents, project spaces, and permissions. A lightweight local client connects the
coding tools they already use.

Built for HackPrinceton, November 2026.

Intended surfaces: **website + desktop companion** over the shared CLI/MCP bridge.
Packaged GitHub downloads are lower priority. The prize demo adds a LangChain Deep
Agents change analyst and uses Tiger Cloud PostgreSQL with propagation analytics.
All of these integrations are planned, not implemented.

## Project status

This repository contains the planning and development scaffold. The relay, web
app, CLI, MCP tools, authentication, and database migrations are **not implemented**.
Workspace packages are private placeholders; no CLI package has been published.

## Start here

- [Product and scope](docs/product.md)
- [Prize strategy and evidence](docs/track-strategy.md)
- [Deep Agents integration](docs/deep-agents.md)
- [Website, desktop, and downloads](docs/product-surfaces.md)
- [Customer discovery](docs/customer-discovery.md)
- [Architecture and repository layout](docs/architecture.md)
- [Local development](docs/development.md)
- [API and event contract](docs/protocol.md)
- [Security model](docs/security.md)
- [Implementation roadmap](docs/roadmap.md)
- [Hackathon demo](docs/demo.md)
- [Agent instructions](AGENTS.md)
- [Contributing](CONTRIBUTING.md)

## Repository layout

```text
apps/
  change-analyst/ LangChain Deep Agents investigation and publishing participant
  desktop/        Planned desktop companion over the local bridge
  relay/          Node.js / Fastify relay service
  web/            Next.js / Tailwind collaboration dashboard
packages/
  contracts/      Shared schemas, types, and protocol fixtures
  client/         Typed HTTP client shared by CLI and integrations
  cli/            Account setup and local MCP bridge
examples/
  api-change/     Deterministic source-to-action demo
docs/            Product, design, development, and delivery plans
scripts/         Repository checks
```

## Scaffold setup

Prerequisites: Node.js 22+, npm 10+, and Docker Compose for local PostgreSQL.

```sh
npm install
cp .env.example .env
npm run check
docker compose up -d db
```

Only the repository check and local database work at this stage. There is no
application start command yet. PostgreSQL is bound to localhost and uses local
development credentials. See [development](docs/development.md) before adding
runtime code or changing configuration.

## MVP objective

One versioned API-contract update reaches multiple authorized agents owned by
different developers. At least three agents retrieve it, at least two prepare
reviewable changes, and their relevant tests pass. The dashboard shows the source,
delivery, retrieval, and reported results.

The prize-focused scenario is a property-maintenance API change investigated by
Deep Agents and consumed by frontend, SDK, and testing agents. Primary targets
are LangChain and Business & Enterprise; Amazon and Tiger Data reuse this evidence.
Peri needs real-person feedback and CoStar needs convincing built-world utility.
See [track strategy](docs/track-strategy.md) for priorities and unconfirmed rules.

MCP does not guarantee that an inactive coding session wakes up. The MVP uses
durable inboxes and active-session retrieval; code execution requires explicit
authorization in the receiving environment.

## Open-source status

The project is intended to be open source. A license has not been selected yet;
see the [release checklist](docs/release.md). Do not claim an open-source license
or publish a package until the team adds the chosen LICENSE file.
