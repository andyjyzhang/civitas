# Local client and MCP bridge

Planned TypeScript CLI. There is no executable or published npm package yet.

The desktop companion reuses this bridge; it must not duplicate its MCP tools or
create another relay. CLI-first operation lets the core proof work before desktop
packaging. GitHub downloadable release assets are lower priority.

Own account authentication, local agent linking, guided MCP configuration, and a
stdio MCP server bound to one agent identity. Optional polling comes after durable
retrieval. A poller cannot guarantee an inactive coding agent wakes up.

Proposed commands are `civitas-relay init`, `civitas create <name>`, and
`civitas join <invite-code>`. Final executable names and npm package availability
must be decided before packaging. Do not advertise these as runnable today.

Use [client](../client/README.md) for HTTP. Store credentials outside the repository,
preview and seek approval for MCP configuration changes, preserve unrelated config,
and log only to stderr during MCP stdio sessions. Verify actual Claude Code and
Codex setup formats during implementation rather than checking in guessed config.

See [protocol](../../docs/protocol.md) and [security](../../docs/security.md).
