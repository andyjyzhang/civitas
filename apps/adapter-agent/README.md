# Adapter agent (Deep Agents receiver)

Receives a Civitas context update and proposes a reviewed patch that adapts one
synthetic consumer (`examples/consumers/{sdk,triage,dispatch}`) to the announced API
change. A human approves the patch before it is applied, and only then is the
delivery acknowledged.

**Honest framing:** the three consumer instances share **one agent definition**
(`src/agent.ts`) and **one owner** (this repository). Each role runs as its own process
with its own Civitas agent credential and inbox, but they are not independent teams.

## Flow

```text
analyst publishes on project/maintenance-api
      │  (Civitas relay: one delivery per subscribed agent)
      ▼
agent server run (graph "adapter")  or  node dist/index.js adapt <role> [runId]
  1. lane budget check; BudgetGuard on the chat model itself (every call, nested included)
  2. Civitas MCP bridge (packages/cli) over stdio per call, env = relay URL + this role's token only
  3. buildAdapterAgent (src/agent.ts, gpt-4.1-mini by default) = createDeepAgent with
       /repo/     read-only FilesystemBackend (virtualMode) on the consumer path from agents.config.json
       /work/     editable copy, seeded into agent state at thread start (middleware)
       /patches/  /notes/   scratch (agent state); writes elsewhere are denied
       tools: get_updates (space injected; output wrapped as untrusted data),
              make_patch (diffs /work/ against the pristine consumer -> /patches/<role>.diff,
                          and reports a tsc --noEmit check of the patched consumer),
              submit_patch (checks, then human review, then apply + acknowledge; below)
  4. agent plans (write_todos), reads the update and code, edits /work/, runs make_patch,
     writes notes, calls submit_patch
  5. submit_patch automatic checks: patch_path is /patches/<role>.diff, diff and /notes/<role>.md
     exist in state, delivery_id is a current delivery of this role on the consumer topic
     (re-read via get_updates), paths stay inside the consumer, `git apply --check` + apply on a
     scratch copy, tsc OK. Failure -> error tool result back to the model (max 2), then the run fails.
  6. pass -> langchain v1 HITL interrupt (approve | reject); CLI prints diff + notes and asks
     `Apply this patch to <role>? Type "apply <role>"`
  7. approve: copy consumer to <runDir>/<role>/ (own git repo), `git apply --check` then
     `git apply`, tsc check, then MCP acknowledge_update(acknowledged)
     reject: nothing applied, nothing acknowledged, agent stops
  8. run record <runDir>/<role>.json (+ <role>.diff, <role>.notes.md)
     runDir = .local/workspace-runs/<spaceId>/<runId>/ (server) or .local/adapter/<runId>/ (CLI)
```

The model never sees `acknowledge_update`; the server-side tool acknowledges only after a
successful approved apply. Retrieved context is treated as untrusted data in the system
prompt and tool output. `examples/consumers/` is never modified, so the demo repeats.

Design note: the agent produces the diff through `make_patch` (computed with git from its
`edit_file` changes) rather than typing raw diff text. An early run where gpt-4.1-mini
hand-wrote a whole-file diff produced a truncated patch that `git apply` rejected. The
type-check was added after a run whose sdk patch applied but did not compile. Patches still
need real review: verified runs left unknown codes (beyond P1-P3) throwing in the sdk decoder
and passed `work_order_id` to `GET /maintenance-requests/{id}` in dispatch.

## Agent server

Served as graph `adapter` by `npm run agents` (see the "Agent server" section of
`apps/change-analyst/README.md` for server flags, stream modes and storage notes). Graph
factory config: `configurable: { spaceId, role, runId }`; `role` must be a
`consumers` role in `agents.config.json`, `spaceId` `^sp_[A-Za-z0-9_-]{1,200}$`, `runId`
`^[A-Za-z0-9_-]{1,100}$`, all validated before file access or spend. Credentials:
`.local/workspace-agents/<spaceId>/<role>.env` (same space required; extra keys ignored).
Input: `{ messages: [{ role: 'user', content: '<goal>' }] }`.

State the UI renders: `todos`, `files` (`/work/...` seeded copy, `/patches/<role>.diff`,
`/notes/<role>.md`, content as `string[]` lines or string), `messages`. There are no
subagents (the general-purpose subagent is disabled so it cannot inherit `submit_patch`), so
no `task` calls. At the interrupt, diff and notes are already in `values.files`.

Interrupt value:

```json
{
  "actionRequests": [{ "name": "submit_patch",
    "args": { "delivery_id": "dlv_...", "patch_path": "/patches/triage.diff", "summary": "..." },
    "description": "Apply /patches/triage.diff to a private copy ... Automatic checks passed (git apply --check, TypeScript: OK) ..." }],
  "reviewConfigs": [{ "actionName": "submit_patch", "allowedDecisions": ["approve", "reject"] }],
  "civitas": { "kind": "adapter", "role": "triage", "checks": "passed", "typecheck": "OK",
    "deliveryId": "dlv_...", "eventId": "evt_...", "eventTopic": "project/maintenance-api",
    "patchPath": "/patches/triage.diff", "notesPath": "/notes/triage.md",
    "copyDir": ".local/workspace-runs/<spaceId>/<runId>/triage" }
}
```

Resume with `command: { resume: { decisions: [{ type: 'approve' }] } }` or
`{ decisions: [{ type: 'reject', message: '...' }] }` (anything but approve rejects).

`submit_patch` results are pretty-printed JSON with `applied` and `acknowledged` booleans.
Applied (status `success`): `{ "outcome": "applied", "applied": true, "acknowledged": true,
"deliveryId", "copyDir", "patchFile", "diffStat", "typecheck", "ack": { ...relay delivery } }`.
Every other outcome is an **error-status** tool message with `"applied": false`:
`check_failed` (with `problems`, bounced to the model), `rejected` (`reviewerMessage`),
`apply_failed` (`error`; not acknowledged).

## Run

Needs a relay plus seeded agents (`npm run seed:agents` writes `.local/agents/<role>.env`),
a published update on `project/maintenance-api`, and `npm run build:bridge`.

```sh
npm run build -w @civitas/adapter-agent
npm run adapt -w @civitas/adapter-agent -- triage demo1     # interactive approval (TTY)
npm run adapt -w @civitas/adapter-agent -- sdk demo1
npm run adapt -w @civitas/adapter-agent -- dispatch demo1
npm run preview -w @civitas/adapter-agent -- demo1          # .local/adapter/demo1/triage-preview.html
```

Environment: `OPENAI_API_KEY`, `CIVITAS_MODEL` (default `gpt-4.1-mini`, must be priced
in `src/budget.ts`), `CIVITAS_SPEND_LEDGER`, `CIVITAS_ADAPTER_LANE_LIMIT_USD` (default 3,
sum of `adapter-agent` ledger entries), `CIVITAS_ADAPTER_ENV_FILE` (override credential
file), `CIVITAS_ADAPTER_TOPIC`. Without a TTY the runner refuses to apply unless
`CIVITAS_ADAPTER_AUTO_APPROVE=1` is set, which prints a loud warning; use it only for
local verification.

The preview renders `triage/samples/v2-p1.json` and `v2-p2.json` with both the original
and the patched triage consumer.
