# Deep Agents change analyst

A TypeScript Deep Agents publisher for **synthetic** maintenance API revisions.
One coordinator plans with `write_todos`, delegates to contract and impact
specialists, and writes virtual evidence files. These specialists are internal to
one admitted publisher; they are not independent Civitas agents.

The default StateBackend sees only the three supplied JSON fixtures, not the host
filesystem. There is no shell, browser, network-fetch, or publishing tool in the
model's tool set. Fixtures are read-only and untrusted data. Only the reviewed
packet is sent to Civitas. Source files are sent to your selected model provider.

From the repository root (Node 22+, npm 10+):

```sh
npm install
npm run setup:demo
npm run build:relay
npm run build:bridge
npm run build -w @civitas/change-analyst
npm run start:relay
```

In another terminal, subscribe the recipient **before** publishing:

```sh
node --env-file=.local/receiver.env apps/change-analyst/dist/index.js subscribe
```

Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` privately in your environment, or in an
ignored `.local/model.env` file. Never put keys in command arguments or commit them.
The runner defaults to OpenAI `gpt-4.1`, or Anthropic `claude-sonnet-4-6` when an
Anthropic key is present. Optional `CIVITAS_MODEL_PROVIDER=openai|anthropic` and
`CIVITAS_MODEL` select a model available to your account.

```sh
# With the model key already exported in the shell:
npm run analyze -w @civitas/change-analyst -- maintenance-001
# Alternatively load a private model env file from the root:
node --env-file=.local/model.env apps/change-analyst/dist/index.js analyze maintenance-001

# Review does not require a model credential:
node --env-file=.local/publisher.env apps/change-analyst/dist/index.js review maintenance-001
```

Review prints the full schema-validated packet, target space, and evidence. Type
`publish maintenance-001` at the interactive terminal to publish that exact packet
through the existing MCP `publish_context`. Any other answer leaves it unpublished.
Piped/noninteractive approval is rejected. Read the complete packet before approval;
model output can be wrong. JSON display escapes terminal control characters.

```sh
node --env-file=.local/receiver.env apps/change-analyst/dist/index.js updates
```

The receiver retrieves the actual event using its own MCP process and credential.
Only the relay determines publisher identity. In memory mode, restart loses
subscriptions, events, and retry deduplication. PostgreSQL mode persists these;
see the root README for setup.

Runs live in ignored `.local/analyst/<run-id>/`. A successful analysis saves
`review.json` (packet, evidence, model identifier, fixture digest, and tool-call
record). Required plan/delegation calls and both evidence files are checked before
a review checkpoint is saved. `published.json` records the relay response.

Use a fresh ID for new analysis or after model failure. The directory reservation
prevents rerunning the model under an existing ID. The saved review checkpoint is
the durable approval boundary: restarting review does not invoke the model.
For a lost response or publication failure, repeat **review with the same ID** and
approve again. The saved body and `analyst:<run-id>` key stay identical, so the relay
returns the same event while its deduplication state exists. Keep checkpoints
private and do not edit them; packet hash/space checks detect accidental changes.
No mid-analysis LangGraph crash recovery is implemented.

Dependencies are declared in this workspace and recorded in the root lockfile;
`npm install` or `npm ci` from the root installs them. No deployment or public
publication is performed by building or analysis.
