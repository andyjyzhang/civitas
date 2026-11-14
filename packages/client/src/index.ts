import { z } from 'zod';
import {
  PublishContextInputSchema as publish, ContextEventSchema as event,
  SubscribeInputSchema as subscriptionInput, SubscriptionSchema as subscription,
  GetUpdatesInputSchema as updatesInput, UpdatesPageSchema as page,
  AckUpdateInputSchema, AckRecordSchema, ActivitySnapshotSchema, ApiErrorSchema as apiError,
  AccountSessionSchema, AccountOverviewSchema, SpaceSchema, AgentCredentialSchema, InviteSchema, GrantSchema, RoomSchema, RoomPostSchema, ServerDirectorySchema,
  type PublishContextInput, type SubscribeInput, type GetUpdatesInput, type AckUpdateInput,
} from '@civitas/contracts';
export type {
  PublishContextInput, ContextEvent, SubscribeInput, Subscription,
  GetUpdatesInput, Delivery, UpdatesPage, AckUpdateInput, AckRecord,
} from '@civitas/contracts';
const id = z.string().min(1);

export class CivitasApiError extends Error {
  constructor(public readonly status: number, public readonly code: string,
    message: string, public readonly requestId?: string) {
    super(message); this.name = 'CivitasApiError';
  }
}
function transport(baseUrl: string, token?: string) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Relay URL must be HTTP(S), without credentials, query, or fragment');
  }
  if (token !== undefined && (!token.trim() || /[\r\n]/.test(token))) throw new Error('Credential is required and must not contain newlines');
  const prefix = base.href.replace(/\/$/, '');
  return async function request<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    let response: Response; let data: unknown;
    try {
      response = await fetch(prefix + path, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
      });
      data = await response.json();
    } catch { throw new Error('Relay request failed: connection, timeout, redirect, or invalid JSON response'); }
    if (!response.ok) {
      const parsed = apiError.safeParse(data);
      if (parsed.success) { const error = parsed.data.error; throw new CivitasApiError(response.status, error.code, error.message, error.requestId); }
      throw new CivitasApiError(response.status, 'INVALID_ERROR_RESPONSE', 'Relay returned an invalid error response');
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new Error('Relay returned an invalid response shape');
    return parsed.data;
  };
}
const spacePath = (spaceId: string) => `/v1/spaces/${encodeURIComponent(id.parse(spaceId))}`;
export function createCivitasClient({ baseUrl, token }: { baseUrl: string; token: string }) {
  const request = transport(baseUrl, token);
  return {
    publishContext(spaceId: string, input: PublishContextInput) {
      const body = publish.parse(input);
      if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 64 * 1024) throw new Error('Publish body exceeds 64 KiB');
      return request(spacePath(spaceId) + '/contexts', event, body);
    },
    subscribe(spaceId: string, input: SubscribeInput) { return request(spacePath(spaceId) + '/subscriptions', subscription, subscriptionInput.parse(input)); },
    getUpdates(spaceId: string, input: GetUpdatesInput = {}) {
      const parsed = updatesInput.parse(input); const query = new URLSearchParams();
      if (parsed.cursor !== undefined) query.set('cursor', parsed.cursor);
      if (parsed.limit !== undefined) query.set('limit', String(parsed.limit));
      return request(spacePath(spaceId) + '/updates' + (query.size ? `?${query}` : ''), page);
    },
    acknowledgeUpdate(spaceId: string, deliveryId: string, input: AckUpdateInput) {
      return request(spacePath(spaceId) + `/updates/${encodeURIComponent(id.parse(deliveryId))}/ack`, AckRecordSchema, AckUpdateInputSchema.parse(input));
    },
    activity(spaceId: string) { return request(spacePath(spaceId) + '/activity', ActivitySnapshotSchema); },
  };
}
export function createAccountClient({ baseUrl, token }: { baseUrl: string; token?: string }) {
  const request = transport(baseUrl, token);
  return {
    register(input: { email: string; password: string; name?: string }) { return request('/v1/accounts/register', AccountSessionSchema, input); },
    login(input: { email: string; password: string }) { return request('/v1/accounts/login', AccountSessionSchema, input); },
    logout() { return request('/v1/accounts/logout', z.object({ ok: z.literal(true) }), {}); },
    overview() { return request('/v1/account', AccountOverviewSchema); },
    createSpace(name: string, options: {kind?:'group'|'server';visibility?:'private'|'public'} = {}) { return request('/v1/spaces', SpaceSchema, { name, ...options }); },
    room(spaceId:string) { return request(spacePath(spaceId)+'/room',RoomSchema); },
    directory() { return request('/v1/servers',ServerDirectorySchema); },
    joinServer(spaceId:string) { return request(spacePath(spaceId)+'/join',z.object({ok:z.literal(true)}),{}); },
    post(spaceId:string,input:{content:string;title?:string;topic?:string;source?:{uri:string;revision:string}}) { return request(spacePath(spaceId)+'/posts',RoomPostSchema,input); },
    setPublisher(spaceId:string,accountId:string,canPublish:boolean) { return request(spacePath(spaceId)+'/publishers',z.object({ok:z.literal(true)}),{accountId,canPublish}); },
    invite(spaceId: string, email: string) { return request(spacePath(spaceId) + '/invites', InviteSchema, { email }); },
    acceptInvite(token: string) { return request('/v1/invites/accept', SpaceSchema, { token }); },
    createAgent(name: string) { return request('/v1/agents', AgentCredentialSchema, { name }); },
    setGrant(spaceId: string, input: { agentId: string; read: boolean; publish: boolean }) { return request(spacePath(spaceId) + '/grants', GrantSchema, input); },
  };
}
