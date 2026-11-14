# dispatch (synthetic consumer)

Decides how a maintenance request from API **v1** is handled: `immediate-dispatch`
(urgent), `standard-queue`, or `manual-review` (work order on hold). It looks up the work
order through the legacy `GET /work-orders/{id}` endpoint. `src/cli.ts <payload.json>`
prints the decision using an offline stub for the lookup (no network).
