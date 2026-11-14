# Desktop companion

Intended product surface, not implemented. Framework and OS targets are undecided.
Follow [product surfaces](../../docs/product-surfaces.md).

Build sign-in, agent linking with reviewed MCP configuration, space selection,
bridge/sync status, and an open-website action. Reuse `packages/client` and the
local bridge from `packages/cli`; no duplicate tool or relay implementation.

Start after the durable relay and Deep Agents demo work. Minimal local UI comes
before packaging/signing/auto-update. Downloadable GitHub release assets are lower
priority; a public source repo is a separate submission requirement. Do not claim
an installer or supported platform until it has been built and verified.
