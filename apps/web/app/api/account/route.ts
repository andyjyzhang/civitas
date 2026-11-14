import { cookies } from 'next/headers';
import { CivitasApiError } from '@civitas/client';
import { accountClientFor, baseUrl, accountCookieName, cookieName, createSession, deleteSession, json, sameOrigin, session } from '../../../lib/relay';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const current = await session(accountCookieName);
  if (!current) return json({ error: 'Sign in to manage your spaces and agents.' }, 401);
  try { const query=new URL(request.url).searchParams; const client=accountClientFor(current.token);
    if(query.has('room'))return json(await client.room(query.get('room')!));
    if(query.has('directory'))return json(await client.directory());
    return json(await client.overview()); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const { operation, input = {} } = await request.json();
    const jar = await cookies();
    if (operation === 'register' || operation === 'login') {
      const client = accountClientFor();
      const result = operation === 'register' ? await client.register(input) : await client.login(input);
      deleteSession(jar.get(accountCookieName)?.value);
      jar.set(accountCookieName, createSession(result.token), { httpOnly: true, sameSite: 'strict', secure: new URL(request.url).protocol === 'https:', path: '/', maxAge: 8 * 60 * 60 });
      return json({ account: result.account });
    }
    const current = await session(accountCookieName);
    if (!current) return json({ error: 'Sign in first.' }, 401);
    const client = accountClientFor(current.token);
    if (operation === 'logout') {
      await client.logout();
      for (const name of [accountCookieName, cookieName]) { deleteSession(jar.get(name)?.value); jar.delete(name); }
      return json({ ok: true });
    }
    if (operation === 'createSpace') return json(await client.createSpace(input.name,{kind:input.kind,visibility:input.visibility}));
    if (operation === 'joinServer') return json(await client.joinServer(input.spaceId));
    if (operation === 'post') return json(await client.post(input.spaceId,input.post));
    if (operation === 'setPublisher') return json(await client.setPublisher(input.spaceId,input.accountId,input.canPublish));
    if (operation === 'invite') return json(await client.invite(input.spaceId, input.email));
    if (operation === 'acceptInvite') return json(await client.acceptInvite(input.token));
    if (operation === 'createAgent') return json({ ...await client.createAgent(input.name), relayUrl: baseUrl() });
    if (operation === 'setGrant') return json(await client.setGrant(input.spaceId, { agentId: input.agentId, read: input.read, publish: input.publish }));
    return json({ error: 'Unknown account operation.' }, 400);
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  if (error instanceof CivitasApiError) return json({ error: error.message }, error.status);
  return json({ error: 'Could not complete the account request. Check your fields and relay connection.' }, 400);
}
