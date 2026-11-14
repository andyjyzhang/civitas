# Security and privacy model

Status: requirements for implementation. No authentication or enforcement code
exists yet. Read this alongside [protocol](protocol.md).

## Trust boundaries

The relay is the authorization boundary. Browser clients, MCP callers, source
documents, and context publishers are untrusted. External content is data and
cannot override a receiving agent's instructions or grant execution permission.

Only explicitly selected context may be published. Do not automatically export
conversations, private memories, environment variables, local files, API keys, or
credentials. Source attribution establishes provenance, not factual truth.

## Account and agent identity

Use an established login provider for people; do not build password storage for
the hackathon. The provider and CLI sign-in flow remain decisions to record before
implementation. CLI sign-in must bind the local agent to the signed-in account
without asking users to paste provider credentials into the relay.

Issue revocable credentials bound to a single agent, account, allowed spaces, and
capabilities. Effective access is the intersection of token scope, active account
membership, and the agent's current grant. Hash opaque tokens at rest, redact them
from logs, and use expiry and rotation. Never embed privileged credentials in web
bundles or checked-in MCP configuration. Store local credentials using an OS
credential store or a user-only permissioned file outside the repository.

For browser sessions, use secure HttpOnly cookies, CSRF protection on mutations,
an explicit CORS allowlist, and appropriate session expiration. All non-local
connections require TLS. MCP stdio logs go to stderr, never into protocol stdout.

## Space authorization baseline

| Operation | Minimum authority |
| --- | --- |
| Browse human space activity | Active account member |
| Create/revoke invites | Owner or admin |
| Change another member's access | Owner or admin; admins cannot alter owner |
| Transfer ownership | Current owner; retain exactly one owner |
| Admit own linked agent | Active member; capabilities capped by membership |
| Revoke an agent grant | Agent owner or space owner/admin |
| Publish context | Active admitted agent with publish capability |
| Read/search/diff context | Active admitted agent with read capability, or authorized human session |
| Subscribe/read inbox/acknowledge/report | The bound agent with read capability |

An agent token cannot administer people or mint invitations. The initial member
role may admit its own agents for read/publish; add a reader role only when needed.
Check authorization for every referenced object, not just the URL's space ID.
Do not let role changes create multiple owners or remove the last owner.

Invites must be random, hashed at rest, expiring, revocable, and accepted
transactionally with use limits. Accepting an invite must not automatically admit
all agents on an account. Revoked membership or grants block queued deliveries,
search, history, source metadata, and dashboard access immediately.

## Content and resource protection

- Validate schemas, payload size, topic syntax, pagination, and version references.
- Use parameterized SQL and transactional uniqueness for retries and fanout.
- Render context as escaped text or sanitized Markdown; disallow raw HTML and
  unsafe link schemes. External links must not execute code.
- Store source references without fetching arbitrary URLs. A future fetcher needs
  SSRF protection, egress restrictions, size limits, and redirect validation.
- Apply rate limits to sign-in, invites, publishing, and search; bound request time
  and body size. Never log tokens, invite codes, or complete private payloads.
- Audit publishing, retrieval, acknowledgements, membership/grant mutations, and
  denied access using IDs and request metadata. Keep content out of routine logs.
- Sensitive actions remain subject to the local user's approval policy. Relay
  notifications and action reports never bypass it.

## Required verification

Before a shared deployment, demonstrate cross-space isolation on every read path,
rejection of agent impersonation, denied access after revocation, expired/reused
invite rejection, duplicate retry safety, stale-version conflicts, and safe
rendering of malicious context. Include queued-delivery revocation and direct ID
lookups. Check that secrets are absent from logs and client bundles.

Define retention, deletion, backups, and a private vulnerability reporting route
before storing real team context. Context versions are immutable during normal
operation; controlled administrative deletion for privacy is a separate audited
procedure. Previously retrieved data cannot be remotely recalled.

## Analyst, telemetry, and desktop boundaries

The Deep Agents analyst reads only approved fixtures in a per-account/space/run
virtual filesystem. Its parent and specialist tool lists exclude arbitrary shell,
host filesystem, network, credential, and database tools. Remote instructions stay
data. Publication review binds exact content, destination, and expected version;
resume rechecks authorization. A changed candidate needs new review. Internal
specialists do not gain distinct Civitas identities or broader grants.

Keep checkpoints and traces private and separate from relay records. Shared traces
use synthetic fixtures unless explicit owner consent permits otherwise. Model
provider keys remain server-side; a reviewed publish packet must not include them.

Tiger activity telemetry must contain IDs/timings rather than context bodies. Scope
analytics reads to current space membership, including continuous aggregates if
added. Revoke dashboard access with membership. Database connection credentials
must never enter browser bundles or model context.

The desktop renderer must not have unrestricted host access. Use validated narrow
IPC for linking/configuration, explicit previews for config edits, secure token
storage, and an authenticated sign-in callback/device flow. See
[product surfaces](product-surfaces.md) and [Deep Agents](deep-agents.md).

See [SECURITY.md](../SECURITY.md) for reporting guidance.
