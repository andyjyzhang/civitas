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

The agent is built once in `src/analyst.ts` (`buildAnalystAgent`) and used by both
the CLI and the agent server. `publish_context` itself runs the automatic checks
before any human sees the candidate: plan executed, both delegations succeeded,
both evidence files exist, schema-valid packet, topic/source scope,
`unresolved:P2`/`unresolved:P3` tags (maintenance source), an "Unresolved"
section, a CHANGELOG citation, and `change.kind = field-replacement`,
`breaking = true`. A failing candidate goes back to the model once as an error
tool result listing the problems; a second failure fails the run with nothing
published. A passing candidate pauses the graph with a langchain v1
human-in-the-loop interrupt (same shape `interruptOn` produces, raised inside the
tool so nothing can publish without passing the checks and the review). On
approve the same tool call publishes exactly its arguments plus the
runner-injected scope; on reject nothing is published and the agent stops.

CLI: a passing candidate is saved to `.local/analyst/<run-id>/review.json`, and the
exact relay arguments plus both evidence files are printed (control characters
escaped). Type `publish <run-id>` to approve; anything else rejects. The returned
event is saved to `published.json`.

Approval needs an interactive terminal. For automated verification only,
`--approve` is honoured when `CIVITAS_ANALYST_AUTO_APPROVE=1` is set; the runner
prints a loud notice that no human approved.

## Model and spend guard

OpenAI only for now. `CIVITAS_MODEL` defaults to `gpt-4.1-mini`; `OPENAI_API_KEY`
must be set privately. `BudgetGuard` (`src/budget.ts`) is attached to the chat
model's own callbacks (so it also works under the agent server, which ignores
graph-level callbacks), and subagents share that model, so nested calls are
priced and appended to the spend ledger (`CIVITAS_SPEND_LEDGER`, default `.local/model-spend.jsonl`). The guard
refuses to start past `CIVITAS_SPEND_LIMIT_USD` and aborts past
`CIVITAS_RUN_LIMIT_USD`. Note: deepagents 1.16.5 only adds todo-list middleware
for Codex harness profiles, so the runner supplies `todoListMiddleware()` itself;
the default general-purpose subagent is disabled so the publish tool is reachable
only from the coordinator.

## Agent server

`npm run agents` (repo root) starts a local LangGraph agent server on
`127.0.0.1:2024` from `langgraph.json` with graphs `analyst`
(`src/graph.ts`) and `adapter` (`apps/adapter-agent/src/graph.ts`). It runs with
`--no-reload`: with hot reload, any rebuild of a workspace dependency (e.g.
`packages/contracts/dist`) restarts the server mid-run and the server then
retries the run from scratch. Threads and checkpoints are in the server's
in-memory store (flushed to `.langgraph_api/`), not durable storage. Model keys
come from `.local/model.env` (optional) or the process environment.

Both graphs are factories: each run builds its agent from `config.configurable`,
validated before any file access or spend.

- analyst: `{ spaceId, sourceId, runId }`. `spaceId` matches
  `^sp_[A-Za-z0-9_-]{1,200}$`, `runId` `^[A-Za-z0-9_-]{1,100}$`, `sourceId` is an
  `agents.config.json` source. `/repo/` = the source `path`, only its `files`
  readable. Topic, sourceUri and revision come from the config entry.
- Credentials: `.local/workspace-agents/<spaceId>/analyst.env` (must name the
  same `CIVITAS_DEMO_SPACE_ID`; extra keys are ignored). Only relay URL and token
  are passed to the MCP bridge child; nothing credential-like enters state,
  messages or metadata. A missing file fails the run before any model call.
- Input: `{ messages: [{ role: 'user', content: '<goal>' }] }`. The safety and
  workflow prompt is server-side; user text is only the goal.
- Idempotency key: `analyst:<runId>`.

Stream with `streamMode: ['values', 'updates']` and `streamSubgraphs: true`
(add `'messages-tuple'` for tokens). State values: `todos`
(`[{ content, status: 'pending'|'in_progress'|'completed' }]`), `files`
(`{ '/evidence/contract.md': { content: string[] | string, ... }, '/evidence/impact.md': ... }`),
`messages` (tool calls incl. `task` with `args.subagent_type` = `contract` or
`impact`). Subagent internals arrive as `updates|tools:<uuid>` /
`values|tools:<uuid>` events; the coordinator usually issues both `task` calls in
the same turn, so they run in parallel and their namespaces interleave. When the
run pauses, the last `values` chunk is only `{ __interrupt__: [...] }`; keep the
previous todos/files (or read `threads.getState`).

Interrupt value (first interrupt on the thread, `next: ['tools']`):

```json
{
  "actionRequests": [{ "name": "publish_context",
    "args": { "title": "...", "content": "# Summary ...", "tags": ["unresolved:P2", "unresolved:P3", "..."],
              "change": { "kind": "field-replacement", "breaking": true, "previous": {...}, "current": {...} } },
    "description": "Publish this context packet to Civitas space sp_..., topic project/maintenance-api, ..." }],
  "reviewConfigs": [{ "actionName": "publish_context", "allowedDecisions": ["approve", "reject"] }],
  "civitas": { "kind": "analyst", "checks": "passed",
    "relayArguments": { "space_id": "sp_...", "title": "...", "content": "...", "tags": [...], "change": {...},
      "topic": "project/maintenance-api", "source": { "uri": "...", "revision": "maintenance-v2" },
      "idempotency_key": "analyst:<runId>" } }
}
```

Resume: `client.runs.stream(threadId, 'analyst', { command: { resume: { decisions: [{ type: 'approve' }] } }, config: { configurable } })`
or `{ decisions: [{ type: 'reject', message: '...' }] }`. Anything other than an
explicit approve is treated as a reject.

`publish_context` tool results are JSON. Published (status `success`):
`{ "outcome": "published", "published": true, "event": { eventId, contextId, version, topic, publisherAgentId, publishedAt }, "instruction": "..." }`.
Every other outcome is an **error-status** tool message:
`{ "outcome": "check_failed", "problems": [...] }` (bounced back to the model),
`{ "outcome": "rejected", "published": false, "reviewerMessage": "..." }`. A second
failed check raises and the run ends in `error` with nothing published.

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
