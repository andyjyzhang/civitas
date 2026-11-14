import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type pg from 'pg';
import type { Account, AccountOverview, Grant, Space } from '@civitas/contracts';
import { HttpError, canonical } from './storage.js';

const scrypt = promisify(scryptCallback);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const fail = () => new HttpError(401,'UNAUTHORIZED','A valid account session is required.');
type RecordData = Record<string, any>;
type State = Map<string, RecordData>;
const key = (kind: string, id: string) => `${kind}:${id}`;
const records = (state: State, kind: string) => [...state.entries()].filter(([id])=>id.startsWith(`${kind}:`)).map(([,data])=>data);

export class IdentityStore {
  private memory: State = new Map();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private pool?: pg.Pool) {}
  async run<T>(work: (state: State)=>T | Promise<T>): Promise<T> {
    if (!this.pool) {
      // Work callbacks contain no awaits; use a copy so failed mutations roll back.
      const operation = this.queue.then(async () => {
        const state = structuredClone(this.memory);
        const result = await work(state);
        this.memory = state;
        return result;
      });
      this.queue = operation.catch(() => {});
      return operation;
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('civitas:identities',0))");
      const rows = await client.query('SELECT kind,record_id,data FROM civitas_identity_records');
      const before: State = new Map(rows.rows.map(row=>[key(row.kind,row.record_id),row.data]));
      const state = structuredClone(before);
      const result = await work(state);
      for (const [id,data] of state) {
        if (before.has(id) && canonical(before.get(id)) === canonical(data)) continue;
        const colon = id.indexOf(':');
        await client.query(`INSERT INTO civitas_identity_records (kind,record_id,data) VALUES ($1,$2,$3)
          ON CONFLICT (kind,record_id) DO UPDATE SET data=EXCLUDED.data`, [id.slice(0,colon),id.slice(colon+1),data]);
      }
      for (const id of before.keys()) if (!state.has(id)) {
        const colon = id.indexOf(':');
        await client.query('DELETE FROM civitas_identity_records WHERE kind=$1 AND record_id=$2',[id.slice(0,colon),id.slice(colon+1)]);
      }
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}

export class Accounts {
  constructor(private store: IdentityStore) {}
  private account(state: State, credential: string) {
    const session = state.get(key('session',digest(credential)));
    if (!session || Date.parse(session.expiresAt) <= Date.now()) throw fail();
    const account = state.get(key('account',session.accountId));
    if (!account) throw fail();
    return account;
  }
  private safe(account: RecordData): Account { return {accountId:account.accountId,email:account.email,name:account.name}; }
  private member(state:State,accountId:string,spaceId:string,owner=false) {
    const membership = state.get(key('member',`${spaceId}:${accountId}`));
    if (!membership || (owner && membership.role !== 'owner')) throw new HttpError(404,'NOT_FOUND','Space not found or management access denied.');
    return membership;
  }
  async register(input:{email:string;password:string;name?:string}) {
    const email = input.email.toLowerCase().trim();
    const salt = randomBytes(16).toString('hex');
    const hash = (await scrypt(input.password,salt,64) as Buffer).toString('hex');
    const credential = token();
    return this.store.run(state=>{
      if (records(state,'account').some(a=>a.email===email)) throw new HttpError(409,'ACCOUNT_EXISTS','An account with this email already exists.');
      const account = {accountId:`acct_${randomUUID()}`,email,name:input.name?.trim() || email.split('@')[0],passwordHash:`${salt}:${hash}`};
      state.set(key('account',account.accountId),account);
      state.set(key('session',digest(credential)),{accountId:account.accountId,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
      return {token:credential,account:this.safe(account)};
    });
  }
  async login(input:{email:string;password:string}) {
    const email = input.email.toLowerCase().trim();
    const account = await this.store.run(state=>records(state,'account').find(a=>a.email===email));
    const [salt,expected] = (account?.passwordHash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const actual = await scrypt(input.password,salt,64) as Buffer;
    if (!account || !timingSafeEqual(actual,Buffer.from(expected,'hex'))) throw new HttpError(401,'UNAUTHORIZED','Email or password is incorrect.');
    const credential = token();
    return this.store.run(state=>{
      for (const [id,session] of state) if (id.startsWith('session:') && Date.parse(session.expiresAt)<=Date.now()) state.delete(id);
      state.set(key('session',digest(credential)),{accountId:account.accountId,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
      return {token:credential,account:this.safe(account)};
    });
  }
  async logout(credential:string) { return this.store.run(state=>{this.account(state,credential);state.delete(key('session',digest(credential)));return {ok:true};}); }
  async overview(credential:string):Promise<AccountOverview> {
    return this.store.run(state=>{
      const account=this.account(state,credential);
      const spaces=records(state,'member').filter(m=>m.accountId===account.accountId).map(m=>({spaceId:m.spaceId,name:state.get(key('space',m.spaceId))!.name,role:m.role,kind:state.get(key('space',m.spaceId))!.kind || 'group',visibility:state.get(key('space',m.spaceId))!.visibility || 'private'}));
      const agents=records(state,'agent').filter(a=>a.accountId===account.accountId).map(a=>({agentId:a.agentId,name:a.name}));
      const ids=new Set(spaces.map(s=>s.spaceId));
      const grants=records(state,'grant').filter(g=>ids.has(g.spaceId)).map(g=>({spaceId:g.spaceId,agentId:g.agentId,read:g.read,publish:g.publish}));
      return {account:this.safe(account),spaces,agents,grants};
    });
  }
  async createSpace(credential:string,name:string,kind:'group'|'server'='group',visibility:'private'|'public'='private'):Promise<Space> {
    return this.store.run(state=>{
      const account=this.account(state,credential);
      if(kind==='group'&&visibility!=='private')throw new HttpError(400,'INVALID_INPUT','Group chats are private.');
      const space={spaceId:`sp_${randomUUID()}`,name,kind,visibility};
      state.set(key('space',space.spaceId),space);
      state.set(key('member',`${space.spaceId}:${account.accountId}`),{spaceId:space.spaceId,accountId:account.accountId,role:'owner'});
      return {...space,role:'owner'};
    });
  }
  async createAgent(credential:string,name:string) {
    const raw=token();
    return this.store.run(state=>{
      const account=this.account(state,credential);
      const agent={agentId:`ag_${randomUUID()}`,accountId:account.accountId,name,tokenHash:digest(raw)};
      state.set(key('agent',agent.agentId),agent);
      return {agentId:agent.agentId,name,token:raw};
    });
  }
  async grant(credential:string,spaceId:string,input:{agentId:string;read:boolean;publish:boolean}):Promise<Grant> {
    return this.store.run(state=>{
      const account=this.account(state,credential);
      this.member(state,account.accountId,spaceId,true);
      const agent=state.get(key('agent',input.agentId));
      if (!agent) throw new HttpError(404,'NOT_FOUND','Agent not found.');
      this.member(state,agent.accountId,spaceId);
      const grant={spaceId,...input};
      state.set(key('grant',`${spaceId}:${input.agentId}`),grant);
      return grant;
    });
  }
  async invite(credential:string,spaceId:string,email:string) {
    const raw=token();
    return this.store.run(state=>{
      const account=this.account(state,credential);
      this.member(state,account.accountId,spaceId,true);
      const invite={inviteId:`inv_${randomUUID()}`,spaceId,email:email.trim().toLowerCase(),expiresAt:new Date(Date.now()+86400000).toISOString(),tokenHash:digest(raw),acceptedBy:null};
      state.set(key('invite',invite.inviteId),invite);
      return {inviteId:invite.inviteId,token:raw,email:invite.email,spaceId,expiresAt:invite.expiresAt};
    });
  }
  async accept(credential:string,raw:string):Promise<Space> {
    return this.store.run(state=>{
      const account=this.account(state,credential);
      const invite=records(state,'invite').find(i=>i.tokenHash===digest(raw));
      if (!invite || invite.email!==account.email || Date.parse(invite.expiresAt)<=Date.now() || (invite.acceptedBy && invite.acceptedBy!==account.accountId)) throw new HttpError(404,'NOT_FOUND','Invitation not found, expired, or addressed to another account.');
      invite.acceptedBy=account.accountId;
      const existing=state.get(key('member',`${invite.spaceId}:${account.accountId}`));
      if (!existing) state.set(key('member',`${invite.spaceId}:${account.accountId}`),{spaceId:invite.spaceId,accountId:account.accountId,role:'member'});
      const space=state.get(key('space',invite.spaceId))!;
      return {spaceId:invite.spaceId,name:space.name,role:existing?.role || 'member',kind:space.kind||'group',visibility:space.visibility||'private'};
    });
  }
  async authorize(raw:string,spaceId:string,permission:'read'|'publish') {
    return this.store.run(state=>{
      const agent=records(state,'agent').find(a=>a.tokenHash===digest(raw));
      if (!agent) throw new HttpError(401,'UNAUTHORIZED','A valid agent credential is required.');
      const grant=state.get(key('grant',`${spaceId}:${agent.agentId}`));
      if (!grant?.[permission]) throw new HttpError(404,'NOT_FOUND','Space not found or access denied.');
      const space=state.get(key('space',spaceId));
      return {agentId:agent.agentId,name:space!.name,allowedAgents:records(state,'grant').filter(g=>g.spaceId===spaceId && g.read).map(g=>g.agentId)};
    });
  }

  async directory(credential:string) {
    return this.store.run(state=>{
      const account=this.account(state,credential);
      return records(state,'space').filter(s=>s.kind==='server'&&s.visibility==='public').map(s=>({spaceId:s.spaceId,name:s.name,joined:state.has(key('member',`${s.spaceId}:${account.accountId}`))}));
    });
  }
  async joinServer(credential:string,spaceId:string) {
    return this.store.run(state=>{
      const account=this.account(state,credential),space=state.get(key('space',spaceId));
      if(!space||space.kind!=='server'||space.visibility!=='public')throw new HttpError(404,'NOT_FOUND','Public server not found.');
      const id=key('member',`${spaceId}:${account.accountId}`);
      if(!state.has(id))state.set(id,{spaceId,accountId:account.accountId,role:'member'});
      return {ok:true};
    });
  }
  async room(credential:string,spaceId:string) {
    return this.store.run(state=>{
      const account=this.account(state,credential),membership=this.member(state,account.accountId,spaceId),space=state.get(key('space',spaceId))!;
      const group=(space.kind||'group')==='group';
      const members=records(state,'member').filter(m=>m.spaceId===spaceId).map(m=>({accountId:m.accountId,name:state.get(key('account',m.accountId))!.name,role:m.role,canPublish:group||m.role==='owner'||m.canPublish===true}));
      const agents=records(state,'grant').filter(g=>g.spaceId===spaceId&&g.read).map(g=>{const a=state.get(key('agent',g.agentId))!;return {agentId:a.agentId,name:a.name,provider:a.provider||'mcp',ownerName:state.get(key('account',a.accountId))!.name,lastSeenAt:a.lastSeenAt||null,canReply:g.publish,owned:a.accountId===account.accountId};});
      return {agents,space:{spaceId,name:space.name,kind:space.kind||'group',visibility:space.visibility||'private',role:membership.role},currentAccountId:account.accountId,canPublish:group||membership.role==='owner'||membership.canPublish===true,members,posts:records(state,'roompost').filter(p=>p.spaceId===spaceId).slice(-100)};
    });
  }
  async post(credential:string,spaceId:string,input:{content:string;title?:string;topic?:string;source?:unknown;targetAgentId?:string;idempotencyKey?:string}) {
    return this.store.run(state=>{
      const account=this.account(state,credential),membership=this.member(state,account.accountId,spaceId),space=state.get(key('space',spaceId))!;
      const server=space.kind==='server';
      if(server&&membership.role!=='owner'&&!membership.canPublish)throw new HttpError(403,'PUBLISH_DENIED','Only approved publishers can post to this server.');
      if(server&&(!input.title||!input.topic||!input.source))throw new HttpError(400,'INVALID_INPUT','Knowledge posts require a title, topic and source.');
      let target;
      if(input.targetAgentId){
        if(server)throw new HttpError(400,'INVALID_INPUT','Direct agent messages belong to project groups.');
        target=state.get(key('agent',input.targetAgentId));const grant=state.get(key('grant',`${spaceId}:${input.targetAgentId}`));
        if(!target||!grant?.read||!grant?.publish)throw new HttpError(404,'NOT_FOUND','Agent is not available to reply in this group.');
      }
      if(input.idempotencyKey){
        const old=records(state,'roompost').find(p=>p.spaceId===spaceId&&p.authorId===account.accountId&&p.idempotencyKey===input.idempotencyKey);
        if(old){if(old.content!==input.content||old.targetAgentId!==input.targetAgentId||old.title!==input.title||old.topic!==input.topic||canonical(old.source)!==canonical(input.source))throw new HttpError(409,'IDEMPOTENCY_CONFLICT','Message retry changed.');return old;}
      }
      const post={postId:`post_${randomUUID()}`,spaceId,authorId:account.accountId,authorName:account.name,content:input.content,createdAt:new Date().toISOString(),...(input.idempotencyKey?{idempotencyKey:input.idempotencyKey}:{}),...(target?{targetAgentId:target.agentId,targetAgentName:target.name}:{}),...(server?{title:input.title,topic:input.topic,source:input.source}:{})};
      state.set(key('roompost',post.postId),post);return post;
    });
  }
  async setPublisher(credential:string,spaceId:string,accountId:string,canPublish:boolean) {
    return this.store.run(state=>{
      const account=this.account(state,credential);this.member(state,account.accountId,spaceId,true);
      if(state.get(key('space',spaceId))?.kind!=='server')throw new HttpError(400,'INVALID_INPUT','Publisher roles belong to servers.');
      const target=this.member(state,accountId,spaceId);target.canPublish=canPublish;return {ok:true};
    });
  }
  async connectGroupAgent(credential:string,spaceId:string,input:{provider:'claude'|'codex';name:string}) {
    const raw=token();
    return this.store.run(state=>{
      const account=this.account(state,credential);this.member(state,account.accountId,spaceId);
      if((state.get(key('space',spaceId))?.kind||'group')!=='group')throw new HttpError(400,'INVALID_INPUT','Connect to a project group here. Server agent access is owner-managed.');
      const agent={agentId:`ag_${randomUUID()}`,accountId:account.accountId,name:input.name,provider:input.provider,tokenHash:digest(raw)};
      state.set(key('agent',agent.agentId),agent);
      state.set(key('grant',`${spaceId}:${agent.agentId}`),{spaceId,agentId:agent.agentId,read:true,publish:true});
      return {agentId:agent.agentId,name:agent.name,token:raw};
    });
  }
  async createAgentLink(credential:string,spaceId:string,input:{provider:'claude'|'codex';name:string}) {
    const code=token();
    return this.store.run(state=>{
      const account=this.account(state,credential);this.member(state,account.accountId,spaceId);
      if((state.get(key('space',spaceId))?.kind||'group')!=='group')throw new HttpError(400,'INVALID_INPUT','Link agents from a project group.');
      const now=Date.now();
      for(const [id,link]of state)if(id.startsWith('agentlink:')&&Date.parse(link.expiresAt)<=now)state.delete(id);
      const expiresAt=new Date(now+5*60000).toISOString();
      state.set(key('agentlink',digest(code)),{accountId:account.accountId,spaceId,...input,expiresAt,used:false});
      return {code,expiresAt};
    });
  }
  async redeemAgentLink(code:string,provider:'claude'|'codex') {
    const raw=token();
    return this.store.run(state=>{
      const link=state.get(key('agentlink',digest(code)));
      if(!link||link.used||link.provider!==provider||Date.parse(link.expiresAt)<=Date.now())throw new HttpError(400,'LINK_INVALID','Link code expired, already used, or does not match this coding tool. Generate a new command in the group.');
      this.member(state,link.accountId,link.spaceId);
      if((state.get(key('space',link.spaceId))?.kind||'group')!=='group')throw new HttpError(404,'NOT_FOUND','Group not found.');
      const agent={agentId:`ag_${randomUUID()}`,accountId:link.accountId,name:link.name,provider,tokenHash:digest(raw)};
      state.set(key('agent',agent.agentId),agent);
      state.set(key('grant',`${link.spaceId}:${agent.agentId}`),{spaceId:link.spaceId,agentId:agent.agentId,read:true,publish:true});
      link.used=true;
      return {agentId:agent.agentId,name:agent.name,token:raw,spaceId:link.spaceId,provider};
    });
  }
  private groupAgent(state:State,spaceId:string,agentId:string,permission:'read'|'publish') {
    const agent=state.get(key('agent',agentId));const grant=state.get(key('grant',`${spaceId}:${agentId}`));
    if(!agent||!grant?.[permission]||(state.get(key('space',spaceId))?.kind||'group')!=='group')throw new HttpError(404,'NOT_FOUND','Group agent access denied.');
    this.member(state,agent.accountId,spaceId);return agent;
  }
  async groupMessages(spaceId:string,agentId:string) {
    return this.store.run(state=>{
      const agent=this.groupAgent(state,spaceId,agentId,'read');const now=new Date().toISOString();agent.lastSeenAt=now;
      const items=records(state,'roompost').filter(p=>p.spaceId===spaceId&&p.targetAgentId===agentId&&!p.repliedAt).slice(0,100);
      for(const post of items)post.retrievedAt??=now;
      return {items};
    });
  }
  async replyToGroupMessage(spaceId:string,agentId:string,messageId:string,content:string) {
    return this.store.run(state=>{
      const agent=this.groupAgent(state,spaceId,agentId,'publish');
      const message=state.get(key('roompost',messageId));
      if(!message||message.spaceId!==spaceId||message.targetAgentId!==agentId)throw new HttpError(404,'NOT_FOUND','Message not addressed to this agent.');
      const previous=records(state,'roompost').find(p=>p.spaceId===spaceId&&p.replyTo===messageId);
      if(previous){if(previous.content!==content)throw new HttpError(409,'REPLY_CONFLICT','This message already has a different reply.');return previous;}
      const now=new Date().toISOString();agent.lastSeenAt=now;message.retrievedAt??=now;message.repliedAt=now;
      const post={postId:`post_${randomUUID()}`,spaceId,authorId:agentId,authorName:agent.name,origin:'agent',content,createdAt:now,replyTo:messageId};
      state.set(key('roompost',post.postId),post);return post;
    });
  }

}
