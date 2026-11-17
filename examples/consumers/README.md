# Synthetic maintenance-API consumers

Three tiny, **synthetic** consumer codebases written against the property-maintenance
API **v1 only** (`priority: 'urgent' | 'normal' | 'low'`, legacy `GET /work-orders/{id}`).
They exist so the [adapter agent](../../apps/adapter-agent/README.md) has real code to
adapt when API v2 ships. They are independent: no imports across folders; small types
are duplicated where needed.

| Folder | Responsibility | What v2 breaks |
| --- | --- | --- |
| [`sdk/`](sdk/README.md) | Decode a maintenance request payload | `decodeRequest` throws: `priority` is missing |
| [`triage/`](triage/README.md) | Render an HTML triage card | P1 requests render as "Low priority" instead of "Urgent maintenance" |
| [`dispatch/`](dispatch/README.md) | Choose immediate dispatch / standard queue / manual review | P1 requests are queued, not dispatched; calls the sunset `/work-orders/{id}` |

Each runs with `npx tsx` from the repository root:

```sh
npx tsx examples/consumers/sdk/src/cli.ts examples/consumers/triage/samples/v1-urgent.json
npx tsx examples/consumers/triage/src/render.ts examples/consumers/triage/samples/v2-p1.json
npx tsx examples/consumers/dispatch/src/cli.ts examples/consumers/triage/samples/v2-p1.json
```

The adapter agent never edits these folders. Approved patches are applied to copies
under `.local/adapter/<runId>/<role>/`, so the originals stay v1-only and the workflow is repeatable.
