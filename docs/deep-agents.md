# Deep Agents change analyst

Status: planned. This is the central LangChain integration for the hackathon;
`apps/change-analyst` currently contains only a private workspace manifest and README.

## Role in Civitas

A developer explicitly starts a change investigation with approved before/after
source fixtures and a small consumer manifest. A TypeScript Deep Agents runner
investigates the change, organizes evidence, requests review, and publishes through
Civitas MCP. Claude Code and Codex then retrieve and use the update independently.
The analyst's internal specialists do not count as independent cross-owner agents.

This is an example participant above the relay, not a mandatory orchestrator inside
it. Ordinary agents can still publish without LangChain. The relay's authorization,
topic routing, and inbox durability remain deterministic server responsibilities.

## Why the harness earns its place

Use actual Deep Agents capabilities in one visible run: planning, filesystem
context, specialist delegation, and human review. The SDK supplies those building
blocks; our application supplies source-grounding, typed tools, and authorization.
See the official [overview](https://docs.langchain.com/oss/javascript/deepagents/overview)
and TypeScript [quickstart](https://docs.langchain.com/oss/javascript/deepagents/quickstart).

Do not replace the SDK with a single prompt and call it Deep Agents. Conversely,
do not force a new investigation step when a source is unchanged: deterministic
revision checks can skip an unnecessary model call.

## Planned run

1. **Input.** Host supplies a run ID, space/topic, authorized agent identity,
   previous context/version, approved source revisions, and consumer manifest.
   Credentials are held by tool closures, not written into prompts or files.
2. **Plan.** Analyst creates an inspect → compare → verify → publish checklist.
3. **Evidence.** Read fixture files and canonical source diff. Store bounded
   source excerpts and notes in a per-run virtual filesystem.
4. **Delegate.** A contract specialist checks changed fields and backwards
   compatibility. An impact specialist checks the approved consumer manifest and
   proposes affected components and checks. Return citations and uncertainties.
5. **Synthesize.** Produce a schema-validated context candidate. Cite exact
   revisions and evidence paths; separate facts, impact hypotheses, and unknowns.
6. **Review.** Pause before the outbound `publish_context` tool call. Show content,
   destination, sources, and expected version. Approve, reject, or edit-and-revalidate.
7. **Publish.** On approval, use the MCP-adapted tool with a stable idempotency key.
   Record the returned event ID. Retry with the same body/key after a timeout.
8. **Consume.** Separately authorized coding agents poll their Civitas inbox and
   decide what to change. Their edits and test runs happen in their own environments.

Use least-privilege specialist tools and isolated context as documented under
[subagents](https://docs.langchain.com/oss/javascript/deepagents/subagents).
Subagent identity in a trace is diagnostic metadata, not a new network identity.

## Files and output

Planned virtual paths, isolated by account/space/run:

```text
/sources/before.json
/sources/after.json
/sources/consumer-manifest.json
/analysis/contract.md
/analysis/impact.md
/output/context-candidate.json
```

The candidate maps to the existing protocol: topic, title, content, source revision,
change.previous/current, and tags. Keep detailed analysis local to the run; publish
only the reviewed, bounded packet. No arbitrary source attachments or raw agent
histories. The runner may produce unsupported hypotheses; a validator and reviewer
must not silently promote them to facts.

## Integration and state

Create the runner with the TypeScript `deepagents` SDK. Load Civitas tools through
the official [MCP adapters](https://docs.langchain.com/oss/javascript/langchain/mcp)
and keep the adapter session open for the run. Pin compatible versions during
implementation; do not copy constructor names from older examples unchecked.

Use a checkpointer and a stable thread ID for approval pauses and resume. The
official [human review guide](https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop)
documents this requirement. Implement durable checkpoint storage in a private
runner-owned schema; use a separate restricted DB role, not relay application
tables. Alternatively an in-memory rehearsal must be labeled non-resumable after
restart. Approval applies to exact content/destination/version; changing these
invalidates approval. A resumed run rechecks current space access.

No arbitrary shell or host filesystem backend is needed for the analyst. Use a
virtual filesystem with approved inputs. Filesystem tools alone are not an OS
sandbox; explicitly remove/deny shell, execution, generic network, and unrestricted
delegation tools from the final parent and specialist tool inventories. Test the
inventory against the pinned SDK. No model-controlled DB or credential tool.

LangSmith tracing is optional. Only synthetic fixtures may appear in a shared
trace unless the owner separately consents. Record run/trace references as evidence,
not as a prerequisite for relay correctness.

## Minimum acceptance evidence

- Actual SDK invocation with the plan, two useful specialist results, file reads/
  writes, and reviewed MCP publication visible in a sanitized run log or trace.
- Both specialist outputs ground claims in approved sources. At least one
  distracting or irrelevant source fact is correctly excluded from the packet.
- Rejected publication sends no event; resume does not duplicate an approved event.
- Prompt-injection text in a fixture cannot grant tools or cause secret access.
- Independent external agents retrieve the event and produce real code/test evidence.
- Log elapsed time and model usage/cost only if available; do not invent metrics.

The canonical demo is property-maintenance contract drift; see [demo](demo.md).
