# Build plan

Build the real flow. No new tests, lint/check pipelines, CI, or release automation.

## Sections

| Order | Deliverable |
| --- | --- |
| **1** | Persistent relay + HTTP client + MCP: one agent publishes v1/v2, another retrieves them |
| **2** | Website/onboarding: accounts, invitations, linked agents, spaces, activity |
| **3** | Deep Agents analyst: investigate → delegate → evidence → review → publish |
| **4** | Maintenance demo + Tiger Cloud activity/latency charts; show useful code/UI changes |
| **5** | Minimal desktop companion over the bridge: sign-in/link/status/open website |
| **6** | Customer feedback, track submissions, two-minute rehearsal |
| **Later** | GitHub downloadable releases, installers, polish |

Talk to a real user and confirm sponsor rules alongside the build. Keep Deep Agents
and the working cross-owner demo ahead of desktop polish.

## Section 1A — Person A's agent: relay + contracts

**Own:** `apps/relay/`, `packages/contracts/`, root manifests/lockfile/build config,
`.env.example`, Compose. Do not edit Person B's client or CLI packages.

1. Set up minimal TypeScript/ESM builds and shared runtime schemas/types. Share
   exports early so B can consume them; choose simple SQL migration tooling.
2. Add PostgreSQL tables for accounts, agents, space membership/grants, hashed
   credentials, contexts/versions, subscriptions, and deliveries.
3. Add a local bootstrap command creating two synthetic accounts/agents and a
   private space. Generate tokens and hand them off privately. No open bootstrap
   HTTP endpoint; public account sign-in comes in section 2.
4. Implement bearer identity, space authorization, and the endpoints below.
5. Persist immutable versions and transactional fanout. Same key/body retries reuse
   the event; stale versions conflict; overlapping subscriptions don't duplicate
   delivery. Polling preserves inbox history. Recheck access at retrieval time.
6. Document commands to build, migrate, bootstrap, and run. Reconcile root
   dependencies/lockfile after B's package manifests are merged.

**Done:** real PostgreSQL-backed relay works with B's MCP bridge, including v1/v2
retrieval after restart. No fake or in-memory persistence in the demo path.

## Section 1B — Person B's agent: client + MCP

**Own:** `packages/client/`, `packages/cli/`, their manifests and runnable instructions.
Do not edit relay, contracts, root config, or lockfile; request shared changes from A.

1. Start transport and tool adapters against the interface below while A builds
   the relay. Consume A's shared schemas once exported. Temporary fixtures must be
   labeled and removed from the default runtime before integration.
2. Export `createCivitasClient({ baseUrl, token })` with `publishContext(spaceId, input)`,
   `subscribe(spaceId, input)`, `getUpdates(spaceId, input?)`, and
   `ackUpdate(spaceId, deliveryId, input)`.
3. Implement MCP stdio tools `publish_context`, `subscribe`, `get_updates`,
   `ack_update`. Adapt snake_case arguments to camelCase HTTP JSON.
4. Read `CIVITAS_RELAY_URL` and `CIVITAS_AGENT_TOKEN`; one process is one identity.
   Missing config fails clearly. Never log tokens; protocol stdout stays clean.
5. Preserve retry keys and server errors; do not auto-acknowledge polling results.
   Add bounded HTTP timeouts and honest disconnected/error behavior.
6. Document real build/start commands and guided setup for one installed coding
   tool. Preserve existing provider config. No npm publication or installer work.

**Done:** two independently configured agent sessions subscribe, publish, retrieve,
and acknowledge through the real relay. No mock success fallback.

## Shared interface — agree before diverging

TypeScript/ESM, camelCase JSON, opaque string IDs, server ISO UTC timestamps.
A owns shared runtime schemas and exports inferred types with these names:

| Type | Shape |
| --- | --- |
| `PublishContextInput` | `topic, title, content, source, idempotencyKey`; optional `contextId, expectedVersion, change, tags` |
| `ContextEvent` | Publish fields except retry/precondition fields, plus `schemaVersion: 1, eventId, contextId, spaceId, version, previousVersion, publisherAgentId, publishedAt` |
| `SubscribeInput` / `Subscription` | Input `{ topic }`; result adds `subscriptionId, spaceId, agentId, createdAt` |
| `GetUpdatesInput` / `UpdatesPage` | Input optional `cursor, limit`; result `{ items: Delivery[], nextCursor: string or null }` |
| `Delivery` | `deliveryId, event: ContextEvent, deliveredAt, acknowledgedAt` (nullable), `status` (`pending`, `acknowledged`, `dismissed`) |
| `AckUpdateInput` / `AckRecord` | Input `{ status: acknowledged or dismissed }`; result adds `deliveryId, acknowledgedAt` |
| `ApiError` | `{ error: { code, message, requestId } }` |

`source = { uri, revision, excerpt? }`; optional `change = { kind, breaking,
previous?, current? }` contains JSON before/after values; `tags` is a string array.
Export schemas as `<TypeName>Schema`, plus `topicMatches(pattern, topic)`.
Create omits `contextId/expectedVersion`; append requires both. First version is 1
with `previousVersion: null`. Preserve topic across versions. Retry keys are scoped
to agent + space. Event responses omit `idempotencyKey` and `expectedVersion`.

Topics use lowercase letters/digits/`-`/`_` in nonempty slash-separated segments.
An exact subscription matches itself; terminal `project/*` matches descendants,
not bare `project`. Cap topics at 128 chars and publish bodies at 64 KiB.

All routes except health/readiness need `Authorization: Bearer <agent token>`.
Actor identity comes from the token; space access comes from current membership/grant.

| Route | Input → direct response (no wrapper) |
| --- | --- |
| `GET /healthz` | `200 { status: "ok" }` |
| `GET /readyz` | `200 { status: "ready" }` if DB reachable; otherwise 503 |
| `POST /v1/spaces/:spaceId/contexts` | `PublishContextInput → 200 ContextEvent` |
| `POST /v1/spaces/:spaceId/subscriptions` | `SubscribeInput → 200 Subscription` |
| `GET /v1/spaces/:spaceId/updates` | Query `cursor?, limit? → 200 UpdatesPage` |
| `POST /v1/spaces/:spaceId/updates/:deliveryId/ack` | `AckUpdateInput → 200 AckRecord` |

Publish retries and existing subscriptions also return 200. Changed body with a
reused key or stale version returns 409. Repeated same acknowledgement returns
its original record; changing a terminal acknowledgement returns 409. Missing or
invalid auth is 401, inaccessible objects 404, forbidden publish 403, bad input 400.
Default inbox page size 50, max 100. Opaque cursors must be agent/space-bound and
safe under concurrent commits; polling doesn't delete or acknowledge deliveries.

## Working together

Start from the same committed scaffold on separate branches/clones. A owns shared
files; B can build transport/tool wiring immediately. Don't run concurrent installs
in one checkout. Coordinate interface changes instead of independently guessing.

Bring up the DB/relay, bootstrap identities, and start two MCP processes. Subscribe
one to `project/maintenance-api`; publish/retrieve v1 then v2. Restart and retrieve
persisted inbox data. An unrelated identity must not read the space. Fix blockers
in this real walkthrough, then move to section 2. Record actual commands in README
as code lands. Local bootstrap is not finished public onboarding.
