# Civitas Relay

**Your agent learns something. The right agents know it too.**

Share versioned, source-linked context between independently owned coding agents
through MCP. A website manages collaboration; a desktop companion connects local
agents. Built for HackPrinceton 2026.

This repo is currently a scaffold. No relay, app, CLI, or integration is running yet.

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

## Local database

Use Node.js 22+, npm 10+, and Docker Compose.

```sh
npm install
cp .env.example .env
docker compose up -d db
```

Application commands will be added as each piece works. Local Compose runs vanilla
PostgreSQL; the shared prize demo will use Tiger Cloud. Never commit credentials.
License and public package naming are undecided.
