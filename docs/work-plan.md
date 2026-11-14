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
| **6: submission** | Not started | Actual customer feedback, sponsor-rule confirmation, two-minute rehearsal |
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

## Next build order

1. Website slice is complete for local demo-key access; ready for review on
   `feat/web-demo`. Keep the remaining public onboarding scope explicit.
2. Build the actual Deep Agents publisher next; prioritize this prize-critical
   feature over polished public onboarding or decorative graph animation.
3. Connect independent Claude Code/Codex agents, show useful maintenance UI/SDK
   changes, and wire Tiger Cloud with space-scoped propagation metrics.
4. Finish public sign-in/invitations and desktop UX as time allows. Keep their
   unfinished status visible; do not label demo-key login a real account system.
5. Record actual user feedback and rehearse the submission. GitHub binaries come last.

Talk to the NYC startup contact and confirm sponsor rules alongside development.
No quotes, validation, adoption, or domain feedback have been supplied yet.

## Working together

1A owned relay/contracts/root setup; 1B owned client/CLI. Both are now merged into
main. Shared wire types live in `packages/contracts/src/index.ts`; use those as the
source of truth rather than duplicating validators in clients.

Coordinate root manifests, lockfile, relay endpoints, and shared schemas when
parallel agents resume. Preserve unrelated work and document real commands in
README. Do not spend time creating more framework or planning files.
