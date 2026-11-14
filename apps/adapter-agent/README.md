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
node dist/index.js adapt <role> [runId]          one process per role
  1. lane budget check, BudgetGuard on every model call (nested calls included)
  2. Civitas MCP bridge (packages/cli) over stdio, env = relay URL + this role's token only
  3. createDeepAgent (gpt-4.1-mini by default) with
       /repo/     read-only FilesystemBackend (virtualMode) on examples/consumers/<role>/
       /work/     editable scratch copy (agent state)
       /patches/  /notes/   scratch (agent state); writes elsewhere are denied
       tools: get_updates (space injected; output wrapped as untrusted data),
              make_patch (diffs /work/ against the pristine consumer -> /patches/<role>.diff,
                          and reports a tsc --noEmit check of the patched consumer),
              submit_patch (interruptOn; MemorySaver checkpointer)
  4. agent plans (write_todos), reads the update and code, edits /work/, runs make_patch,
     writes notes, calls submit_patch -> graph pauses
  5. runner prints diff + notes + last type-check result (control characters escaped) and asks
     `Apply this patch to <role>? Type "apply <role>"`
  6. approve: copy consumer to .local/adapter/<runId>/<role>/ (own git repo), reject
     paths outside it, `git apply --check` then `git apply`, resume with approve,
     then MCP acknowledge_update(acknowledged)
     reject: resume with reject; nothing applied, nothing acknowledged
     apply failure: one retry where the agent is told the error; otherwise not acknowledged
  7. run record .local/adapter/<runId>/<role>.json (+ <role>.diff, <role>.notes.md)
```

The model never sees `acknowledge_update`; the runner acknowledges only after a
successful approved apply. Retrieved context is treated as untrusted data in the system
prompt and tool output. `examples/consumers/` is never modified, so the demo repeats.

Design note: the agent produces the diff through `make_patch` (computed with git from its
`edit_file` changes) rather than typing raw diff text. An early run where gpt-4.1-mini
hand-wrote a whole-file diff produced a truncated patch that `git apply` rejected. The
type-check was added after a run whose sdk patch applied but did not compile. Patches still
need real review: verified runs left unknown codes (beyond P1-P3) throwing in the sdk decoder
and passed `work_order_id` to `GET /maintenance-requests/{id}` in dispatch.

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
