# Local development

## Current state

This is a workspace and documentation scaffold. There are no runtime dependencies,
application servers, migrations, generated types, or MCP integrations yet. Empty
workspace manifests reserve boundaries without pretending implementation exists.

## Prerequisites and setup

Use Node.js 22+ and npm 10+. `.nvmrc` selects the Node 22 major for developers using
nvm. Docker with Compose is needed only when starting PostgreSQL.

```sh
nvm use
npm install
cp .env.example .env
npm run check
docker compose up -d db
docker compose ps
```

`nvm use` is optional if you manage Node another way. Do not overwrite an existing
`.env`; merge new keys from the example instead. Root `.env` is read by Compose;
runtime apps must implement and document their own explicit environment loading.

The database image is PostgreSQL 16, with a named local volume and a localhost-only
port. Credentials in the example are intentionally local development values.
Nothing creates application tables yet. Use `docker compose stop db` to stop the
database while retaining data. `docker compose down` removes containers and keeps
the named volume. Do not delete volumes holding work you need.

## Commands available now

| Command | Purpose |
| --- | --- |
| `npm install` | Resolve the private, dependency-free workspace scaffold |
| `npm run check` | Check JSON, workspace manifests, and relative Markdown file links |
| `docker compose config --quiet` | Validate Compose configuration |
| `docker compose up -d db` | Start local PostgreSQL |

There is no `dev`, `build`, `lint`, `typecheck`, or application `test` command yet.
Add real scripts when implementing each workspace; do not add passing stubs.
The repository check does not validate Markdown anchors, TypeScript, or behavior.

## Shared Tiger Data and analyst setup plan

The selected shared deployment is Tiger Cloud, not a second MongoDB store.
The existing Compose file intentionally remains vanilla PostgreSQL for portable
relay development. It cannot execute Timescale migrations or prove sponsor use.
After core migrations exist, add separate extension migrations and run integration
checks on the actual Tiger service. See [the ADR](decisions/0001-tiger-data.md).

When provisioning is authorized, configure a server-only `DATABASE_URL` using the
service's TLS connection details and least-privilege roles. Select deployment
config explicitly; do not commit or print the URI. The analytics flag in the env
example is planned, not wired up. A Tiger deployment should fail startup if its
required Timescale features/migrations are missing rather than silently faking data.

The `apps/change-analyst` workspace will install the real TypeScript Deep Agents
SDK and compatible MCP/model packages. No packages or runner commands exist yet.
Choose a tool-calling model, document its provider key in the example only when
implemented, and keep real keys outside prompts and traces. Use bounded per-run
fixtures. Verify plan/delegation/file/review behavior against the pinned SDK.

The `apps/desktop` workspace is also a placeholder. Select its shell separately;
share bridge/client code and verify one OS before spending time on release assets.
See [surfaces](product-surfaces.md) for the website/desktop/download priority order.

## Configuration plan

`.env.example` documents the local database and intended relay/web settings.
Only the PostgreSQL variables are consumed by the current Compose scaffold.
`DATABASE_URL`, relay host/port, and web origins become active when runtime config
is implemented. Validate required settings on startup and fail with useful,
redacted errors. Browser-visible variables may contain only public values.

Agent credentials belong outside the repository; do not put a real bearer token in
`.env.example` or a committed MCP config. Provider authentication variables should
be added only after the login decision is made.

## Adding the first implementation

1. Record auth, database tooling, and package/build decisions in an ADR.
2. Add runtime schemas and topic matching in `packages/contracts`.
3. Add migrations and an authenticated relay slice with PostgreSQL tests.
4. Add client transport and CLI/MCP adapters over the same contract.
5. Add the Deep Agents investigation and reviewed publication through MCP.
6. Add the dashboard and Tiger analytics using real data, with honest states.
7. Add minimal desktop UI over the bridge; defer GitHub release packaging.

Install dependencies into their owning workspace, for example
`npm install <dependency> --workspace @civitas/relay`. Keep shared tooling at the
root when appropriate. Commit `package-lock.json` for reproducible installs and
switch CI to `npm ci` when introducing dependencies. The dependency-free scaffold
has no generated lockfile yet.
Select and document actual versions when introducing a library; the design doc's
technology names are not pinned implementation requirements.

## Troubleshooting

- If port 5432 is occupied, change `POSTGRES_PORT` and the port in `DATABASE_URL`.
- Changing `POSTGRES_USER`, `POSTGRES_PASSWORD`, or `POSTGRES_DB` after first boot
  does not modify an existing database volume. Use a database migration/admin
  action or an explicitly disposable fresh volume.
- If a workspace command is missing, check its README; most workspaces are planned.
- If a doc link check fails, fix the path relative to the document containing it.
- Cross-machine clients must use a reachable TLS relay URL, not `localhost` on a
  teammate's machine. Keep PostgreSQL private.
