# Civitas HTTP client

Build from the repository root with `npm run build --workspace @civitas/client`.

```ts
import { createCivitasClient } from '@civitas/client';
const client = createCivitasClient({ baseUrl: relayUrl, token: agentToken });
await client.subscribe(spaceId, { topic: 'project/maintenance-api' });
const updates = await client.getUpdates(spaceId);
```

The current sprint exports `publishContext`, `subscribe`, and `getUpdates` only.
Inputs and responses are runtime validated; relay API errors preserve status,
code, message, and request ID through `CivitasApiError`. Transport errors fail
explicitly, with no success fallback or automatic retry. Publish keys are passed
unchanged. Requests have a 15-second timeout and reject redirects.

The contracts package is still a scaffold. Private boundary validators in this
client temporarily implement the sprint wire shapes; replace them with shared
contracts schemas when 1A exports them. No acknowledgement or version append
support is advertised. See [bridge setup](../cli/README.md) for manual integration
and actual verification limits.
