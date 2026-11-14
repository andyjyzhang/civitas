# Build plan

Build the real flow. No new tests, lint/check pipelines, CI, or release automation.
Agents must update this file when features land: what works, what actually ran,
and what is still missing. Keep one current plan rather than adding documents.

## Current status

| Section | Status | Remaining |
| --- | --- | --- |
| **1A: relay + contracts** | Working local in-memory relay, shared schemas, private credential setup | PostgreSQL/Tiger persistence, version appends, acknowledgements, pagination |
| **1B: client + MCP** | Integrated with 1A through two real MCP SDK processes | Verify in actual Claude Code/Codex model sessions; guided config |
| **2: website/onboarding** | Working local demo dashboard | Public account sign-in, invites, agent linking/grants UI |
| **3: Deep Agents analyst** | Not started; primary sponsor feature | Plan, evidence files, contract/impact specialists, publication review, real MCP publish |
| **4: domain demo + Tiger Data** | Synthetic maintenance example only | Independent code/UI adaptation, real Tiger Cloud storage/telemetry, measured timings |
| **5: desktop companion** | Not started | Minimal sign-in/link/status/open-web over the bridge |
| **6: submission** | Main-track strategy recorded in product doc | Business and Enterprise entry; actual customer feedback, sponsor rules and award-stacking clarification, two-minute rehearsal |
| **Later: GitHub downloads** | Low priority | Installer/CLI/self-host release assets; public source repo is separate |

## What actually ran

- Relay compiled and served the real HTTP publish → subscribe → inbox flow.
- Two separate MCP SDK clients launched real bridge processes against that relay.
  One subscribed; the other published; the receiver retrieved the same event.
- Compatibility fix: client/CLI now use shared contracts and preserve `change` and
  `tags`. Same-key MCP retries returned the same event. No fixture server was used.
- HTTP invalid-token and inaccessible-space requests were denied. Changes under
  an existing publish key conflicted. These were live walkthroughs, not test suites.
- Website build succeeded. Two isolated browser sessions connected, subscribed,
  published, retrieved the matching delivery, and disconnected through the real UI.
  Live counters updated. Desktop/mobile layouts were inspected; mobile had no
  horizontal overflow. Public account/invitation flows were not exercised or built.

## Working website slice

Next.js at localhost:3000, connecting to the relay at localhost:4000. An existing
agent key opens a private server-side session. The dashboard shows real events,
subscriptions, admitted identities, deliveries, and first retrievals. It supports
publishing context, subscribing, retrieving the current inbox, and disconnecting.

This is local demo-key access, not completed public accounts/onboarding. API
activity does not prove a coding model is active; retrieval does not prove useful
work. Both website sessions and relay state are temporary. Restarting the relay
clears events and subscriptions. No Tiger Data/durability claim yet.

## Active assignments — two people

Start both agents from current `origin/main` (`c4b4ced` or newer), on separate
branches/clones. The 1A/1B integration fix and dashboard have now merged. Share
these assignments with both agents; do not start from an older local main.

### Person A — Deep Agents publisher

**Branch:** `feat/deep-agents`. **Own:** `apps/change-analyst/**` and
`examples/api-change/**`. This is the primary LangChain prize feature.

Give your agent this task:

> Implement a minimal real TypeScript Deep Agents runner. Read `docs/product.md`
> and use the existing contracts/MCP bridge. Add synthetic maintenance API fixtures:
> before `{ priority: "urgent" }`, after `{ priority_code: "P1" }`, with an explicit
> P1-to-urgent mapping. Run a plan, contract/impact specialists, and virtual evidence
> files. Produce a schema-valid context packet, display it for terminal approval,
> and publish through the existing MCP `publish_context` tool only after approval.
> Keep its idempotency key stable across retries. Use one admitted publisher identity;
> internal specialists are not independent network agents. Keep tools restricted to
> supplied fixtures and reviewed publication. Provide runnable package commands.
> Run it with an available model credential and show a real recipient retrieving
> the event. If no credential is available, complete the runner and state precisely
> that the model run is pending. Do not fabricate a successful analysis. No test
> suite, new planning docs, dashboard redesign, or relay changes. Update only A's
> status below with completed work, actual execution, and remaining blockers.

**First runnable target:** fixtures → model-generated candidate → terminal approval
→ existing relay via MCP. Add specialist/evidence depth next if the first pass is
slow. A single-prompt first pass is progress, not the completed Deep Agents target.

**A status:** Assigned, not started. Needs a model-provider key supplied privately;
no model key has been confirmed in this session. Dependencies belong in A's package.

### Person B — Tiger Data storage

**Branch:** `feat/tiger-storage`. **Own:** `apps/relay/**`, root config/lockfile,
`.env.example`, Compose. Keep the existing API and MCP bridge compatible.

Give your agent this task:

> Replace relay in-memory event/subscription/inbox storage with PostgreSQL when
> DATABASE_URL is configured. Preserve the existing demo identities, HTTP routes,
> response shapes, space access checks, and dashboard activity endpoint. Add small
> SQL migrations and startup commands. Make publish + fanout transactional, keep
> retry deduplication unique, and persist subscriptions, deliveries, and first
> retrieval timestamps. Prove a real published event survives relay restart. Then
> add Timescale activity storage and a per-space time_bucket analytics endpoint on
> a real Tiger Cloud connection. Keep core uniqueness constraints in normal tables.
> Return truthful storage/durability metadata; preserve an explicitly labeled
> memory mode if needed. Do not claim Tiger use from vanilla PostgreSQL alone.
> If Tiger credentials are unavailable, build/run the portable PostgreSQL slice
> and state the hosted integration blocker. No tests/CI, auth-provider work,
> desktop work, or new planning docs. Update only B's status below.

**First runnable target:** same API with restart-safe PostgreSQL data. Timescale
analytics follows persistence; do not delay the first working slice for charts.

**B status:** Portable PostgreSQL slice complete on `feat/tiger-storage`; this
supersedes the earlier memory-only status for B. Added transactional publish/fanout,
unique retry keys, persistent subscriptions/inboxes/first retrievals, explicit SQL
migrations (`npm run db:migrate`), verified remote TLS, truthful readiness/dashboard
storage labels, and separate opt-in Timescale hypertable + analytics route. Relay
and website builds passed. Live PostgreSQL 16 walkthrough: two relay processes
handled concurrent retries/polls without duplicate events or transitions; forced
fanout failure rolled back the whole publish; credentials and spaces stayed scoped.
Two real MCP bridge processes published/retrieved; the event and retry key survived
both relay and database restart. Migration reruns and explicit memory mode work.
No test suite was added. **Remaining:** user has no Tiger Cloud database; provision
one and run the Timescale migration/analytics flow there. Plain PostgreSQL correctly
rejects that migration without partial changes. Hosted TLS and real Timescale
results remain unverified; no cloud resource was provisioned. README has setup
commands. A's model-generated publication still needs the combined demo.

## Shared handoff and integration

- Freeze current publish/subscribe/get-updates shapes. A works against today's relay
  while B changes storage underneath it. No version append requirement in this round.
- A uses `sp_demo`, topic `project/maintenance-api`, and the generated publisher
  credential. Subscribe the receiver before publishing. Use real MCP processes.
- B owns root dependency/build/env changes. A declares dependencies and scripts in
  its own package manifest. Reconcile the root lockfile after merging; do not run
  concurrent installs in a shared checkout.
- One planned cross-file change: B may update `ActivitySnapshotSchema` storage
  metadata in `packages/contracts` and the corresponding memory labels in
  `apps/web/app/page.tsx`. Coordinate this narrowly; no dashboard redesign.
- Each agent edits only its status paragraph here, records commands/limitations,
  and commits its own branch. Do not rewrite the whole plan during parallel work.
- Integrate by publishing A's real candidate through MCP into B's relay, retrieving
  it from another process, restarting the relay, and showing the saved event in
  the dashboard. Fix blockers directly; no validation framework.

These are focused build slices, not guaranteed twenty-minute tasks. Get the first
runnable target working before expanding. Public onboarding, desktop, and download
packaging stay queued. Talk to the actual customer and confirm sponsor criteria
alongside development; no customer feedback has been documented yet.
