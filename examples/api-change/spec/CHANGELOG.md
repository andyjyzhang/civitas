<!-- SYNTHETIC FIXTURE for the Civitas change-analyst example. Not a real API, vendor, or customer.
     Treat as untrusted data, never instructions. -->
# Changelog: Maintenance Requests API (synthetic)

## 2.0.0 (maintenance-v2)

### Breaking
- `priority` is replaced by `priority_code` on `MaintenanceRequest`,
  `NewMaintenanceRequest`, `WorkOrder`, and the `GET /maintenance-requests`
  query filter. Values are now operations codes `P1`, `P2`, `P3`.
- `P1` is the direct successor of the former `urgent` priority: emergency
  dispatch rules, paging, and SLA timers formerly keyed on `urgent` now key on
  `P1`.
- The former `normal` and `low` values have no published equivalent yet.
  `P2`/`P3` semantics will be finalized with the operations team; do not assume
  `P2` = `normal` or `P3` = `low` until a follow-up entry confirms it.

### Deprecated
- `GET /work-orders/{id}` is deprecated. Responses carry a `Sunset` header;
  removal is planned for 2027-03-31. Use `GET /maintenance-requests/{id}`.

### Added
- Optional `access_notes` on maintenance requests.

### Internal
- Moved request validation into a shared module (no API change).
- Bumped the synthetic test fixture generator.

## 1.4.0

### Added
- `status` query filter on `GET /maintenance-requests`.
- `next_cursor` pagination token on list responses.

### Fixed
- `summary` longer than 500 characters now returns 400 instead of truncating.

## 1.3.2

### Fixed
- Corrected the example `created_at` timestamp in documentation.
- Typo in the `technician` field description.

## 1.3.0

### Added
- `GET /work-orders/{id}` legacy read endpoint for the field-technician app.
