# Civitas Relay product brief

HackPrinceton MVP · November 2026 · Developer infrastructure

**Your agent learns something. The right agents know it too.**

## Problem and hypothesis

Independent coding agents maintain separate context. Teams repeat investigations,
manually relay discoveries, and produce incompatible work when assumptions change.
Shared documents, chat, and commits help people coordinate but do not ensure a
working agent discovers relevant new information.

Our hypothesis: developers will use a lightweight, provider-independent network
that shares compact, attributed knowledge changes across explicitly authorized
agents. Civitas emphasizes propagation, relevance, and version history. It does
not synchronize whole conversations or replace existing coding assistants.

## Users and primary workflow

The initial audience is small engineering teams, hackathon teams, open-source
contributors, and developers using multiple coding agents across repositories.

**Publish → Match → Deliver → Retrieve → Act**

1. An agent explicitly publishes a structured discovery, API change, bug fix,
   technical decision, or reusable pattern with supporting evidence.
2. The relay matches explicit topic subscriptions inside the same space.
3. Authorized subscribers receive durable inbox entries.
4. Active agents retrieve the source-linked update through MCP or the client.
5. Receiving agents assess impact and, within their own authorization, propose
   changes or report results. Retrieval and reported work are distinct events.

Prize-demo example: a property-maintenance API changes `priority: "urgent"` to
`priority_code: "P1"`. A LangChain Deep Agents analyst investigates approved source
revisions, delegates contract and impact checks, and publishes a reviewed packet.
Independent frontend, SDK, and testing agents prepare compatible changes. A working
triage UI shows why accurate priority handling matters beyond a developer graph.
This is a synthetic workflow pending user feedback, not a CoStar integration.

The enterprise value is fewer stale assumptions and less manual coordination across
repositories and tools. Measure observed task time and verified compatibility;
do not claim enterprise adoption or savings before testing with users.

## Connected experiences

The website is the human-facing hub: account sign-in, multiple linked agents,
invite-based project groups, agent status, subscriptions, shared context history,
and visible delivery and retrieval activity. Group spaces are the MVP social
primitive; a separate friends graph and rich chat can wait.

The desktop companion is the intended local experience: sign in, link agents,
review guided MCP setup, select spaces, see connection/inbox status, and open the
website for shared history. Build it over the lightweight CLI/MCP bridge, which
can function before the desktop UI is complete. Both use the same account. Neither
is a model or a replacement coding assistant.

The website and desktop app are product goals. A minimal desktop shell follows the
working relay and analyst proof. GitHub downloadable release assets (installers,
standalone CLI, or self-host bundles) are lower-priority distribution. A public
source repository remains necessary for submission. See [surfaces](product-surfaces.md).

Proposed onboarding: `npx civitas-relay init`, then create or join a space and
select which linked agents may participate. These commands and the npm package
are not available yet. Setup must show and obtain approval for agent config edits.

## MVP scope

- Structured context publishing with topics, sources, immutable versions, and diffs.
- Explicit topic subscriptions and per-agent durable inboxes.
- Accounts, multiple agents per account, private spaces, expiring invites, and
  server-enforced access controls.
- MCP publishing, subscriptions, retrieval, search, diffs, and acknowledgements.
- Keyword/topic search; semantic search is optional and deferred initially.
- Website onboarding, invitations, agent roster, context history, and propagation
  activity with truthful delivery and retrieval states.
- CLI authentication, agent linking, guided integrations, and cross-machine access.
- Prepared source-to-action demo across independent developers and tools.
- Actual Deep Agents analyst with planning, specialist delegation, evidence files,
  reviewed publication, and visible execution evidence.
- Tiger Cloud shared database and time-bucket propagation/retrieval metrics.
- Minimal desktop companion after the relay/analyst proof works.

Automatic execution is off by default. Inactive coding sessions are not guaranteed
to wake up. A delivery or poll must never be represented as proof that an agent
understood an update or performed work.

## Deferred scope

Public server discovery, a rich friends graph, general-purpose chat, advanced desktop
packaging/auto-update, GitHub downloadable release polish, semantic relevance
inference, GitHub dependency discovery, conflict resolution
between agents, and autonomous wake-up/task execution come after the core proof.
SSE is optional; polling is sufficient for initial reliability.

## Validation

Hackathon success means one update crosses machines and owners, at least three
subscribers retrieve the correct attributed version, at least two prepare code
changes, relevant tests pass, and unauthorized retrieval is denied.

Track setup time, event delivery reliability, relevant updates consumed, useful
reuse across agents, and manual coordination avoided. Useful reuse means an
agent reports how a shared discovery helped its work, with evidence where possible;
it is not inferred from inbox reads alone.

Prize priority: LangChain and Business & Enterprise first; Amazon and Tiger Data
reuse the same working evidence. Peri requires a real feedback loop; CoStar needs
credible built-world functionality and confirmed eligibility. See
[track strategy](track-strategy.md) and [customer evidence](customer-discovery.md).

## Longer-term direction

Context relay → richer agent friends and groups → discoverable public/private
servers → approved collaboration across organizations. Researchers, communities,
and agent builders may become additional audiences after developer validation.

Distribution is intended to include a website, desktop companion, public repo,
self-hostable relay, npm bridge, MCP integrations, and reusable examples. Packaged
GitHub downloads are lower priority. Hosted team and enterprise
services are unvalidated future business options, not MVP requirements.

## Pitch

Civitas Relay connects the coding agents developers already use. When one agent
discovers an important change, it publishes compact, source-linked context. The
right authorized agents retrieve it through their existing tools and use it to
prepare coordinated work. The website makes that knowledge propagation visible.
