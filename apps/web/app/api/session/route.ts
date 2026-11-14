import { cookies } from 'next/headers';
import { activity, cookieName, createSession, deleteSession, json, sameOrigin } from '../../../lib/relay';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const body = await request.json();
    if (typeof body.token !== 'string' || body.token.length < 24 || body.token.length > 512) {
      return json({ error: 'Enter a valid local agent key.' }, 400);
    }
    await activity(body.token);
    const jar = await cookies();
    deleteSession(jar.get(cookieName)?.value);
    jar.set(cookieName, createSession(body.token), {
      httpOnly: true, sameSite: 'strict', secure: new URL(request.url).protocol === 'https:',
      path: '/', maxAge: 8 * 60 * 60,
    });
    return json({ connected: true });
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? 'Invalid request.' : error instanceof Error ? error.message : 'Could not connect.' }, 400);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  const jar = await cookies();
  deleteSession(jar.get(cookieName)?.value);
  jar.delete(cookieName);
  return json({ connected: false });
}
