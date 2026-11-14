# sdk (synthetic consumer)

Typed decoder for maintenance request payloads from the maintenance API **v1**.
Exports `MaintenanceRequest` and `decodeRequest(json)`; rejects payloads without a valid
`priority`. `src/cli.ts <payload.json>` prints the decoded request.
