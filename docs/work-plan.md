# Build plan

Build the real flow. No new tests, lint/check pipelines, CI, or release automation.
Agents must update this file when features land: what works, what actually ran,
and what is still missing. Keep one current plan rather than adding documents.

## Current status

| Section | Status | Remaining |
| --- | --- | --- |
| **1A: relay + contracts** | Working memory/PostgreSQL relay, transactional fanout, persistent inboxes, shared schemas and private credentials | Real Tiger Cloud verification; version appends, acknowledgements and pagination deferred |
| **1B: client + MCP** | Integrated with 1A through two real MCP SDK processes | Verify in actual Claude Code/Codex model sessions; guided config |
| **2: website/onboarding** | Working local demo dashboard | Public account sign-in, invites, agent linking/grants UI |
| **3: Deep Agents analyst** | Runner, specialists, evidence validation and reviewed MCP publication implemented; transport exercised with a labeled hand-written packet | Real provider credential, model planning/delegation run, evidence review and model-generated publication |
| **4: domain demo + Tiger Data** | Synthetic maintenance fixtures and local PostgreSQL persistence verified; Timescale migration/route implemented | Independent code/UI adaptation, combined model-to-durable-inbox demo, real Tiger Cloud telemetry and measured timings |
| **5: desktop companion** | Not started | Minimal sign-in/link/status/open-web over the bridge |
| **6: submission** | Ranked track strategy recorded in product doc | Focus Business and Enterprise + LangChain; reuse demo for Amazon/Tiger; Peri conditional, CoStar stretch; confirm sponsor rules/award compatibility and rehearse |
| **Later: GitHub downloads** | Low priority | Installer/CLI/self-host release assets; public source repo is separate |

## Remaining tasks — completion order

These are unfinished tasks, not evidence of completed integrations. Preserve the
A/B ownership below; coordinate client, CLI, website and contract changes before
editing outside those lanes.

### 1. Complete the real Deep Agents run — Person A

- [ ] Supply a provider credential privately (`OPENAI_API_KEY` or
  `ANTHROPIC_API_KEY`); never put it in git, evidence files or shared context.
- [ ] Run the analyst on the supplied maintenance fixtures. Verify actual planning,
  contract/impact delegation, evidence files and schema-valid output. Fix runtime
  blockers in A's package; graph construction alone does not complete this task.
- [ ] Review the model-generated packet/evidence in the terminal, approve it, publish
  through MCP, and retrieve the same event from a separate receiver process.
- [ ] Retry the approved checkpoint and confirm the same event and one delivery.
  Record what actually ran in A's status.

**Current blocker:** no provider credential was available during the recorded run.

### 2. Integrate the durable demo — A + B

- [x] Reconciled the root lockfile with A's declared dependencies; a clean
  `npm ci --ignore-scripts` and bridge, relay, website and analyst builds passed.
- [ ] Run the relay in PostgreSQL mode; subscribe the receiver before A publishes
  its real model-generated packet to `project/maintenance-api` in `sp_demo`.
- [ ] Retrieve through a separate MCP process and show the same event in the web
  dashboard. Restart the relay and confirm the saved event and retry identity.
- [ ] Record this combined walkthrough here. Existing PostgreSQL and transport
  walkthroughs were separate; neither proves this combined model flow yet.

### 3. Demonstrate useful receiving-agent work — coordinated ownership

- [ ] Connect the bridge to actual Claude Code/Codex model sessions using separate
  admitted identities. Record which tools and sessions really ran.
- [ ] Have independent receiving agents consume the selected packet and produce
  reviewable consumer changes for `priority_code: "P1"` → urgent priority.
  Aim for three recipients and at least two useful changes, as in the design.
- [ ] Run the adapted consumer/UI flow and show that urgent maintenance remains
  urgent. Show source revisions and resulting changes; retrieval alone is not
  evidence of useful adaptation.

A owns fixture/consumer work under `examples/api-change/**`. Coordinate any new
receiver identities or relay configuration with B and any website work with its
owner; do not redesign the dashboard as a prerequisite.

### 4. Complete Tiger Cloud verification — Person B

- [ ] Obtain an actual Tiger Cloud PostgreSQL service with TimescaleDB and privately
  configure its connection URI/required CA. Provisioning remains outstanding;
  this checklist does not authorize deployment or cloud resource creation.
- [ ] Run core and Timescale migrations with analytics enabled against that service;
  verify the hosted TLS connection and truthful readiness/storage metadata.
- [ ] Publish, deliver and retrieve real events, then query the authenticated,
  space-scoped analytics route for time buckets and measured latency. Confirm
  restart persistence on the hosted service and record actual results.

**Current blocker:** no Tiger Cloud database is available. Local PostgreSQL works;
Timescale execution, hosted TLS and hosted analytics remain unverified. Report
latency as publication-to-delivery/retrieval, including polling delay.

### 5. Finish the submission story — team

- [ ] Rehearse a two-minute source change → analysis → approval → MCP publication
  → independent adaptation → durable dashboard history demonstration.
- [ ] Confirm current submission requirements, sponsor criteria and award
  compatibility with organizers. Focus Business and Enterprise + LangChain;
  reuse verified evidence for Amazon/Tiger where eligible.
- [ ] Prepare required submission materials with accurate setup steps and explicit
  labels for synthetic fixtures, recordings and unfinished features.
- [ ] If pursuing Peri, obtain real developer feedback, change a feature in response,
  and have that developer try it. If pursuing CoStar, demonstrate a meaningful
  property workflow benefit. Neither evidence is currently documented.

### Queued after the core demo

- [ ] Public accounts, space invitations and agent linking/grants UI.
- [ ] Desktop companion: minimal sign-in/link/status/open-web over the bridge.
- [ ] Guided MCP configuration; immutable version appends, acknowledgements and
  pagination (current inbox reads replay deliveries).
- [ ] Installer/CLI/self-host download packaging, only after higher priorities.

These queued features are outside the current A/B implementation assignments.
No deployment, publication, new test suite or release automation is part of this
local completion plan.

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
- After A/B merged, reconciled the analyst dependencies into the root lockfile.
  A clean `npm ci --ignore-scripts` and relay/bridge/analyst/website builds passed.
  The merged code published and retrieved a synthetic event through two separate
  MCP processes; retries returned one event and one delivery. Model analysis and
  hosted Tiger verification remain pending their credentials/services.
- Local PostgreSQL 16 walkthroughs verified transactional fanout, concurrent
  retries across two relay processes, rollback on fanout failure, space isolation,
  migration reruns and persistence after relay/database restarts through real MCP.
- Analyst/bridge/relay builds passed. The Deep Agents graph constructed offline;
  analysis failed closed without a provider key. A labeled hand-written packet
  exercised terminal rejection, approval, real MCP publication/retrieval and retry
  deduplication. No live model analysis or consumer adaptation ran.
- This plan refresh reconciles those recorded results; it does not represent a
  new execution of the feature flows.

## Working website slice

Next.js at localhost:3000, connecting to the relay at localhost:4000. An existing
agent key opens a private server-side session. The dashboard shows real events,
subscriptions, admitted identities, deliveries, and first retrievals. It supports
publishing context, subscribing, retrieving the current inbox, and disconnecting.

This is local demo-key access, not completed public accounts/onboarding. API
activity does not prove a coding model is active; retrieval does not prove useful
work. Website sessions are temporary and disconnect on web restart. Relay events
and subscriptions disappear on restart in explicit memory mode; PostgreSQL mode
persists them and has been exercised locally. Real Tiger Cloud/Timescale results
remain unverified.

## Active assignments — two people

Continue from the latest integrated code on separate branches/clones, preserving
the ownership below. The dashboard and portable PostgreSQL storage have merged;
the current `feat/deep-agents` branch also contains A's runner. The root lockfile
has been reconciled and clean installation/builds verified. The original
assignment briefs below describe scope;
the status entries and completion checklist above describe what remains.

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

**A status:** Runner implemented on `feat/deep-agents`; real model execution is
pending a privately supplied `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (neither was
present in the shell or local env files). Added bounded synthetic before/after and
consumer fixtures with the explicit P1 → urgent mapping. The TypeScript Deep Agents
runner configures todo planning, contract/impact specialists, read-only virtual
fixtures, evidence files, and shared-schema structured output. It checks required
plan/delegation tool calls and evidence before saving a private review checkpoint.
A separate interactive review command displays the packet/evidence and publishes
only after the exact terminal approval, using the existing MCP bridge. Checkpoints
retain the exact packet, target space, and stable run retry key across restarts;
mid-analysis crash recovery is not implemented. Commands and credential setup are
in `apps/change-analyst/README.md`; dependencies/scripts are confined to A's package.
Actual execution: `npm run build:bridge`, `npm run build:relay`, and
`npm run build -w @civitas/change-analyst` passed. The real Deep Agents graph
constructed offline with planning, specialists, permissions, and structured output;
this does not prove model planning or delegation ran. `analyze` explicitly failed
closed without a model key. A **hand-authored, labeled transport-only packet** ran
through an isolated real in-memory relay: receiver MCP subscription, terminal
rejection (empty inbox), approval → MCP publication, and separate receiver MCP
retrieval all worked. A second approved review returned the identical event with
one inbox delivery. Noninteractive review was rejected. No model-generated packet,
live specialist analysis, consumer adaptation, or Tiger durability is claimed.
Remaining: run analysis with a real provider credential, review its evidence, and
publish/retrieve that model-generated packet. A originally left the root lockfile
unchanged and used installs with `--package-lock=false`; subsequent integration
reconciled it and verified a clean install/build, as recorded above.

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
  its own package manifest. The integrated root lockfile is reconciled; keep it
  current for dependency changes and do not run concurrent installs in a shared checkout.
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
