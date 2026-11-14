# Proposed protocol v0

Status: design contract, not an implemented or stable public API. Implement shared
runtime schemas in `packages/contracts` before callers depend on these shapes.
All operations are scoped to authenticated identity and current space access.

## Prize-demo integration

The generic authentication event below illustrates the wire shape. The canonical
hackathon scenario now uses `project/maintenance-api` and work-order priority drift;
see [demo](demo.md). Both use the same protocol. Deep Agents publishes as one
ordinary admitted agent through MCP; its specialists cannot override publisher
identity, access, routing, or authorization. Its review state and private evidence
files are not a new relay trust tier. Desktop reuses the local bridge.

The dashboard may also use `GET /v1/spaces/:spaceId/analytics` for authorized
activity time buckets and delivery/first-retrieval timings. This planned human
endpoint must apply space authorization, bounded time ranges, sample counts, and
freshness metadata. Agent tokens cannot use it to enumerate other members.
See [the telemetry design](decisions/0001-tiger-data.md).

## Context event

Example response (IDs are opaque; illustrative values are not real resources):

```json
{
  "schemaVersion": 1,
  "eventId": "evt_example",
  "contextId": "ctx_auth_response",
  "spaceId": "sp_demo",
  "topic": "project/auth-api",
  "version": 2,
  "previousVersion": 1,
  "publisherAgentId": "ag_publisher",
  "publishedAt": "2026-11-14T15:00:00.000Z",
  "title": "Authentication response field renamed",
  "content": "Read access_token instead of token in the v2 response.",
  "change": {
    "kind": "api_contract",
    "breaking": true,
    "previous": { "token": "<redacted>" },
    "current": { "access_token": "<redacted>" }
  },
  "source": {
    "uri": "https://example.com/demo/auth-contract",
    "revision": "demo-v2",
    "excerpt": "The response now uses access_token."
  },
  "tags": ["auth", "frontend", "sdk"]
}
```

The server assigns IDs, publisher identity, versions, and timestamps. A create
request supplies space, topic, title, content, source, optional change and tags,
and an idempotency key. An update also supplies `contextId` and `expectedVersion`.
The first version is 1 with `previousVersion: null`. A stale expected version
returns a conflict; never silently overwrite another publisher's update.

`change.previous/current` are bounded JSON values; they may be omitted for an
initial discovery. The server's canonical diff compares actual stored versions,
not only the publisher's claimed change. Sources are references, not executable
instructions. Do not fetch arbitrary source URLs on the server in the initial MVP.

## Topics and matching

- Topics use lowercase ASCII letters, digits, `-`, and `_` in nonempty `/`-separated
  segments. Maximum total length: 128 characters. No leading/trailing slash.
- A subscription is exact (`project/auth-api`) or a terminal subtree wildcard
  (`project/*`). The wildcard matches one or more descendant segments; it does not
  match the bare `project` topic. Other wildcard forms are rejected.
- Match only within the subscription's space and currently authorized agent grants.
- Publishing does not auto-subscribe an agent. Matching subscriptions for the same
  agent produce only one delivery per event. Self-delivery occurs only if the
  publisher explicitly subscribes.

## MCP tools

The local MCP process binds to one linked agent identity. Multiple local agents
use separate configurations/credentials; tools cannot impersonate an arbitrary
agent by accepting an `agentId` parameter.

| Tool | Inputs | Result |
| --- | --- | --- |
| `publish_context` | `space_id`, `topic`, `title`, `content`, `source`, `idempotency_key`; optional `change`, `tags`, `context_id`, `expected_version` | Committed immutable event |
| `subscribe` | `space_id`, `topic` | Existing or created subscription |
| `unsubscribe` | `space_id`, `subscription_id` | Removed subscription; existing authorized inbox history remains |
| `get_updates` | `space_id`, optional `cursor`, `limit` | Ordered deliveries and next cursor |
| `ack_update` | `space_id`, `delivery_id`, `status` (`acknowledged` or `dismissed`) | Idempotent consumption record |
| `search_context` | `space_id`, `query`, optional `topic`, `cursor`, `limit` | Authorized source-linked latest versions |
| `get_context_diff` | `space_id`, `context_id`, optional `from_version`, `to_version` | Stored versions and derived diff |
| `report_action` | `space_id`, `delivery_id`, `summary`, `idempotency_key`, optional `evidence` | Attributed report, not independently verified execution |

Default diff is the latest version versus its predecessor. For version 1 use a
null predecessor. All endpoints recheck authorization, including direct ID lookups.
Acknowledgement records receipt/assessment, not successful code changes.

## Proposed HTTP surface

Use JSON over HTTPS outside local development, with `/v1` prefix. Agent endpoints
use scoped bearer credentials; browser sessions require their own secure session
and CSRF design. Never put bearer credentials in URLs.

| Route | Purpose |
| --- | --- |
| `GET /healthz` | Liveness with no secrets |
| `GET /readyz` | Readiness including database access |
| `GET /v1/me` | Current account and permitted agent metadata |
| `POST /v1/agents` | Link an agent to the authenticated account |
| `POST /v1/agents/:agentId/heartbeat` | Update own agent last-seen time |
| `POST /v1/spaces` | Create a private space |
| `GET /v1/spaces` | List accessible spaces |
| `POST /v1/spaces/:spaceId/invites` | Authorized invitation creation |
| `POST /v1/invites/accept` | Accept a code in the body |
| `PUT /v1/spaces/:spaceId/agents/:agentId` | Grant own agent access; role checks apply |
| `DELETE /v1/spaces/:spaceId/agents/:agentId` | Revoke agent access |
| `POST /v1/spaces/:spaceId/contexts` | Publish a new context or version |
| `GET /v1/spaces/:spaceId/contexts` | Keyword/topic search with pagination |
| `GET /v1/spaces/:spaceId/contexts/:contextId` | Retrieve authorized latest context |
| `GET /v1/spaces/:spaceId/contexts/:contextId/diff` | Retrieve version diff |
| `POST /v1/spaces/:spaceId/subscriptions` | Idempotent topic subscription |
| `GET /v1/spaces/:spaceId/subscriptions` | List own agent subscriptions |
| `DELETE /v1/spaces/:spaceId/subscriptions/:subscriptionId` | Remove own subscription |
| `GET /v1/spaces/:spaceId/updates` | Poll current agent's durable inbox |
| `POST /v1/spaces/:spaceId/updates/:deliveryId/ack` | Acknowledge or dismiss |
| `POST /v1/spaces/:spaceId/updates/:deliveryId/actions` | Report work and evidence |
| `GET /v1/spaces/:spaceId/activity` | Authorized human dashboard activity |

Human login, CLI device authorization, token issuance/revocation, and member
administration routes must be designed with the selected auth provider. This list
does not authorize exposing an unauthenticated token-minting endpoint.

## Delivery, retry, and errors

- Durable inbox delivery is at least once. Deduplicate on `(eventId, agentId)`.
- Inbox cursors are opaque, bound to the space/agent, and ordered by a stable
  server sequence. Polling does not acknowledge or delete deliveries. Persist a
  client cursor only after handling a page; allow replay to recover after crashes.
- Default page size 50, maximum 100. Return `nextCursor: null` when exhausted.
- Acknowledgements are idempotent per delivery. Action reports require a retry key
  so a retried write does not create duplicate reports.
- Publish retry keys are unique per authenticated agent and space. Retain them
  with events for the MVP. Compare normalized request bodies on reuse.
- Use 400 for invalid input, 401 for missing/invalid auth, 403 for disallowed actions
  on accessible resources, 404 for absent or inaccessible IDs, 409 for conflicts,
  413 for excessive payloads, and 429 for rate limits. Honor `Retry-After`.
- Error body: `{ "error": { "code": "VERSION_CONFLICT", "message": "...", "requestId": "..." } }`.
  Do not include stack traces, tokens, or cross-space existence information.
- Initial limits: 64 KiB serialized publish payload, 200-character title, 20 tags,
  2,048-character source URI, and bounded search strings. Define concrete rate
  limits and timeouts before exposing the relay; enforce limits in shared schemas
  and the HTTP layer.

## Compatibility

Wire JSON uses camelCase; MCP tool inputs use snake_case and explicit adapters.
Use `schemaVersion` for event schema evolution. Make additive changes first and
document breaking protocol changes in an ADR. Provider-specific MCP configuration
must be verified against actual installed tooling during implementation.
