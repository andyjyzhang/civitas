import Fastify, { type FastifyError } from 'fastify';
import { PublishContextInputSchema, SubscribeInputSchema, GetUpdatesInputSchema } from '@civitas/contracts';
import { HttpError, MemoryStorage, type RelayStorage } from './storage.js';

type Config = { spaceId: string; agents: Map<string, string> };
export function createRelay(config: Config, storage: RelayStorage = new MemoryStorage()) {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, requestTimeout: 10000 });
  const allowedAgents = [...new Set(config.agents.values())];
  app.addHook('onClose', async () => { await storage.close(); });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const status = error instanceof HttpError ? error.statusCode : (error.statusCode || 503);
    reply.code(status).send({ error: {
      code: error instanceof HttpError ? error.code : status === 413 ? 'PAYLOAD_TOO_LARGE' : status < 500 ? 'INVALID_REQUEST' : 'STORAGE_UNAVAILABLE',
      message: error instanceof HttpError ? error.message : status === 413 ? 'Publish payload exceeds 64 KiB.' : status < 500 ? 'Invalid request.' : 'Relay storage is unavailable; retry with the same publish key.',
      requestId: request.id,
    } });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({
    error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: request.id },
  }));
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/readyz', async () => {
    await storage.ready();
    return { status: 'ready', storage: storage.mode, durable: storage.mode === 'postgres', analyticsEnabled: storage.analyticsEnabled };
  });
  app.register(async routes => {
    routes.addHook('onRequest', async request => {
      const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization || '');
      const agentId = match && config.agents.get(match[1]);
      if (!agentId) throw new HttpError(401, 'UNAUTHORIZED', 'A valid agent credential is required.');
      const { spaceId } = request.params as { spaceId: string };
      if (spaceId !== config.spaceId) throw new HttpError(404, 'NOT_FOUND', 'Space not found.');
      await storage.touch(config.spaceId, agentId);
    });
    const actor = (authorization: string | undefined) => config.agents.get(authorization!.slice(7))!;
    routes.get('/v1/spaces/:spaceId/activity', async request => ({
      space: { spaceId: config.spaceId, name: 'Maintenance API' },
      currentAgentId: actor(request.headers.authorization),
      ...await storage.snapshot(config.spaceId, allowedAgents),
      storage: storage.mode,
    }));
    routes.post('/v1/spaces/:spaceId/contexts', async request => {
      const parsed = PublishContextInputSchema.safeParse(request.body);
      if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Invalid publish payload. Check the shared contract fields.');
      if (parsed.data.contextId !== undefined) throw new HttpError(400, 'NOT_IMPLEMENTED', 'Appending versions is deferred; this relay creates version 1 only.');
      return storage.publish(config.spaceId, actor(request.headers.authorization), parsed.data, allowedAgents);
    });
    routes.post('/v1/spaces/:spaceId/subscriptions', async request => {
      const parsed = SubscribeInputSchema.safeParse(request.body);
      if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Provide one exact topic, for example project/maintenance-api.');
      return storage.subscribe(config.spaceId, actor(request.headers.authorization), parsed.data.topic);
    });
    routes.get('/v1/spaces/:spaceId/updates', async request => {
      const parsed = GetUpdatesInputSchema.safeParse(request.query);
      if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Invalid inbox query.');
      if (parsed.data.cursor !== undefined || parsed.data.limit !== undefined) throw new HttpError(400, 'NOT_IMPLEMENTED', 'Pagination is deferred; omit cursor and limit.');
      return { items: await storage.updates(config.spaceId, actor(request.headers.authorization)), nextCursor: null };
    });
    routes.get('/v1/spaces/:spaceId/analytics', async request => {
      const query = request.query as Record<string, unknown>;
      if (Object.keys(query).some(key => !['from', 'to'].includes(key))) throw new HttpError(400, 'INVALID_INPUT', 'Use only from/to UTC timestamps.');
      const to = query.to === undefined ? new Date() : typeof query.to === 'string' ? new Date(query.to) : new Date(NaN);
      const from = query.from === undefined ? new Date(to.getTime() - 3600000) : typeof query.from === 'string' ? new Date(query.from) : new Date(NaN);
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to.getTime() - from.getTime() > 7 * 86400000) {
        throw new HttpError(400, 'INVALID_INPUT', 'Supply a valid range of at most seven days.');
      }
      return storage.analytics(config.spaceId, from.toISOString(), to.toISOString());
    });
  });
  return app;
}
