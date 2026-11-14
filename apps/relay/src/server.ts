import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError } from 'fastify';
import {
  PublishContextInputSchema, SubscribeInputSchema, GetUpdatesInputSchema,
  topicMatches, type ContextEvent, type Delivery, type Subscription,
} from '@civitas/contracts';

type Config = { spaceId: string; agents: Map<string, string> };
class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

// Object key order is immaterial when retrying equivalent JSON bodies.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createRelay(config: Config) {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, requestTimeout: 10000 });
  const subscriptions = new Map<string, Subscription>();
  const inboxes = new Map<string, Delivery[]>();
  const published = new Map<string, { body: string; event: ContextEvent }>();

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const status = error instanceof HttpError ? error.statusCode : (error.statusCode || 500);
    reply.code(status).send({ error: {
      code: error instanceof HttpError ? error.code : status === 413 ? 'PAYLOAD_TOO_LARGE' : status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
      message: error instanceof HttpError ? error.message : status === 413 ? 'Publish payload exceeds 64 KiB.' : status < 500 ? 'Invalid request.' : 'Relay request failed.',
      requestId: request.id,
    } });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({
    error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: request.id },
  }));

  app.get('/healthz', async () => ({ status: 'ok' }));
  // Explicitly reports the current backend; there is no database readiness claim.
  app.get('/readyz', async () => ({ status: 'ready', storage: 'memory', durable: false }));

  app.register(async routes => {
    routes.addHook('onRequest', async request => {
      const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization || '');
      const agentId = match && config.agents.get(match[1]);
      if (!agentId) throw new HttpError(401, 'UNAUTHORIZED', 'A valid agent credential is required.');
      const { spaceId } = request.params as { spaceId: string };
      if (spaceId !== config.spaceId) throw new HttpError(404, 'NOT_FOUND', 'Space not found.');
    });
    function actor(authorization: string | undefined): string {
      return config.agents.get(authorization!.slice(7))!;
    }

    routes.post('/v1/spaces/:spaceId/contexts', async request => {
      const parsed = PublishContextInputSchema.safeParse(request.body);
      if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Invalid publish payload: ' + parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      const input = parsed.data;
      if (input.contextId !== undefined) throw new HttpError(400, 'NOT_IMPLEMENTED', 'Appending versions is deferred; this relay creates version 1 only.');
      const agentId = actor(request.headers.authorization);
      const retryKey = JSON.stringify([agentId, config.spaceId, input.idempotencyKey]);
      const body = canonical(input);
      const existing = published.get(retryKey);
      if (existing) {
        if (existing.body !== body) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'This retry key was already used for different content.');
        return existing.event;
      }
      const { idempotencyKey: _retry, contextId: _context, expectedVersion: _version, ...content } = input;
      const event: ContextEvent = {
        ...content, schemaVersion: 1, eventId: `evt_${randomUUID()}`, contextId: `ctx_${randomUUID()}`,
        spaceId: config.spaceId, version: 1, previousVersion: null,
        publisherAgentId: agentId, publishedAt: new Date().toISOString(),
      };
      // Synchronous mutation makes event creation and fanout atomic within this process.
      published.set(retryKey, { body, event });
      const delivered = new Set<string>();
      for (const subscription of subscriptions.values()) {
        if (delivered.has(subscription.agentId) || !topicMatches(subscription.topic, event.topic)) continue;
        delivered.add(subscription.agentId);
        const inbox = inboxes.get(subscription.agentId) || [];
        inbox.push({ deliveryId: `dlv_${randomUUID()}`, event, deliveredAt: event.publishedAt, acknowledgedAt: null, status: 'pending' });
        inboxes.set(subscription.agentId, inbox);
      }
      return event;
    });

    routes.post('/v1/spaces/:spaceId/subscriptions', async request => {
      const parsed = SubscribeInputSchema.safeParse(request.body);
      if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Provide one exact topic, for example project/maintenance-api.');
      const agentId = actor(request.headers.authorization);
      const key = JSON.stringify([agentId, config.spaceId, parsed.data.topic]);
      const existing = subscriptions.get(key);
      if (existing) return existing;
      const subscription: Subscription = {
        subscriptionId: `sub_${randomUUID()}`, spaceId: config.spaceId,
        agentId, topic: parsed.data.topic, createdAt: new Date().toISOString(),
      };
      subscriptions.set(key, subscription);
      return subscription;
    });

    routes.get('/v1/spaces/:spaceId/updates', async request => {
      const parsed = GetUpdatesInputSchema.safeParse(request.query);
      if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Invalid inbox query.');
      if (parsed.data.cursor !== undefined || parsed.data.limit !== undefined) {
        throw new HttpError(400, 'NOT_IMPLEMENTED', 'Pagination is deferred; omit cursor and limit.');
      }
      return { items: inboxes.get(actor(request.headers.authorization)) || [], nextCursor: null };
    });
  });
  return app;
}
