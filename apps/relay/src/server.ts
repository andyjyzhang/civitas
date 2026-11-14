import Fastify, { type FastifyError } from 'fastify';
import { PublishContextInputSchema, SubscribeInputSchema, GetUpdatesInputSchema, AckUpdateInputSchema, RegisterAccountInputSchema, LoginAccountInputSchema, NameInputSchema, InviteInputSchema, AcceptInviteInputSchema, GrantInputSchema, CreateSpaceInputSchema, RoomPostInputSchema, ConnectGroupAgentInputSchema, GroupMessageReplyInputSchema } from '@civitas/contracts';
import { HttpError, MemoryStorage, type RelayStorage } from './storage.js';
import { Accounts, IdentityStore } from './accounts.js';

type Config = { spaceId: string; agents: Map<string, string> };
export function createRelay(config: Config, storage: RelayStorage = new MemoryStorage(), accounts = new Accounts(new IdentityStore())) {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, requestTimeout: 10000 });
  const demoAgents = [...new Set(config.agents.values())];
  const bearer = (authorization: string | undefined) => {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization || '');
    if (!match) throw new HttpError(401,'UNAUTHORIZED','A valid bearer credential is required.');
    return match[1];
  };
  const auth = new WeakMap<object,{agentId:string;name:string;allowedAgents:string[]}>();
  const parse = <T>(schema: {safeParse(value:unknown):{success:true;data:T}|{success:false}}, value:unknown):T => {
    const result=schema.safeParse(value);
    if (!result.success) throw new HttpError(400,'INVALID_INPUT','Invalid request fields.');
    return result.data;
  };
  const loginAttempts=new Map<string,{count:number;until:number}>();
  const limitAccount = (ip:string) => {
    const now=Date.now();
    for (const [key,value] of loginAttempts) if(value.until<=now) loginAttempts.delete(key);
    const current=loginAttempts.get(ip) || {count:0,until:now+60000};
    if (current.count>=30 || loginAttempts.size>1000) throw new HttpError(429,'RATE_LIMITED','Please wait before trying account sign-in again.');
    current.count++;loginAttempts.set(ip,current);
  };
  app.post('/v1/accounts/register',async request=>{limitAccount(request.ip);return accounts.register(parse(RegisterAccountInputSchema,request.body));});
  app.post('/v1/accounts/login',async request=>{limitAccount(request.ip);return accounts.login(parse(LoginAccountInputSchema,request.body));});
  app.post('/v1/accounts/logout',async request=>accounts.logout(bearer(request.headers.authorization)));
  app.get('/v1/account',async request=>accounts.overview(bearer(request.headers.authorization)));
  app.post('/v1/spaces',async request=>{const input=parse(CreateSpaceInputSchema,request.body);return accounts.createSpace(bearer(request.headers.authorization),input.name,input.kind,input.visibility);});
  app.post('/v1/agents',async request=>accounts.createAgent(bearer(request.headers.authorization),parse(NameInputSchema,request.body).name));
  app.post('/v1/invites/accept',async request=>accounts.accept(bearer(request.headers.authorization),parse(AcceptInviteInputSchema,request.body).token));
  app.post<{Params:{spaceId:string}}>('/v1/spaces/:spaceId/invites',async request=>accounts.invite(bearer(request.headers.authorization),request.params.spaceId,parse(InviteInputSchema,request.body).email));
  app.post<{Params:{spaceId:string}}>('/v1/spaces/:spaceId/grants',async request=>accounts.grant(bearer(request.headers.authorization),request.params.spaceId,parse(GrantInputSchema,request.body)));

  app.post<{Params:{spaceId:string}}>('/v1/spaces/:spaceId/connect-agent',async request=>accounts.connectGroupAgent(bearer(request.headers.authorization),request.params.spaceId,parse(ConnectGroupAgentInputSchema,request.body)));
  app.get('/v1/servers',async request=>accounts.directory(bearer(request.headers.authorization)));
  app.get<{Params:{spaceId:string}}>('/v1/spaces/:spaceId/room',async request=>{
    const spaceId=request.params.spaceId;
    const room=await accounts.room(bearer(request.headers.authorization),spaceId);
    // Membership is checked before reading the space's explicitly published agent context.
    const snapshot=await storage.snapshot(spaceId,[]);
    const posts=[...room.posts,...snapshot.events.map(event=>({postId:event.eventId,spaceId,authorId:event.publisherAgentId,authorName:event.publisherAgentId,content:event.content,createdAt:event.publishedAt,title:`${event.title} · v${event.version}`,topic:event.topic,source:event.source,origin:'agent'}))]
      .sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-100);
    return {...room,posts};
  });
  app.post<{Params:{spaceId:string}}>('/v1/spaces/:spaceId/join',async request=>accounts.joinServer(bearer(request.headers.authorization),request.params.spaceId));
  app.post<{Params:{spaceId:string}}>('/v1/spaces/:spaceId/posts',async request=>accounts.post(bearer(request.headers.authorization),request.params.spaceId,parse(RoomPostInputSchema,request.body)));
  app.post<{Params:{spaceId:string}}>('/v1/spaces/:spaceId/publishers',async request=>{
    const input=request.body as {accountId?:unknown;canPublish?:unknown};
    if(!input||typeof input.accountId!=='string'||typeof input.canPublish!=='boolean')throw new HttpError(400,'INVALID_INPUT','Provide accountId and canPublish.');
    return accounts.setPublisher(bearer(request.headers.authorization),request.params.spaceId,input.accountId,input.canPublish);
  });

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
      const credential = bearer(request.headers.authorization);
      const { spaceId } = request.params as { spaceId: string };
      const demoAgent = config.agents.get(credential);
      const permission = request.method === 'POST' && (request.routeOptions.url?.endsWith('/contexts') || request.routeOptions.url?.endsWith('/reply')) ? 'publish' : 'read';
      let access;
      if (demoAgent) {
        if (spaceId !== config.spaceId) throw new HttpError(404, 'NOT_FOUND', 'Space not found.');
        access={agentId:demoAgent,name:'Maintenance API',allowedAgents:demoAgents};
      } else access=await accounts.authorize(credential,spaceId,permission);
      auth.set(request,access);
      await storage.touch(spaceId,access.agentId);
    });
    const actor = (request: object) => auth.get(request)!;
    routes.get<{Params:{spaceId:string}}>('/v1/spaces/:spaceId/group-messages',async request=>accounts.groupMessages(request.params.spaceId,actor(request).agentId));
    routes.post<{Params:{spaceId:string;messageId:string}}>('/v1/spaces/:spaceId/group-messages/:messageId/reply',async request=>accounts.replyToGroupMessage(request.params.spaceId,actor(request).agentId,request.params.messageId,parse(GroupMessageReplyInputSchema,request.body).content));
    routes.get('/v1/spaces/:spaceId/activity', async request => ({
      space: { spaceId: (request.params as {spaceId:string}).spaceId, name: actor(request).name },
      currentAgentId: actor(request).agentId,
      ...await storage.snapshot((request.params as {spaceId:string}).spaceId, actor(request).allowedAgents),
      storage: storage.mode,
    }));
    routes.post('/v1/spaces/:spaceId/contexts', async request => {
      const parsed = PublishContextInputSchema.safeParse(request.body);
      if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Invalid publish payload. Check the shared contract fields.');
      return storage.publish((request.params as {spaceId:string}).spaceId, actor(request).agentId, parsed.data, actor(request).allowedAgents);
    });
    routes.post('/v1/spaces/:spaceId/subscriptions', async request => {
      const parsed = SubscribeInputSchema.safeParse(request.body);
      if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Provide one exact topic, for example project/maintenance-api.');
      return storage.subscribe((request.params as {spaceId:string}).spaceId, actor(request).agentId, parsed.data.topic);
    });
    routes.get('/v1/spaces/:spaceId/updates', async request => {
      const parsed = GetUpdatesInputSchema.safeParse(request.query);
      if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Invalid inbox query.');
      return storage.updates((request.params as {spaceId:string}).spaceId, actor(request).agentId, parsed.data);
    });
    routes.post('/v1/spaces/:spaceId/updates/:deliveryId/ack', async request => {
      const {spaceId,deliveryId}=request.params as {spaceId:string;deliveryId:string};
      return storage.acknowledge(spaceId,actor(request).agentId,deliveryId,parse(AckUpdateInputSchema,request.body).status);
    });
    routes.get('/v1/spaces/:spaceId/analytics', async request => {
      const query = request.query as Record<string, unknown>;
      if (Object.keys(query).some(key => !['from', 'to'].includes(key))) throw new HttpError(400, 'INVALID_INPUT', 'Use only from/to UTC timestamps.');
      const to = query.to === undefined ? new Date() : typeof query.to === 'string' ? new Date(query.to) : new Date(NaN);
      const from = query.from === undefined ? new Date(to.getTime() - 3600000) : typeof query.from === 'string' ? new Date(query.from) : new Date(NaN);
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to.getTime() - from.getTime() > 7 * 86400000) {
        throw new HttpError(400, 'INVALID_INPUT', 'Supply a valid range of at most seven days.');
      }
      return storage.analytics((request.params as {spaceId:string}).spaceId, from.toISOString(), to.toISOString());
    });
  });
  return app;
}
