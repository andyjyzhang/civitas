# Release and shared-deployment checklist

This is a future readiness checklist, not a request to deploy or publish.
No public package, hosted service, supported release, or license exists yet.

## Product distribution priorities

Website and desktop companion are intended products. A public source repository
supports submission; packaged GitHub release downloads are lower priority. Do not
block the live core demo on signed installers or multi-OS binaries. No desktop
framework, release format, or supported OS is selected yet. See
[product surfaces](product-surfaces.md).

## Prize submission evidence

- [ ] Confirm sponsor-specific rules/opt-ins and main-category eligibility.
- [ ] Retain a real Deep Agents run, approved MCP publish, independent retrieval,
  reviewable code changes, and actual checks; distinguish rehearsals from live data.
- [ ] Retain Tiger Cloud/hypertable/query evidence without credentials.
- [ ] Label customer facts, synthetic domain scenario, and pending validation honestly.
- [ ] Check current submission deadlines and presentation limits against
  [source notes](research/track-requirements.md).

## Before teammates use a shared relay

- [ ] Choose auth provider and CLI sign-in flow; document token expiry/revocation.
- [ ] Apply migrations and verify backups/restoration of the shared database.
- [ ] Configure TLS, exact allowed origins, production secrets, and private DB access.
- [ ] Enforce schema/body limits, rate limits, authorization, and safe rendering.
- [ ] Verify denied cross-space access, revocation, retries, and durable restarts.
- [ ] Provide liveness/readiness checks and logs with request IDs and secret redaction.
- [ ] Document migration ordering, deployment rollback, and operational ownership.

## Before public open-source or npm release

- [ ] Team selects a license and adds the actual LICENSE and package metadata.
- [ ] Confirm npm name availability; do not assume `civitas-relay` is owned.
- [ ] Set maintainer/security contact and enable a private reporting route.
- [ ] Add dependency/security checks and CI for implemented workspaces.
- [ ] Build and inspect the package tarball; exclude credentials, local config,
  internal fixtures, and private source data.
- [ ] Verify install and MCP setup from a clean machine with both supported tools.
- [ ] Document supported runtime/provider versions and self-host configuration.
- [ ] Define retention, deletion/export, and audit-log access for real users.
- [ ] Add release notes, versioning policy, and a tested upgrade/migration path.

Choose hosting, package publication, and account permissions as separate explicit
actions. A local implementation task does not imply a public release.
