import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { createCivitasClient, createAccountClient } from '@civitas/client';

type Session = { token: string; expiresAt: number; spaceId?: string };
const state = globalThis as typeof globalThis & { civitasSessions?: Map<string, Session> };
const sessions = state.civitasSessions ??= new Map<string, Session>();
export const cookieName = 'civitas_session';
export const spaceId = () => process.env.CIVITAS_DEMO_SPACE_ID || 'sp_demo';
export const baseUrl = () => process.env.CIVITAS_RELAY_URL || `http://127.0.0.1:${process.env.RELAY_PORT || 4000}`;

export function clientFor(token: string) {
  return createCivitasClient({ baseUrl: baseUrl(), token });
}

export async function activity(token: string, selectedSpace = spaceId()) {
  return clientFor(token).activity(selectedSpace);
}

export function createSession(token: string, selectedSpace?: string) {
  for (const [key, value] of sessions) if (value.expiresAt < Date.now()) sessions.delete(key);
  const id = randomBytes(32).toString('hex');
  sessions.set(id, { token, spaceId: selectedSpace, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return id;
}

export async function session(name = cookieName) {
  const id = (await cookies()).get(name)?.value;
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

export const accountCookieName = 'civitas_account';
export function accountClientFor(token?: string) { return createAccountClient({ baseUrl: baseUrl(), token }); }
