# Build plan and verified status

Build the real flow. No new test suites, lint/check pipelines, CI, release
or deployment automation. Keep this file current; do not turn pending credentials,
model calls, customer feedback or sponsor eligibility into completion claims.

## Inline login and smooth ASCII (November 14)

Latest follow-up places email/password login directly on the landing page. Removed
the separate settings login form; unauthenticated settings visits return to `/`.
Successful login opens the existing relay if an agent session is connected, otherwise
the signed-in space/agent management UI. Authentication uses the existing account
API and HttpOnly sessions. Replaced stepped ASCII frames with a canvas light sweep
using requestAnimationFrame; the character logo stays stable while illumination
moves continuously. Reduced motion shows a static logo; background tabs pause time.
Website build passed. Production HTTP walkthrough verified inline email/password
and canvas markup; server-side 307 from unauthenticated `/settings` to `/`; actual
valid/invalid login; HttpOnly account session; authenticated main UI access; and
logout followed by redirect. Disposable account was created only on the isolated
memory relay. Registration API remains; the minimal UI offers login only. Visual
animation and browser form interactions remain unverified (browser host unavailable).

## Minimal animated landing (November 14)

Latest user request supersedes the prior landing content: only the Civitas name
at the top left, an animated ASCII logo, and login. Removed the headline, body,
relay entry, captions, borders and footer from `/`. Added a deterministic 12-frame
character-shaded c/outward-arrow logo, animated with CSS and static under reduced
motion. Login still opens `/settings`; the working main UI remains at `/relay`.
Website production build passed. HTTP200 checks confirmed `/`, login and main UI;
landing HTML contains exactly two links and twelve distinct ASCII frames, with no
headline, paragraph, relay entry or footer. Visual animation/browser review remains
unavailable.

## Dark terminal simplification (November 14)

User follow-up narrows the website to a compact landing page, login and main UI.
Removed the long marketing sections and illustrative protocol component. Landing
now contains a brief introduction, ASCII network, and only login/relay entry points.
Rebuilt shared styling as a dark terminal theme with monospace UI, muted phosphor
accents, and consistent dark forms, dashboard panels, inbox and publication dialog.
Existing `/settings` account/login and `/relay` functionality is preserved.
`npm run build:web` passed. Production HTTP checks returned 200 for all three
pages, confirmed the compact landing links/removed sections, and exercised agent
connection, real activity retrieval, disconnect and unauthenticated denial against
the isolated memory relay. Browser host remains unavailable; rendered visual and
keyboard checks remain unverified.

## Frontend redesign (November 14)

Active follow-up: redesign the website with a technical visual language inspired
by the user’s Peri/Ghostty references and an original ASCII landing illustration.
Scope is the website UI, navigation, and this status record; relay, contracts,
client, CLI, analyst and desktop behavior stay in their existing lanes.

- Implemented a dedicated landing page at `/`: original deterministic ASCII relay
  globe, responsive layout, product explanation, sharing workflow, source/version/
  access details, setup links, and an interactive illustrative MCP walkthrough.
- Moved the existing live dashboard to `/relay`; updated account connection and
  return links. Restyled dashboard/access surfaces in the same cobalt/slate palette,
  increased small UI text, corrected the connection form labels, and bundled the
  Manrope font locally with its OFL license. No font service is needed at runtime.
- Final `npm run build:web` passed with TypeScript and all routes generated.
  Production server on loopback3026 returned HTTP200 for `/`, `/relay`, `/settings`.
  An isolated memory relay on loopback4026 exercised two HttpOnly agent sessions,
  subscription, publication, identical retry identity, inbox retrieval, explicit
  acknowledgement, activity snapshot, disconnect and unauthenticated denial through
  the actual website API routes. No private credentials were printed or committed.
- Browser access host is unavailable; visual layout, client-side walkthrough button
  interaction, keyboard behavior and responsive rendering remain unverified. These
  HTTP runs are not browser interaction evidence.
- No deployment, external publication, new test suite or automation was added.

## Current assignment

The November 14 request expands the earlier A/B scope to all remaining local demo
features. Integration branch: `feat/complete-local-demo`, based on
`feat/deep-agents`. Three delegated lanes implemented relay/contracts,
website/client/CLI, and analyst/consumer examples; root implemented desktop and
integration. They used disjoint owned files in one shared checkout, with coordinated
API changes and one serialized dependency install. No deployment or public
publication is authorized as a side effect.

## Current status

| Section | Implemented and exercised | Remaining |
| --- | --- | --- |
| Relay + protocol | Memory/PostgreSQL; immutable version appends, expected-version conflicts, idempotent retries, frozen/scoped pagination, final ack/dismiss; HTTP + real MCP flows | Hosted Tiger Cloud verification; wildcard subscriptions intentionally absent |
| Client + MCP | Publish/append, subscribe, paginated updates, acknowledgements, additive Claude/Codex/JSON setup helper | Actual coding-model session blocked by expired Claude OAuth |
| Website/onboarding | Local password registration/sign-in, private spaces, invitations, separate agent keys, owner-managed grants/revocation; dashboard version/inbox controls | Browser visual interaction unavailable; no verified email, recovery, or public deployment |
| Deep Agents | Existing bounded planning/specialists/evidence/checkpoint/review runner builds; fails closed without provider key | Actual model analysis/delegation/evidence, explicit human review and model-generated publication |
| Maintenance consumers | Runnable SDK normalization, triage UI, dispatch decision, source trace and selected-event receipts | Independent live coding-model adaptations; genuine customer validation |
| Desktop | Electron companion; sign-in/link/status/subscribe/retrieve/open-web and private MCP env setup; build + native launch | Native UI interactions unavailable because computer-use access was denied; signed installers absent |
| Submission | Current rules checked, attribution, draft description and two-minute walkthrough in README | Team eligibility, final sponsor details, timed team rehearsal and actual submission |

Local password accounts are a hackathon feature, not an email-verified production
auth service. Relay stays loopback-only. In memory mode accounts, grants, sessions,
invites, subscriptions, events, deduplication and inbox state all disappear on
restart. PostgreSQL is the durable implementation. Deep Agents remains separate
from relay routing. Retrieved remote context never authorizes execution.

## What actually ran in this completion pass

- `npm install` and root lockfile reconciliation including Electron. Contracts,
  client, CLI, relay, website, analyst and desktop builds passed. Native Electron
  runtime downloaded from its official package distribution; companion launched.
- Real HTTP memory walkthrough: registration/login/logout; owner/member spaces;
  email-bound invitation acceptance; denial before membership; non-owner grant
  denial; read-only publish denial/revocation; v2 append/retry/stale-version conflict;
  pagination excluding later events; foreign cursor denial; ack retry timestamp and
  conflicting disposition. No new test suite was created.
- Started Docker Desktop and the included PostgreSQL 16 Compose service. Applied
  `001_core.sql` and new `003_protocol_accounts.sql`; existing migrations unchanged.
  Durable readiness requires the current schema; no fallback to memory. The private
  local `.env` now selects PostgreSQL for subsequent relay starts.
- PostgreSQL HTTP walkthrough: same authorization/account flow, concurrent identical
  append retries, competing expected-version writes (one accepted, one conflict),
  frozen pages, first retrieval only for returned items, foreign inbox/ack denial,
  acknowledgement replay/final-status conflict. SQL confirmed four events/four
  deliveries with exactly four transitions each for publication/delivery/retrieval.
- Website production build and two isolated cookie sessions exercised real server
  routes: register, space/invite/accept, agents/grants, connect, subscribe, publish,
  append, paginate, ack/dismiss conflict, read-only denial, immutable history, logout.
  Two real MCP stdio bridge processes also exercised new protocol methods. The
  additive setup helper printed token-free config and installed CLI help confirmed
  command syntax. These are server/API runs; no visual browser claim is made.
- Root independently created a publisher plus **three distinct admitted receiver
  identities**, subscribed each through a separate real MCP process, published a
  clearly labeled **hand-authored synthetic** maintenance packet, retried the same
  key, and retrieved exactly one matching delivery per receiver. Private credentials
  and receipts are ignored under `.local/` and never committed.
- Each SDK/triage/dispatch receiver used its own real MCP process and selected event
  ID to produce a private source-linked receipt. Results: urgent decoding, urgent
  triage, immediate-dispatch decision. Running consumer HTTP demo also exercised
  both source revisions and unknown P2 -> manual review. These are implemented
  adapters; receipt retrieval did not generate them with independent coding models.
- Restarted both relay and PostgreSQL. Account/session/grants, source event ID,
  delivery IDs, subscriptions and same-key retry identity survived. Repeated ack
  retained its first timestamp. Website server route returned the same retained
  event with PostgreSQL metadata and three deliveries.
- Local TimescaleDB 2.32.0 ran from official `timescale/timescaledb:latest-pg16`
  on separate loopback DB5433/relay4015. Core/003 then optional002 migrations,
  reruns, historical backfill, triggers, actual `time_bucket` counts/latencies and
  relay/database restart persistence passed. Two events retained exactly two
  transitions of each kind. The live event measured 4 ms delivery and 272 ms first
  retrieval including an intentional 250 ms wait. Unauthorized/wrong-space/invalid
  ranges returned 401/404/400. This is local Timescale, not hosted Tiger Cloud/TLS.
- Actual analyst `analyze` command failed closed without a provider key. Presence-only
  checks found no `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` in the shell or checked private
  env files. Existing hand-authored transport checkpoints are not model output.
- Attempted actual Claude Code receiver with a private MCP config. It failed before
  tool calls: OAuth session expired and could not be refreshed. `auth status`
  initially reported logged-in state, which did not prove live access. No successful
  model adaptation is claimed.
- Native computer-use request for Electron was denied; built-in browser access host
  was unavailable. Desktop native launch is verified; desktop interactions and
  latest web visual layout remain unverified.
- A subagent inadvertently printed disposable local integration credentials into a
  tool log. Root invalidated all twelve corresponding identity/session/space/grant
  records, preserved event history, and regenerated distinct private identities
  before final MCP receipts/restart verification. No exposed credential remains
  usable against that old walkthrough account. No secrets entered git.

## Remaining external work, in completion order

### 1. Run real analysis and reviewed publication

- [ ] Privately configure a provider key in `.local/model.env` or the shell.
- [ ] Run the actual Deep Agents planner and contract/impact specialists; inspect
  the evidence and schema-valid checkpoint. Fix any provider-specific runtime issues.
- [ ] A person reviews the full candidate in the terminal and approves that exact
  packet through the existing review command. Do not preapprove unseen model output.
- [ ] Publish through MCP into PostgreSQL, retrieve from separate receivers, retry
  approval and show the same event/delivery after restart in the dashboard.

**Blocker:** absent provider credential. SDK graph construction and hand-authored
packets do not complete this requirement. See `apps/change-analyst/README.md`.

### 2. Run independent receiving coding models

- [ ] Reauthenticate privately with `claude auth login` (or configure another actual
  model client). Existing CLI OAuth expired before any model/tool execution.
- [ ] Connect three separate receiver identities; select the reviewed model packet.
  Have independent sessions make at least two useful, reviewable consumer changes.
- [ ] Run their adapted consumer/UI flow and retain source/version evidence.

**Current evidence:** three distinct identities and real bridge processes work,
as do three checked-in consumer adaptations. Independent model-generated changes
and cross-owner customer repositories have not been demonstrated.

### 3. Verify actual Tiger Cloud

- [ ] Privately supply an existing Tiger Cloud service URI and trusted CA if needed.
  Cloud provisioning is not implicitly authorized by local implementation.
- [ ] Apply migrations with analytics enabled, validate hosted TLS, execute actual
  `time_bucket` analytics, verify scoped access, and restart against hosted storage.
- [ ] Report real publication-to-delivery/first-retrieval timings including polling
  delay, never as proof of comprehension or useful work.

**Blocker:** no hosted database credential/service. Local PostgreSQL and local
Timescale runs must be identified separately from Tiger Cloud.

### 4. Submission and genuine feedback

- [x] Prepare truthful setup instructions, attribution, draft project description
  and timed walkthrough outline in README.
- [x] Check official public rules and current event listing; record deadline conflict
  and sponsor details still needing organizer clarification in README.
- [ ] Confirm team eligibility/check-in, track selection and sponsor compatibility
  with organizers; add every team member and required handles.
- [ ] Perform a timed in-person rehearsal, publish source separately if authorized,
  and submit Devpost materials. No publication or submission occurred here.
- [ ] If pursuing Peri, obtain real developer feedback, implement a response and have
  that developer try it. If pursuing CoStar, validate a real property-workflow benefit.
  Do not attribute the synthetic demo to a real customer.

## Implementation limits and later work

- Email verification/recovery, hosted auth, and public deployment require an explicit
  production architecture; local accounts are implemented and labeled honestly.
- Desktop source runs locally. Signed/notarized platform installers and GitHub
  downloadable releases remain lower priority. A local tracked-source/self-host
  archive command is documented in README, with platform/signing targets and
  license/public package naming undecided. No release automation was added.
- Identity persistence uses private normal JSONB records with serialized mutations,
  suitable for hackathon scale. Per-process login throttling is not a distributed
  public-auth defense. Core uniqueness/idempotency stays in normal SQL tables.
- No mid-analysis crash resume was added; durable review checkpoints support stable
  publication retries. No automatic execution/wake-up of receiving coding models.
- No customer feedback, successful live model analysis, hosted Tiger integration,
  prize eligibility, or successful submission is fabricated.
