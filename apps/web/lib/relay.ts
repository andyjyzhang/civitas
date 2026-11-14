import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { createCivitasClient } from '@civitas/client';
import { ActivitySnapshotSchema } from '@civitas/contracts';

type Session = { token: string; expiresAt: number };
const state = globalThis as typeof globalThis & { civitasSessions?: Map<string, Session> };
const sessions = state.civitasSessions ??= new Map<string, Session>();
export const cookieName = 'civitas_session';
export const spaceId = () => process.env.CIVITAS_DEMO_SPACE_ID || 'sp_demo';
const baseUrl = () => process.env.CIVITAS_RELAY_URL || `http://127.0.0.1:${process.env.RELAY_PORT || 4000}`;

export function clientFor(token: string) {
  return createCivitasClient({ baseUrl: baseUrl(), token });
}

export async function activity(token: string) {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/v1/spaces/${encodeURIComponent(spaceId())}/activity`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      signal: AbortSignal.timeout(5000), redirect: 'error',
    });
  } catch { throw new Error('Relay is unavailable. Start it and reconnect.'); }
  if (response.status === 401 || response.status === 404) throw new Error('This agent key cannot access the configured space.');
  if (!response.ok) throw new Error('Could not load relay activity.');
  return ActivitySnapshotSchema.parse(await response.json());
}

export function createSession(token: string) {
  for (const [key, value] of sessions) if (value.expiresAt < Date.now()) sessions.delete(key);
  const id = randomBytes(32).toString('hex');
  sessions.set(id, { token, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return id;
}

export async function session() {
  const id = (await cookies()).get(cookieName)?.value;
  const value = id && sessions.get(id);
  if (!value || value.expiresAt < Date.now()) {
    if (id) sessions.delete(id);
    return null;
  }
  return value;
}

export function deleteSession(id: string | undefined) {
  if (id) sessions.delete(id);
}

export function sameOrigin(request: Request) {
  // Next normalizes the internal request URL to localhost, even when the browser
  // connects to 127.0.0.1. Compare the browser origin with the actual Host header.
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === `${new URL(request.url).protocol}//${request.headers.get('host')}`;
  } catch { return false; }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
