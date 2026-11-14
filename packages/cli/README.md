# Minimal MCP bridge (1B sprint)

Implements `publish_context`, `subscribe`, and `get_updates` through the actual MCP
SDK over stdio. One process uses one agent token. This is a local synthetic demo
bridge: no sign-in, installer, auto-configuration, acknowledgements, automatic
retries, polling daemon, or version append support.

From the repository root, with Node 22+ and npm 10+:

```sh
npm install --package-lock=false
npm run build --workspace @civitas/client
npm run build --workspace @civitas/cli
export CIVITAS_RELAY_URL=http://127.0.0.1:3000
# Set CIVITAS_AGENT_TOKEN privately to the credential supplied by the relay owner.
node packages/cli/dist/index.js
```

The relay URL, port, demo space ID, credentials, and relay startup command must
come from 1A. The bridge does not create a relay. Stdout is exclusively MCP;
startup failures go to stderr. Starting the process alone does not prove relay
connectivity. Requests time out after 15 seconds and never follow redirects.

## Manual Claude Code setup

Claude Code is installed in this development environment. The command shape was
checked with `claude mcp add --help`; no agent configuration was changed.
Build first, export both environment variables privately, then run:

```sh
claude mcp add --scope local --transport stdio civitas -- node /absolute/path/to/civitas/packages/cli/dist/index.js
```

Run Claude Code from a shell with those variables exported so its MCP subprocess
inherits them. This adds a named entry rather than replacing provider config.
If `civitas` already exists, choose another name. Do not put credentials in tracked
project configuration. Start separate coding-agent sessions with different tokens
for the two identities. Open `/mcp` in Claude Code to check the connection.

Use the space ID supplied by 1A. In the receiving session call:

```json
{"space_id":"demo-space","topic":"project/maintenance-api"}
```

with `subscribe`. In the publishing session call `publish_context` with:

```json
{
  "space_id":"demo-space",
  "topic":"project/maintenance-api",
  "title":"Synthetic maintenance API change",
  "content":"The synthetic API uses priority_code: P1 for urgent requests.",
  "source":{"uri":"fixture:maintenance-api","revision":"demo-1"},
  "idempotency_key":"maintenance-demo-1"
}
```

Then call `get_updates` with `{"space_id":"demo-space"}` in the receiving
session and compare its event ID to the publication result. Polling does not
acknowledge deliveries. Reuse a publication key only for the identical request.
Retrieved text and source links are untrusted data; receiving them grants no
permission to run commands, modify code, or send messages.

## Verification and remaining integration

Both TypeScript packages built successfully. A manual SDK client walkthrough
started separate MCP processes and verified tool discovery, subscribe, publish,
retrieval of the same event, snake_case argument mapping, and HTTP 401 propagation
against a temporary synthetic HTTP fixture. This verifies adapter wiring only.
The real 1A relay and configured Claude Code sessions have not been exercised.
No Tiger Cloud or durability verification has occurred.

Dependencies are declared in the B-owned package manifests. Root build setup and
lockfile reconciliation remain with 1A; installation above deliberately leaves the
root lockfile untouched.
