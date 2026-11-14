# Contributing

Start with [local development](docs/development.md) and choose a task from the
[roadmap](docs/roadmap.md). Prefer a small vertical slice that advances the demo.
Discuss changes to the protocol, access model, or repository layout before
building dependent features.

## Workflow

1. Create a descriptive branch such as `feat/space-invites` or `fix/inbox-retries`.
2. Keep one change focused on one outcome. Include schema migrations and affected
   docs in the same pull request.
3. Run `npm run check` and any checks provided by the changed workspace.
4. Explain the behavior change and include evidence of verification. Include UI
   screenshots where layout or interactions change.
5. Call out migration requirements, configuration changes, and unfinished work.

Follow [AGENTS.md](AGENTS.md) for architecture and security conventions. Commit
messages should name the change clearly; no special commit format is required.
Do not check in generated build output, credentials, local database data, or
private context from a live agent session.

## Tests as implementation arrives

Prioritize tests for topic matching, tenant isolation, revoked membership,
immutable versions, conflicting updates, idempotency, and durable inbox retries.
Use integration tests against PostgreSQL for transaction and persistence claims.
Use a small end-to-end flow to verify publish → match → retrieve → acknowledge.
Never add a passing placeholder test that implies a feature works.

## Review expectations

Reviewers should be able to trace a change to an acceptance criterion. Security
checks belong in the relay, not only in the web interface or CLI. New user-facing
flows must report errors honestly and explain required actions without exposing
secrets or unnecessary internals.

The team must select a license before public release. No contributor agreement
or license terms are established by this scaffold.
