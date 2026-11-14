# Implementation roadmap

All runtime items are unimplemented. ADRs accept direction, not completed features.
The goal is a strong LangChain/enterprise submission supported by one working
source-to-action story. See [strategy](track-strategy.md) and [demo](demo.md).

## P0: Durable cross-owner relay

- [ ] Decide human auth/CLI sign-in, SQL migration tooling, and package build setup.
- [ ] Implement validated schemas, topic matching, errors, and version preconditions.
- [ ] Add regular PostgreSQL tables for identities, memberships/grants, invites,
  versions, subscriptions, durable deliveries, credentials, and audit records.
- [ ] Implement server-side authorization and immediate membership/token revocation.
- [ ] Implement transactional publish/fanout, idempotency, durable polling, and ack.
- [ ] Verify restart persistence, retry deduplication, stale-version conflicts,
  denied direct ID reads, and denied queued reads after revocation.
- [ ] Build HTTP client and local MCP bridge; verify one real coding-tool integration.
- [ ] Add account sign-in, invitation/agent-grant flow, and a basic web activity view.
- [ ] Connect two active agents across machines/owners; publish and retrieve v1/v2.

Milestone: authorized context exchange without manual copying between agents.

## P1a: Prize-critical analyst and verified work

- [ ] Confirm exact LangChain, Amazon, Peri, and CoStar requirements with mentors.
- [ ] Complete a real-person conversation and retain consented, specific feedback;
  the NYC startup contact currently has no supplied interview/validation record.
- [ ] Pin the TypeScript Deep Agents SDK and compatible model/MCP dependencies.
- [ ] Build the real analyst plan, two specialist checks, virtual evidence files,
  schema-validated candidate, and reviewed MCP publication. Save sanitized evidence.
- [ ] Implement stable run identity/checkpointing for approval resume; prove rejected
  publish has no effect and accepted retry creates no duplicate event.
- [ ] Verify tool inventory restrictions and resistance to instruction-bearing sources.
- [ ] Verify Claude Code and Codex integrations under separate admitted identities.
- [ ] Build synthetic maintenance API v1/v2 fixtures and frontend/SDK/test consumers.
- [ ] Have three recipients retrieve the packet; two produce diffs and pass checks.
- [ ] Show the corrected triage UI with urgent priority preserved and sources linked.

Milestone: Deep Agents performs useful grounded analysis and independent tools use
its approved findings. A LangChain import or relay-only canned packet is insufficient.

## P1b: Evidence, Tiger Data, and product surfaces

- [ ] Use Tiger Cloud for the real shared relay database; confirm TLS and permissions.
- [ ] Add separate Timescale telemetry migration, retry-safe first-retrieval metrics,
  space-scoped `time_bucket` analytics endpoint, and dashboard chart.
- [ ] Verify actual hypertable use, persistence, unauthorized analytics denial, and
  displayed timing/sample definitions. Local vanilla PostgreSQL does not count.
- [ ] Add version history/diffs, keyword search, acknowledgements, and action reports.
- [ ] Finish website source/delivery/retrieval/report evidence views.
- [ ] Choose a desktop shell and implement sign-in/link/status/open-web over the bridge.
  Demonstrate on one documented OS; avoid unsupported platform claims.
- [ ] Apply one change based on real user feedback and retest if pursuing Peri.
- [ ] Rehearse the two-minute demo and finalize truthful submission evidence.

Milestone: one coherent demonstration supports multiple entries without new products.
If time runs short, prioritize P1a and real Tiger evidence over desktop polish.

## P2: Lower-priority distribution and expansion

- [ ] Package downloadable GitHub releases: desktop installers, CLI, and/or self-host
  bundle with checksums and instructions. Public source remains required earlier.
- [ ] Add signing, auto-update, and more OS support after one desktop flow works.
- [ ] Consider continuous aggregates only after raw analytics works and is measured.
- [ ] Add the fourth personal demo agent and richer visualization after core evidence.
- [ ] Improve relevance, optional semantic retrieval, more integrations, and self-host UX.
- [ ] Explore friends, richer groups, discoverable servers, and dependency subscriptions.
- [ ] Design authorized wake-up/execution separately from durable notifications.

## Coordination and completion evidence

Use issues for owners and task status. Agree on shared schemas and access flows
before separate relay, bridge/analyst, and web/desktop work. Run a customer
conversation early rather than adding fictional evidence at submission time.
Do not sacrifice the cross-owner proof to broaden the sponsor checklist.
