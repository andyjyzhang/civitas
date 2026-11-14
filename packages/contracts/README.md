# Shared contracts

Planned TypeScript package. No exports or validation library are implemented yet.

Own event/request/response schemas, error codes, topic validation/matching, and
wire-to-MCP adapters. Infer types from runtime schemas where practical. Keep this
package independent of the database, web framework, agent provider, and secrets.

First checks should cover valid and invalid topics, subtree boundaries, payload
limits, initial/subsequent versions, and malformed requests. Follow the
[proposed protocol](../../docs/protocol.md). Pin a validation library and build
configuration when implementing this package.
