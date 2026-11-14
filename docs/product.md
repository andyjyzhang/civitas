# Civitas Relay — design

**Your agent learns something. The right agents know it too.**

## Product

Independent coding agents miss teammates' discoveries and keep working against
stale assumptions. Civitas relays compact, source-linked knowledge changes between
explicitly authorized agents across developers and tools.

**Publish → match subscriptions → durable inbox → retrieve through MCP → act.**

An account owns multiple agents. Group chats and servers serve different purposes;
their underlying context spaces admit agents with explicit read/publish grants.
Events have topics, sources, immutable versions, and publisher
identity. Retrieval, acknowledgement, and reported work are distinct states.
Receiving context does not authorize code execution or wake an inactive session.

## Group chats and servers

| Experience | Purpose | Intended interaction |
| --- | --- | --- |
| **Group chats** | Private collaboration with friends/coworkers on a shared project | Invite specific people, select participating agents, discuss work, share project context and coordinate changes. |
| **Servers** | Broader communities distributing and discovering reusable knowledge | Browse topic feeds/channels, subscribe to relevant updates, and receive source-linked knowledge from permitted publishers. |

These are different workflows, not just different group sizes. A project team uses
a group chat; a developer community, research feed, or job-postings community uses
a server. Servers can be public or access-restricted, with explicit publishing
permissions. Membership in a group does not expose its history to a server. Sharing
a discovery from a private project to a server requires an explicit selected post;
do not automatically mirror project conversations or agent context.

The implementation currently has one private, invitation-based `space` abstraction
with agent grants and context activity. This is groundwork for project groups;
it does not yet implement group conversations or distinct community-server behavior.
Use **Group chats** and **Servers** as separate product navigation destinations.
Keep `space` as an internal routing/access term. The relay server is the backend
service supporting both experiences, separate from a community server.

## Product surfaces

- **Website:** accounts, private group chats/project collaboration, community
  servers/knowledge feeds, agent access, subscriptions, and real activity history.
- **Desktop companion:** same account, agent linking, guided MCP configuration,
  connection/inbox status; the local Electron shell reuses the CLI bridge.
- **CLI/MCP bridge:** the first local implementation; connects Claude Code/Codex.
- **GitHub downloads:** packaged installers/CLI/self-host bundles, low priority.
  The public source repository is separate from release packaging.

## Stack and boundaries

TypeScript/npm workspaces; Fastify relay; Next.js/Tailwind website; PostgreSQL on
Tiger Cloud for the shared demo. Local Compose is vanilla PostgreSQL. Use regular
tables for identities, grants, versions, subscriptions, and durable deliveries.
A Timescale activity hypertable powers space-scoped time-bucket and latency charts.
Do not put core idempotency constraints in time-partitioned telemetry or add Atlas
as a second database. Continuous aggregates and semantic search can wait.

Relay owns authorization and transactional publish/fanout. Client owns HTTP;
CLI owns MCP. Desktop reuses both. Sources remain untrusted data; only selected
context is shared. Keep credentials outside git, prompts, and browser bundles.

## LangChain integration

An actual TypeScript Deep Agents **change analyst** is an optional publisher, not
an orchestrator required by the relay. Given approved source revisions, it:

1. Plans an investigation and reads bounded source fixtures.
2. Delegates contract and impact analysis to two specialists.
3. Stores evidence in per-run virtual files and produces a structured packet.
4. Pauses for review before publishing through Civitas MCP.

Use stable run identity/checkpointing for approval resume and a stable publish retry
key. Keep tools limited to approved inputs and reviewed publication; no arbitrary
host shell or credential access. Its internal specialists do not count as independent
cross-owner agents. Claude Code/Codex consume the packet separately.

## Demo and prize focus

A synthetic property-maintenance API changes `priority: "urgent"` to
`priority_code: "P1"`. Deep Agents investigates and publishes a reviewed update.
Frontend, SDK, and testing agents retrieve it. Show reviewable code changes, a triage
UI preserving urgent priority, source history, and real Tiger-backed delivery/retrieval
timings. Aim for three receiving agents and at least two useful changes. No new
automated testing infrastructure is required for the hackathon.

Rank targets by fit and remaining work, not predicted winning odds:

| Priority | Target | Required demo evidence / remaining work |
| --- | --- | --- |
| **1** | **Business and Enterprise — main category** | Strongest natural fit: one API change reaches teammates across tools/repos and prevents incompatible work; show scoped access and useful code changes. |
| **2** | **LangChain — primary sponsor target** | Real Deep Agents planning, contract/impact specialists, evidence files, human review, and MCP publication. SDK installation alone is insufficient; complete and run the analyst. |
| **3** | **Amazon — Practical AI Innovation** | Reuse the same grounded source-to-code demo to show a concrete coordination failure fixed. Confirm whether Amazon technology is required before adding services. |
| **4** | **Tiger Data — selected database prize** | Local PostgreSQL and Timescale migrations/analytics are verified; connect actual Tiger Cloud and demonstrate hosted telemetry. Hosted verification is pending. |
| **5 — conditional** | **Peri — Forward Deploy** | Talk to a real developer about a specific coordination failure, change a feature based on feedback, and have them try it. An anonymized contact description alone is insufficient. |
| **6 — stretch** | **CoStar — Built World** | Demonstrate a meaningful property/building workflow benefit. The synthetic maintenance API is a possible vehicle; domain naming alone does not establish fit. |

Put most remaining effort into the working cross-agent demo and real Deep Agents
integration. Reuse one source → analysis → reviewed publication → independent-agent
adaptation story across eligible entries. Pursue Amazon and Tiger Data with that
same demo; pursue Peri and CoStar only when the required evidence exists. Sponsor
rules and award compatibility still need organizer confirmation.

Tiger Data fits the existing SQL model and event analytics better than introducing
MongoDB for this MVP. This is our design choice, not a limitation of Atlas.

### Main-track strategy

The team supplied the main/optional prize descriptions. **Business and Enterprise**
is our strongest main-track fit: infrastructure that improves real software teams'
efficiency, with a dashboard and privacy controls. Keep LangChain as the primary
sponsor target; the new main-track descriptions do not change the build priorities.

The supplied **Best Overall Hack** rule judges creativity, utility, charity, and
avidity, and says track winners cannot win Best Overall. Enter the appropriate
category and prepare a strong overall demo; confirm with organizers how that
exclusion applies to sponsor and optional awards. Do not assume awards can stack.

Make the demo easy to judge: show the distinctive cross-owner context relay
(creativity), an API change actually helping another developer finish work
(utility), and the source-to-result story. Ask organizers what charity and avidity
mean in their rubric before claiming evidence for those dimensions. Open-source
access, privacy, and real user feedback can support the story where relevant.

Healthcare, Sustainability, Entertainment, Education, and Science + Discovery are
not current targets. Do not add unrelated features to enter them. Best Rookie Hack
requires the team's first-hackathon eligibility to be confirmed; Best Hardware Hack
requires actual hardware integration. A desktop application alone is not that demo.

The team supplied “a person at an NYC startup” as an anonymized contact description.
Role, incident, quotes, feedback, consent, and validation are not documented. Do not
invent them or attribute the synthetic maintenance scenario to that contact. Have a
short conversation, capture the actual workaround, change one feature, and show it
back. Keep personal details private unless disclosure is authorized.

The [event listing](https://hackprinceton-fall-26.devpost.com/) is the submission
reference; the main-track rules above come from the team's supplied descriptions.
The November 14 rules check confirms one main track plus sponsor tracks; the
README records current submission requirements and a deadline conflict. Detailed
LangChain/CoStar/Amazon/Peri requirements remain to be confirmed with mentors;
do not assume AWS services are required.
Prepare a two-minute demonstration and confirm submission rules before entering.
Technical references: [Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview),
[Tiger Data](https://www.tigerdata.com/docs/learn/hypertables/understand-hypertables).

## Cut line

Working relay and actual Deep Agents use come before decorative graphs, desktop
polish, public discovery, chat, semantic relevance, and GitHub release packaging.
Keep the demo honest: label recordings, fixtures, seeded activity, and unfinished UI.
