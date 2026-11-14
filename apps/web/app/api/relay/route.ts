import { CivitasApiError } from '@civitas/client';
import { activity, clientFor, json, sameOrigin, session, spaceId } from '../../../lib/relay';

export const runtime = 'nodejs';

export async function GET() {
  const current = await session();
  if (!current) return json({ error: 'Connect with your local agent key.' }, 401);
  try { return json(await activity(current.token)); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Relay unavailable.' }, 502); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  const current = await session();
  if (!current) return json({ error: 'Connect with your local agent key.' }, 401);
  try {
    const body = await request.json();
    const client = clientFor(current.token);
    if (body.operation === 'subscribe') return json(await client.subscribe(spaceId(), body.input));
    if (body.operation === 'publish') return json(await client.publishContext(spaceId(), body.input));
    if (body.operation === 'retrieve') return json(await client.getUpdates(spaceId()));
    return json({ error: 'Unknown operation.' }, 400);
  } catch (error) {
    if (error instanceof CivitasApiError) return json({ error: error.message }, error.status);
    return json({ error: 'The request could not complete. Check the fields and relay connection.' }, 400);
  }
}
