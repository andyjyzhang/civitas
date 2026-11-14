import { z } from 'zod';

// Temporary boundary validators for sprint 1B. Replace with contracts exports
// when 1A supplies them; these are intentionally not a second public schema API.
const id = z.string().min(1);
const topic = z.string().max(128).regex(/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/);
const source = z.object({ uri: z.string().min(1), revision: z.string().min(1), excerpt: z.string().optional() });
const publish = z.object({ topic, title: z.string().min(1), content: z.string().min(1), source, idempotencyKey: id }).strict();
const subscriptionInput = z.object({ topic }).strict();
const updatesInput = z.object({ cursor: id.optional(), limit: z.number().int().min(1).max(100).optional() }).strict();
const timestamp = z.iso.datetime();
const event = z.object({
  schemaVersion: z.literal(1), eventId: id, contextId: id, spaceId: id,
  topic, title: z.string(), content: z.string(), source,
  version: z.number().int().positive(), previousVersion: z.number().int().positive().nullable(),
  publisherAgentId: id, publishedAt: timestamp,
});
const subscription = z.object({ topic, subscriptionId: id, spaceId: id, agentId: id, createdAt: timestamp });
const delivery = z.object({ deliveryId: id, event, deliveredAt: timestamp,
  acknowledgedAt: timestamp.nullable(), status: z.enum(['pending', 'acknowledged', 'dismissed']) });
const page = z.object({ items: z.array(delivery), nextCursor: z.string().nullable() });
const apiError = z.object({ error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }) });

export type PublishContextInput = z.infer<typeof publish>;
export type ContextEvent = z.infer<typeof event>;
export type SubscribeInput = z.infer<typeof subscriptionInput>;
export type Subscription = z.infer<typeof subscription>;
export type GetUpdatesInput = z.infer<typeof updatesInput>;
export type Delivery = z.infer<typeof delivery>;
export type UpdatesPage = z.infer<typeof page>;

export class CivitasApiError extends Error {
  constructor(public readonly status: number, public readonly code: string,
    message: string, public readonly requestId?: string) {
    super(message);
    this.name = 'CivitasApiError';
  }
}

export function createCivitasClient({ baseUrl, token }: { baseUrl: string; token: string }) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Relay URL must be HTTP(S), without credentials, query, or fragment');
  }
  if (!token.trim() || /[\r\n]/.test(token)) throw new Error('Agent token is required and must not contain newlines');
  const prefix = base.href.replace(/\/$/, '');
  const spacePath = (spaceId: string) => `/v1/spaces/${encodeURIComponent(id.parse(spaceId))}`;

  async function request<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    let response: Response;
    let data: unknown;
    try {
      response = await fetch(prefix + path, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      data = await response.json();
    } catch {
      // Avoid leaking credentials through runtime fetch diagnostics.
      throw new Error('Relay request failed: connection, timeout, redirect, or invalid JSON response');
    }
    if (!response.ok) {
      const parsed = apiError.safeParse(data);
      if (parsed.success) {
        const error = parsed.data.error;
        throw new CivitasApiError(response.status, error.code, error.message, error.requestId);
      }
      throw new CivitasApiError(response.status, 'INVALID_ERROR_RESPONSE', 'Relay returned an invalid error response');
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new Error('Relay returned an invalid response shape');
    return parsed.data;
  }

  return {
    publishContext(spaceId: string, input: PublishContextInput) {
      const body = publish.parse(input);
      if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 64 * 1024) throw new Error('Publish body exceeds 64 KiB');
      return request(spacePath(spaceId) + '/contexts', event, body);
    },
    subscribe(spaceId: string, input: SubscribeInput) {
      return request(spacePath(spaceId) + '/subscriptions', subscription, subscriptionInput.parse(input));
    },
    getUpdates(spaceId: string, input: GetUpdatesInput = {}) {
      const parsed = updatesInput.parse(input);
      const query = new URLSearchParams();
      if (parsed.cursor !== undefined) query.set('cursor', parsed.cursor);
      if (parsed.limit !== undefined) query.set('limit', String(parsed.limit));
      return request(spacePath(spaceId) + '/updates' + (query.size ? `?${query}` : ''), page);
    },
  };
}
