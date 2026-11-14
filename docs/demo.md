# Hackathon demo runbook

Status: planned. Fixtures, consumers, SDK integration, and reset tooling must still
be built. Follow [track strategy](track-strategy.md) for prize priorities and
[the sources](research/track-requirements.md) for verified versus unconfirmed rules.

## One story: maintenance software learns a contract change

A property-maintenance API changes from `{ "priority": "urgent" }` to
`{ "priority_code": "P1" }`. An outdated consumer loses the urgency signal or
fails validation. The desired outcome is a triage UI that still highlights urgent
work orders correctly, an SDK with correct types/parsing, and passing integration
checks. Use synthetic fixtures, not tenant records or a real dispatch system.
This story is not yet validated by the team-provided NYC startup contact.

A LangChain Deep Agents change analyst is the publisher. It inspects approved
before/after revisions, plans the investigation, delegates contract/impact checks,
uses virtual evidence files, and pauses for publication review. Independent coding
agents receive the approved packet through Civitas. Internal analyst specialists
must not appear as additional developer-owned agents in the network.

| Participant | Work |
| --- | --- |
| Deep Agents analyst | Investigate evidence and publish after review |
| Developer A / Claude Code | Update the maintenance triage dashboard |
| Developer B / Codex | Update SDK types and priority parsing |
| Developer C / Claude Code | Update integration/compatibility tests |
| Developer A / additional agent | Answer a source-grounded follow-up; stretch |

Target three developer accounts and three receiving agents plus the publisher.
The extra fourth personal agent is useful after the main proof works. Coding
agents remain in their native tools with independent working copies.

## Preparation

- [ ] Confirm track rubrics and required opt-ins; record sources/dates.
- [ ] Record actual customer feedback using [the template](customer-discovery.md).
- [ ] Deploy the shared relay with TLS and Tiger Cloud; apply core and analytics migrations.
- [ ] Confirm account invites, explicit agent grants, and Claude Code/Codex MCP setup.
- [ ] Subscribe recipients to `project/maintenance-api`; keep active sessions ready.
- [ ] Store baseline v1 with known context ID; confirm old consumers pass v1 checks.
- [ ] Prepare fixed source revisions and a manifest of affected consumer components.
- [ ] Add a v2 compatibility check that fails before adaptation; unknown priority
  must not silently become normal priority.
- [ ] Rehearse an actual SDK run and a rejected publication before the approved one.
- [ ] Prepare unauthorized account/space and verify no context/aggregate data leaks.
- [ ] Inspect real hypertable metadata and the dashboard time-bucket query.
- [ ] Authorize local edits/tests; rehearse isolated resets and timeout retries.
- [ ] If ready, show desktop sign-in/link/status; otherwise label desktop as planned.

## Live sequence: at most two minutes

1. **0–15s: problem.** Show the stale triage UI or failing compatibility check.
   Explain the maintenance-software consequence and the cross-team coordination gap.
2. **15–45s: investigate.** Trigger the analyst with approved source revisions.
   Show its plan, useful specialist outputs, evidence files, and publication review.
   Publish v2 using `expectedVersion: 1` and a stable retry key.
3. **45–85s: propagate and use.** Show durable deliveries, then real retrieval by
   Claude Code/Codex agents. Show their reviewable changes and actual test output.
   A pre-recorded rehearsal can cover slow generation if clearly labeled.
4. **85–110s: verify.** Show the corrected urgent-work-order UI, source-to-event-to-
   action links, Tiger-backed time buckets/latencies with sample counts, and an
   unauthorized access denial. Separate reported results from independently checked ones.
5. **110–120s: close.** State what ran and what customer feedback changed. Do not
   claim customer validation if its evidence is still pending.

Do not paste the changed contract into receiving prompts. Asking active agents to
check Civitas is acceptable. A poller does not prove model consumption; an inactive
coding session is not expected to wake itself.

## Evidence to retain

Save approved source revisions, sanitized Deep Agents run/trace with plan and
specialist work, review decision, MCP call, context/event IDs, actual recipient
identities, first-retrieval timestamps, code diffs, and test commands/results.
Save Tiger service/table evidence without connection secrets, the actual dashboard
query, and measurement definitions. Three subscribers retrieve the same event;
at least two prepare changes with passing relevant checks. Do not infer useful
reuse from polling alone.

## Recovery and scope cuts

Reconnect and replay durable inboxes after disconnects. Retry publication with the
same key/body after timeouts; do not create a new event to animate the dashboard.
Reset only disposable demo data with an explicit target and opt-in. A hand-authored
packet can prove relay plumbing but does not qualify as an actual Deep Agents run.

Clearly label recordings, seeded datasets, and synthetic load. Keep them separate
from live counts. Cut decorative animation, friends/chat, fourth-agent extras,
and continuous aggregates before the actual source-to-action proof. GitHub binary
release packaging is low priority and should not consume rehearsal time.
