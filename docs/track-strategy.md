# HackPrinceton track strategy

Decision date: 2026-11-14. Goal: maximize the strength of a working prize submission,
not the number of sponsor names in the README. No outcome or eligibility is assured.

## One product, one demonstration

Keep Civitas as the context relay for independent agents. Add a substantive
LangChain Deep Agents **change analyst** as the publishing participant, and use
Tiger Data for the shared PostgreSQL database and propagation analytics.

Demonstrate a property-maintenance software team responding to an API change:
`priority: "urgent"` becomes `priority_code: "P1"`. A triage dashboard, SDK, and
compatibility tests must all agree on the new contract. Show the stale UI state,
the analyst's evidence, the propagated event, and verified changes. This is a
synthetic workflow until a user validates it, not a CoStar integration or deployed
maintenance system.

## Priority and judging evidence

Track names and descriptions below come from the team unless noted as verified in
[requirements and sources](research/track-requirements.md).

| Target | Why Civitas fits | Evidence to build | Priority |
| --- | --- | --- | --- |
| LangChain: best use of Deep Agents | Multi-step source investigation produces an actionable context packet | Actual SDK run, plan, specialist delegation, files, publish approval, MCP call, external consumers | Primary sponsor target |
| Best Business & Enterprise Hack | Real SWE teams lose time coordinating changes across repos/tools | Working cross-owner workflow, scoped access, traceable source-to-diff results, measured coordination time | Primary category |
| Amazon: Best Practical AI Innovation | AI addresses a narrow engineering failure with observable outcomes | Before/after compatibility tests, grounded analysis, latency/cost where measured | Strong complementary target |
| Peri: Forward Deploy Challenge | Product changes in response to a person's actual problem | Consented interview notes, pain-to-feature mapping, user tries the flow, recorded feedback | Pursue with real evidence |
| MLH: Best Use of Tiger Data | Durable relational relay plus event analytics | Real Tiger Cloud connection, hypertable, `time_bucket` dashboard query, persistence and timing evidence | Selected database target |
| CoStar: Inside and Out: AI for the Built World | Coordinated changes protect a property-maintenance workflow | Working triage UI and accurate priority handling; ideally feedback from a domain stakeholder | Conditional stretch |

Do not add AWS infrastructure merely because Amazon sponsors a track. Check its
actual rules before assuming an AWS-service requirement. Do not claim general SWE
infrastructure alone satisfies CoStar's built-world criteria. If that track needs
direct physical-world impact or domain validation, the story alone is insufficient.

## Why Tiger Data over MongoDB Atlas

Both can support the product. Atlas offers document storage and retrieval features,
but there is no implemented MongoDB dependency or requirement for vector search.
Tiger Data preserves the planned PostgreSQL relational/transactional model and
adds a natural use case: measure how quickly authorized knowledge reaches agents.
This is our engineering choice, not a claim Atlas cannot handle transactions.

Use one operational database. Keep access-control tables, versions, and inbox
uniqueness in regular PostgreSQL tables. Use a Timescale hypertable for activity
telemetry. A `time_bucket` query should drive the actual per-space propagation chart;
a continuous aggregate is a stretch improvement after the raw query works.
Local vanilla PostgreSQL alone is not evidence of using Tiger Data.

See [the database ADR](decisions/0001-tiger-data.md) for constraints and evidence.

## Budget and cut line

Build in this order: durable relay → Deep Agents publisher → real independent
consumption → reviewable diffs/tests → honest dashboard → Tiger analytics → rehearsal.
Run the customer conversation in parallel with normal team development, without
blocking the technical proof. Confirm sponsor entry requirements early.

If time is short, cut graph animation, friends/chat, a fourth personal agent, and
continuous aggregates, desktop polish, and GitHub release packaging before cutting the actual Deep Agents run, cross-owner
exchange, or verification. Three receiving agents and two verified code changes
remain the target. Two real subscribers are a partial demo, not full success.

## Two-minute pitch

- **0–15s:** A software team ships an API change; another agent keeps coding against
  yesterday's assumptions. Name the actual customer pain only when documented.
- **15–45s:** Show the Deep Agents analyst's plan, delegated evidence check, source
  diff, and approval to publish. Skip waiting through raw model generation.
- **45–85s:** Show independent Claude Code/Codex agents retrieving the same event,
  preparing compatible changes, and running meaningful checks.
- **85–110s:** Show the working maintenance UI, real event timings backed by Tiger
  Data, and denied cross-space access.
- **110–120s:** State what worked, what was measured, and the next customer test.

Keep a clearly labeled rehearsal recording if live model latency is too high.
Never present a recording, synthetic analytics load, or hand-authored packet as a
live agent result. Submission requirements are in the [source note](research/track-requirements.md).
