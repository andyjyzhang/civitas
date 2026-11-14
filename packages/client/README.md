# HTTP client

Planned TypeScript package shared by integrations. No exports are implemented yet.

Own typed HTTP calls, response validation, errors, pagination, timeouts, and safe
retries. Take the relay URL and credentials explicitly; do not read local files or
environment variables implicitly. Keep server-only credentials out of browser
code. Retry writes only with stable idempotency keys and honor rate-limit delays.

Depend on [contracts](../contracts/README.md), not relay internals. Follow the
[protocol](../../docs/protocol.md) and add transport checks as implementation begins.
