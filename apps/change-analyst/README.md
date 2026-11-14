# Deep Agents change analyst

A TypeScript Deep Agents publisher for a **synthetic** property-maintenance API
revision. One coordinator plans with `write_todos`, delegates to `contract` and
`impact` specialists with `task`, writes evidence files, and proposes a context
packet through `publish_context`. The run pauses on that call; nothing reaches
Civitas until a human approves the exact packet. The specialists are internal to
one admitted publisher; they are not independent Civitas agents.

## Inputs and filesystem

The model reads real files from `examples/api-change/spec/`, mounted at `/repo/`
with a Deep Agents `FilesystemBackend` (`virtualMode`, no path escape) inside a
`CompositeBackend`. Only `openapi-v1.yaml`, `openapi-v2.yaml` and `CHANGELOG.md`
are readable; writes anywhere under `/repo/` are denied by `permissions`. Other
paths, including `/evidence/`, live in per-run LangGraph state. Fixtures are
synthetic, untrusted data. The specs never state how `P1/P2/P3` relate to the old
`urgent/normal/low`; only the changelog says P1 succeeds `urgent`, and it leaves
P2/P3 open. The analyst must infer P1 from the changelog and flag P2/P3 as
unresolved (`unresolved:P2`, `unresolved:P3` tags and an "Unresolved" section).

There is no shell, browser, or network-fetch tool. File contents are sent to the
model provider (OpenAI).

## Publish tool and approval

The Civitas MCP bridge (`packages/cli`) is loaded with `@langchain/mcp-adapters`
over stdio; only `CIVITAS_RELAY_URL` and `CIVITAS_AGENT_TOKEN` are passed to it.
The model sees only a wrapped `publish_context` that accepts `title`, `content`,
`tags` and `change`. The runner injects the space (`CIVITAS_DEMO_SPACE_ID`), topic
`project/maintenance-api`, source `examples/api-change/spec/openapi-v2.yaml` @
`maintenance-v2`, and idempotency key `analyst:<run-id>`.

`interruptOn: { publish_context: approve|reject }` with an in-process `MemorySaver`
pauses the run. Before showing the candidate, the runner checks: plan executed,
both delegations succeeded, both evidence files exist, schema-valid packet,
topic/source scope, `unresolved:P2`/`unresolved:P3` tags, an "Unresolved"
section, a CHANGELOG citation, and `change.kind = field-replacement`,
`breaking = true`. A failing candidate is rejected automatically once with the
fixed list of problems; a second failure ends the run with nothing published.

A passing candidate is saved to `.local/analyst/<run-id>/review.json`, and the
exact relay arguments plus both evidence files are printed (control characters
escaped). Type `publish <run-id>` to approve; anything else rejects. On approval
the graph resumes and the wrapped tool publishes only if its arguments hash to
the approved packet. The returned event is saved to `published.json`.

Approval needs an interactive terminal. For automated verification only,
`--approve` is honoured when `CIVITAS_ANALYST_AUTO_APPROVE=1` is set; the runner
prints a loud notice that no human approved.

## Model and spend guard

OpenAI only for now. `CIVITAS_MODEL` defaults to `gpt-4.1-mini`; `OPENAI_API_KEY`
must be set privately. Every run passes `BudgetGuard` (`src/budget.ts`) in the
run callbacks, so nested subagent calls are priced and appended to the spend
ledger (`CIVITAS_SPEND_LEDGER`, default `.local/model-spend.jsonl`). The guard
refuses to start past `CIVITAS_SPEND_LIMIT_USD` and aborts past
`CIVITAS_RUN_LIMIT_USD`. Note: deepagents 1.16.5 only adds todo-list middleware
for Codex harness profiles, so the runner supplies `todoListMiddleware()` itself;
the default general-purpose subagent is disabled so the publish tool is reachable
only from the coordinator.

## Run it

From the repository root (Node 22+, npm 10+), relay in memory mode:

```sh
npm install
npm run setup:demo
npm run build:relay && npm run build:bridge
npm run build -w @civitas/change-analyst
npm run start:relay                      # another terminal
npm run seed:agents                      # writes .local/agents/{analyst,sdk,triage,dispatch}.env
```

With `OPENAI_API_KEY` exported privately (never in arguments or commits):

```sh
node --env-file=.local/agents/analyst.env apps/change-analyst/dist/index.js analyze maint-001
# receiver view, with its own credential:
node --env-file=.local/agents/triage.env apps/change-analyst/dist/index.js updates
```

`subscribe` subscribes the loaded agent to `project/maintenance-api` (the seed
script already does this for receivers).

## Retries and run IDs

Each `analyze` reserves `.local/analyst/<run-id>/`; reuse of an ID is refused, so
a failed model run needs a new ID. If the publish response is lost or fails after
review, `review <run-id>` re-shows the saved packet, asks for approval again, and
republishes it through MCP with the same `analyst:<run-id>` key, without calling
the model; the relay returns the same event while its deduplication state exists
(memory mode loses it on restart). Keep checkpoints private and unedited; hash and
space checks detect changes. The LangGraph checkpoint is in memory only, so a
crash mid-analysis is not resumable.

## Recorded run

`examples/api-change/spec/sample-published-packet.json` is the published event
from run `maint-real-02` (`openai:gpt-4.1-mini`, auto-approved with the gated flag,
local in-memory relay). It inferred P1 → urgent from CHANGELOG.md, tagged P2/P3
unresolved, and noted the `/work-orders/{id}` sunset. It is model output, not
ground truth: it also presents the v1.4.0 `status` filter and `next_cursor` as new
in v2, and its contract evidence lists only the query parameter rename, missing the
schema-level `priority` → `priority_code` changes and the new `access_notes` field.
Always read the packet before approving.
