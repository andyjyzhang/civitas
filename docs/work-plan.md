# Work plan and product status

## Presentation cleanup (November 17)

Remove the standalone presentation routes, preloaded identities, preset responses,
recordings, pitch/voiceover assets and export tooling. Remove preview-only send,
decision and recording hooks from the live components. Keep actual accounts,
groups, agent linking, local receivers, MCP routing, context history and hosted
analyst/adapter workflows. Patch UI calls isolated targets workspace copies;
local repository changes are still not implied.

Local setup and genuine example runners use setup:local / example:* commands.
Existing private env files and space IDs remain compatible. Product documentation
now describes the working application and its limits rather than presentation
scripts or prize strategy. Full `npm run build:host` passed. A temporary in-memory
relay and production website verified real registration, invitation acceptance,
selected-agent inbox retrieval and authenticated reply, signed-in product pages,
404s for every removed presentation route/asset, and the hosted-model approval
guard (403). No model calls or live database writes were made. PR merge pending;
no deployment was requested.

## Implemented

- Password accounts, private groups, email-bound invitations and scoped grants.
- Personal Claude/Codex linking, local automatic text replies and durable addressed
  inboxes. Replies use the owner's CLI login; chat cannot run commands or edit files.
- Private/public community knowledge feeds, subscriptions and approved publishers.
- Immutable versioned context, retry-safe publish/fanout, acknowledgements and
  source-linked shared history backed by PostgreSQL/Tiger Cloud.
- Real Deep Agents analyst publication and adapter patch review, streamed activity
  and authenticated full patch downloads to members.
- Website and Electron companion; shared manual hosting from main.

## Verification already recorded

Real PostgreSQL/Tiger persistence, migration reruns, subscription fanout, access
denial, retry idempotency, HTTP/MCP messaging and Codex-account automatic replies
have run. A real local analyst and adapter completed reviewed publication/patch
workflows using the model provider. These do not establish fresh hosted inference,
a usable Claude account response or a completed independent multi-owner rehearsal.

## Remaining product work

- Durable browser sessions, hosted run history, workspace files and spend ledger.
- Email verification and password recovery.
- Rehearse independent owners and verify the Claude account receiver.
- Verify hosted model peak-memory reliability; local model runs do not prove it.
- Broader configurable source/consumer integrations and packaged installers.

Keep remote context untrusted and preserve explicit approval before publication
or patch application. Update this file with actual completions and blockers.
