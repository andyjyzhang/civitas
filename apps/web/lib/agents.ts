import 'server-only';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client, type Thread } from '@langchain/langgraph-sdk';
import { CivitasApiError, createCivitasClient } from '@civitas/client';
import { accountClientFor, accountCookieName, baseUrl, json, session } from './relay';

// Server-side helpers for the Agents view. The browser never receives Civitas agent
// tokens or talks to the LangGraph agent server directly; every route below checks the
// signed-in account's membership (and ownership for mutations) through the relay.

export class AgentHttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}
export function agentFailure(error: unknown) {
  if (error instanceof AgentHttpError) return json({ error: error.message, ...error.extra }, error.status);
  if (error instanceof CivitasApiError) return json({ error: error.message }, error.status);
  if (isServerDown(error)) return json({ error: SERVER_DOWN, agentServerDown: true }, 503);
  console.error('[agents]', error instanceof Error ? error.message : error);
  return json({ error: 'The agent request could not complete.' }, 502);
}
export const SERVER_DOWN = 'Agent server not running — start it with `npm run agents`.';
function isServerDown(error: unknown) {
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : '';
  return /ECONNREFUSED|fetch failed|ENOTFOUND|EHOSTUNREACH|socket hang up|UND_ERR/i.test(text);
}

// ---------- repository config ----------
type Source = { id: string; label: string; topic: string };
type Consumer = { role: string; label: string; topic: string };
export type AgentsConfig = { agentServerUrl: string; sources: Source[]; consumers: Consumer[] };
let cachedRoot: string | undefined;
export function repoRoot() {
  if (cachedRoot) return cachedRoot;
  if (process.env.CIVITAS_REPO_ROOT && existsSync(path.join(process.env.CIVITAS_REPO_ROOT, 'agents.config.json'))) return cachedRoot = path.resolve(process.env.CIVITAS_REPO_ROOT);
  // `next start` runs in apps/web; `next dev` from the root may run elsewhere. Walk up.
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'agents.config.json')) && existsSync(path.join(dir, 'package.json'))) return cachedRoot = dir;
    const parent = path.dirname(dir); if (parent === dir) break; dir = parent;
  }
  throw new AgentHttpError(500, 'Could not locate agents.config.json from the web server working directory. Set CIVITAS_REPO_ROOT.');
}
const SAFE = /^[A-Za-z0-9_-]{1,100}$/;
export function agentsConfig(): AgentsConfig {
  const raw = JSON.parse(readFileSync(path.join(repoRoot(), 'agents.config.json'), 'utf8'));
  const str = (v: unknown) => typeof v === 'string' ? v : '';
  return {
    agentServerUrl: str(raw.agentServerUrl) || 'http://127.0.0.1:2024',
    sources: (Array.isArray(raw.sources) ? raw.sources : []).filter((s: { id?: unknown }) => SAFE.test(str(s.id))).map((s: Record<string, unknown>) => ({ id: str(s.id), label: str(s.label) || str(s.id), topic: str(s.topic) })),
    consumers: (Array.isArray(raw.consumers) ? raw.consumers : []).filter((c: { role?: unknown }) => SAFE.test(str(c.role)) && str(c.role) !== 'analyst').map((c: Record<string, unknown>) => ({ role: str(c.role), label: str(c.label) || str(c.role), topic: str(c.topic) })),
  };
}
export function agentServerUrl() {
  const url = process.env.CIVITAS_AGENT_SERVER_URL || agentsConfig().agentServerUrl;
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new AgentHttpError(500, 'Agent server URL must be HTTP(S).');
  return parsed.href.replace(/\/$/, '');
}
export function lg() { return new Client({ apiUrl: agentServerUrl(), apiKey: null, timeoutMs: 15_000 }); }
export async function agentServerUp() {
  try { const r = await fetch(agentServerUrl() + '/ok', { signal: AbortSignal.timeout(1500), cache: 'no-store' }); return r.ok; }
  catch { return false; }
}

// ---------- account / space authorization ----------
export async function spaceAccess(spaceId: unknown, needOwner: boolean) {
  const current = await session(accountCookieName);
  if (!current) throw new AgentHttpError(401, 'Sign in to use workspace agents.');
  if (typeof spaceId !== 'string' || !SAFE.test(spaceId)) throw new AgentHttpError(400, 'Choose a valid group.');
  const overview = await accountClientFor(current.token).overview();
  const space = overview.spaces.find(s => s.spaceId === spaceId);
  if (!space) throw new AgentHttpError(404, 'Group not found or you are not a member.');
  if (needOwner && space.role !== 'owner') throw new AgentHttpError(403, 'Only the group owner can control workspace agents.');
  // Public signup must not give visitors access to the host's paid model key.
  // Use immutable account IDs: email ownership is not verified.
  if (needOwner && process.env.CIVITAS_HOSTED_WORKSPACE === 'true') {
    const approved = (process.env.CIVITAS_HOSTED_AGENT_OWNER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    if (!approved.includes(overview.account.accountId)) {
      throw new AgentHttpError(403, 'Hosted workspace agents require approval from the host. Your personal Claude/Codex connection is still available.');
    }
  }
  return { token: current.token, overview, space };
}
export async function threadAccess(threadId: unknown, needOwner: boolean) {
  if (typeof threadId !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(threadId)) throw new AgentHttpError(400, 'Invalid run.');
  let thread: Thread;
  try { thread = await lg().threads.get(threadId); }
  catch (error) { if (isServerDown(error)) throw error; throw new AgentHttpError(404, 'Run not found.'); }
  const meta = thread.metadata as Record<string, unknown> | undefined;
  if (!meta || typeof meta.spaceId !== 'string' || (meta.kind !== 'analyst' && meta.kind !== 'adapter')) throw new AgentHttpError(404, 'Run not found.');
  const access = await spaceAccess(meta.spaceId, needOwner);
  return { thread, ...access };
}
export const newRunId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;

// ---------- workspace agent credentials (.local/workspace-agents/<spaceId>/<role>.env) ----------
export type RoleStatus = { role: string; name: string; present: boolean; agentId?: string; tokenValid?: boolean; subscribed?: boolean; canPublish?: boolean };
const agentName = (role: string) => role === 'analyst' ? 'Analyst agent' : role === 'sdk' ? 'SDK adapter' : `${role[0].toUpperCase()}${role.slice(1)} adapter`;
export const workspaceRoles = () => ['analyst', ...agentsConfig().consumers.map(c => c.role)];
function spaceDir(spaceId: string) {
  if (!SAFE.test(spaceId)) throw new AgentHttpError(400, 'Invalid space.');
  return path.join(repoRoot(), '.local', 'workspace-agents', spaceId);
}
function parseEnv(text: string) {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()); if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); }
  return out;
}
async function readRole(spaceId: string, role: string) {
  try { return parseEnv(await readFile(path.join(spaceDir(spaceId), `${role}.env`), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function workspaceStatus(spaceId: string, verify = true): Promise<RoleStatus[]> {
  const config = agentsConfig();
  return Promise.all(workspaceRoles().map(async role => {
    const env = await readRole(spaceId, role);
    const status: RoleStatus = { role, name: agentName(role), present: Boolean(env?.CIVITAS_AGENT_TOKEN) };
    if (!env?.CIVITAS_AGENT_TOKEN) return status;
    status.agentId = env.CIVITAS_AGENT_ID;
    if (!verify) return status;
    try {
      const snapshot = await createCivitasClient({ baseUrl: baseUrl(), token: env.CIVITAS_AGENT_TOKEN }).activity(spaceId);
      status.tokenValid = true; status.agentId = snapshot.currentAgentId;
      const topic = config.consumers.find(c => c.role === role)?.topic;
      if (topic) status.subscribed = snapshot.subscriptions.some(s => s.agentId === snapshot.currentAgentId && s.topic === topic);
    } catch { status.tokenValid = false; }
    return status;
  }));
}
async function writePrivate(file: string, body: string) {
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, body, { mode: 0o600, flag: 'wx' });
  await chmod(tmp, 0o600);
  await rename(tmp, file);
}
export async function enableWorkspace(spaceId: string, ownerToken: string, mode: 'create' | 'reuse' | 'recreate') {
  const config = agentsConfig();
  const dir = spaceDir(spaceId);
  const existing = await Promise.all(workspaceRoles().map(async role => ({ role, env: await readRole(spaceId, role) })));
  if (mode === 'create' && existing.some(e => e.env)) throw new AgentHttpError(409, 'Workspace agents already exist for this group. Reuse them or re-create new credentials.', { exists: true });
  const account = accountClientFor(ownerToken);
  for (const base of [path.join(repoRoot(), '.local'), path.join(repoRoot(), '.local', 'workspace-agents'), dir]) { await mkdir(base, { recursive: true, mode: 0o700 }); }
  await chmod(path.join(repoRoot(), '.local', 'workspace-agents'), 0o700); await chmod(dir, 0o700);
  const created: string[] = []; const reused: string[] = [];
  for (const { role, env } of existing) {
    const topic = config.consumers.find(c => c.role === role)?.topic;
    let token = env?.CIVITAS_AGENT_TOKEN; let agentId = env?.CIVITAS_AGENT_ID;
    if (token && mode === 'reuse') {
      // Verify the saved credential still works before reusing it.
      try { agentId = (await createCivitasClient({ baseUrl: baseUrl(), token }).activity(spaceId)).currentAgentId; }
      catch (error) { if (!(error instanceof CivitasApiError) || error.status !== 403) token = undefined; }
    }
    if (token && mode === 'recreate' && agentId) {
      await account.setGrant(spaceId, { agentId, read: false, publish: false }).catch(() => undefined); // revoke the old identity
      token = undefined;
    }
    if (!token || !agentId) {
      const credential = await account.createAgent(agentName(role));
      token = credential.token; agentId = credential.agentId; created.push(role);
    } else reused.push(role);
    await account.setGrant(spaceId, { agentId, read: true, publish: role === 'analyst' });
    if (topic) await createCivitasClient({ baseUrl: baseUrl(), token }).subscribe(spaceId, { topic });
    await writePrivate(path.join(dir, `${role}.env`), `CIVITAS_RELAY_URL=${baseUrl()}\nCIVITAS_AGENT_TOKEN=${token}\nCIVITAS_DEMO_SPACE_ID=${spaceId}\nCIVITAS_AGENT_ROLE=${role}\nCIVITAS_AGENT_ID=${agentId}\n`);
  }
  return { created, reused };
}
export async function requireRoleEnabled(spaceId: string, role: string) {
  if (!(await readRole(spaceId, role))?.CIVITAS_AGENT_TOKEN) throw new AgentHttpError(409, 'Enable workspace agents for this group first.');
}

/** Server-only: the space's relay activity read with the workspace analyst credential. The token never leaves this module. */
export async function workspaceActivity(spaceId: string) {
  const env = await readRole(spaceId, 'analyst');
  if (!env?.CIVITAS_AGENT_TOKEN) return null;
  return createCivitasClient({ baseUrl: baseUrl(), token: env.CIVITAS_AGENT_TOKEN }).activity(spaceId);
}

// ---------- starting runs ----------
export const DEFAULT_GOAL = 'Analyze the Maintenance API change from v1 to v2. Identify breaking changes for consumers, cite evidence, and flag anything the sources leave unresolved. Propose one context packet for review.';
export async function spaceRuns(spaceId: string, limit = 40) {
  const threads = await lg().threads.search({ metadata: { spaceId }, limit, sortBy: 'created_at', sortOrder: 'desc' });
  return threads.filter(t => t.metadata?.kind === 'analyst' || t.metadata?.kind === 'adapter');
}
export async function startAnalyst(spaceId: string, createdBy: string, sourceId: unknown, goalInput: unknown) {
  const source = agentsConfig().sources.find(s => s.id === sourceId);
  if (!source) throw new AgentHttpError(400, 'Choose a connected source.');
  const goal = typeof goalInput === 'string' ? goalInput.trim() : '';
  if (!goal || goal.length > 4000) throw new AgentHttpError(400, 'Describe the change to analyze (up to 4000 characters).');
  await requireRoleEnabled(spaceId, 'analyst');
  const client = lg();
  const runId = newRunId('an');
  const thread = await client.threads.create({ metadata: { spaceId, kind: 'analyst', sourceId: source.id, runId, createdBy } });
  await client.runs.create(thread.thread_id, 'analyst', {
    input: { messages: [{ role: 'user', content: goal }] },
    config: { configurable: { spaceId, sourceId: source.id, runId } }, ...STREAM_OPTIONS,
  });
  return { threadId: thread.thread_id, runId };
}
export async function startAdapter(spaceId: string, createdBy: string, role: unknown) {
  const consumer = agentsConfig().consumers.find(c => c.role === role);
  if (!consumer) throw new AgentHttpError(400, 'Choose a connected consumer.');
  await requireRoleEnabled(spaceId, consumer.role);
  // Adapters only make sense once reviewed context exists: require a published analyst run.
  const runs = (await spaceRuns(spaceId, 100)).map(t => summarize(t));
  if (!runs.some(r => r.kind === 'analyst' && r.status === 'published')) throw new AgentHttpError(409, 'Publish an approved analysis before adapting consumers.');
  if (runs.some(r => r.kind === 'adapter' && r.role === consumer.role && (r.status === 'running' || r.status === 'waiting'))) throw new AgentHttpError(409, `An adapter run for ${shortLabel(consumer.label)} is already in progress.`);
  const client = lg();
  const runId = newRunId(`ad_${consumer.role}`);
  const thread = await client.threads.create({ metadata: { spaceId, kind: 'adapter', role: consumer.role, runId, createdBy } });
  await client.runs.create(thread.thread_id, 'adapter', {
    input: { messages: [{ role: 'user', content: 'Adapt this consumer to the latest update on its topic.' }] },
    config: { configurable: { spaceId, role: consumer.role, runId } }, ...STREAM_OPTIONS,
  });
  return { threadId: thread.thread_id, runId };
}

// ---------- LangGraph thread summaries (plain data, rendered as text in the browser) ----------
type Msg = { type?: string; id?: string; name?: string; content?: unknown; tool_calls?: { id?: string; name?: string; args?: Record<string, unknown> }[]; tool_call_id?: string; status?: string };
export type TimelineItem = { id: string; kind: 'tool' | 'task' | 'say'; name?: string; detail: string; subagent?: string; status: 'running' | 'done' | 'error'; result?: string };
/** Selected, non-secret fields of the interrupt's `civitas` block (checks, routing). */
export type ApprovalMeta = { checks?: string; typecheck?: string; role?: string; deliveryId?: string; eventId?: string; topic?: string; sourceUri?: string; revision?: string; idempotencyKey?: string; patchPath?: string; notesPath?: string; copyDir?: string };
export type Approval = { interruptId?: string; shape: 'batched' | 'per_call'; actions: { name: string; args: Record<string, unknown>; description?: string }[]; allowed: string[]; civitas?: ApprovalMeta };
export type RunStatus = 'running' | 'waiting' | 'published' | 'applied' | 'rejected' | 'failed' | 'completed';
export type RunSummary = {
  threadId: string; kind: 'analyst' | 'adapter'; role?: string; sourceId?: string; runId?: string; goal?: string;
  createdAt: string; updatedAt: string; status: RunStatus; threadStatus: string; result?: string; decision?: string;
  /** Account that approved/rejected, and when (from thread metadata). */
  decidedBy?: string; decidedAt?: string;
  /** Display title, e.g. "Analysis · Maintenance API" or "Adapt · Triage UI". */
  title: string;
  /** What the run is asking the owner, when waiting ("Publish context: …" / "Apply patch to Triage UI"). */
  ask?: string;
  /** Stopped by the owner (status is then 'failed'). */
  stopped?: boolean;
  /** Analyst: the published event. */
  eventId?: string;
  /** Adapter: relay deliveries this run retrieved or acted on. */
  deliveryIds?: string[];
};
/** One run waiting for the signed-in owner's decision (GET /api/inbox). */
export type InboxItem = {
  threadId: string; spaceId: string; spaceName: string; kind: 'analyst' | 'adapter'; role?: string;
  title: string; ask: string; waitingSince: string; createdAt: string;
};
/** Context feed propagation (GET /api/context). */
export type Stage = 'pending' | 'delivered' | 'retrieved' | 'adapting' | 'patch_ready' | 'applied' | 'acknowledged' | 'dismissed' | 'rejected' | 'failed';
export type Receiver = {
  key: string; label: string; role?: string; agentId?: string; stage: Stage;
  deliveredAt?: string; retrievedAt?: string | null; acknowledgedAt?: string | null;
  run?: { threadId: string; status: RunSummary['status']; stopped?: boolean };
  /** True when the delivery→receiver match was inferred (the relay snapshot does not name the receiving agent). */
  inferred?: boolean;
};
export type RunDetail = RunSummary & { todos: { content: string; status: string }[]; files: Record<string, string>; timeline: TimelineItem[]; approval: Approval | null; error?: string };

const cut = (text: string, max: number) => text.length > max ? text.slice(0, max) + `… [${text.length - max} more characters]` : text;
export function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(p => typeof p === 'string' ? p : p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : '').join('');
  return content == null ? '' : JSON.stringify(content);
}
const compact = (args: unknown) => { try { return cut(JSON.stringify(args ?? {}), 300); } catch { return ''; } };
export const gatedTool = (kind: string) => kind === 'analyst' ? 'publish_context' : 'submit_patch';
export const shortLabel = (label: string) => label.replace(/\s*\(.*\)\s*$/, '').trim() || label;
export function runTitle(kind: string, role?: string, sourceId?: string) {
  const config = agentsConfig();
  if (kind === 'adapter') return `Adapt · ${shortLabel(config.consumers.find(c => c.role === role)?.label || role || 'consumer')}`;
  return `Analysis · ${shortLabel(config.sources.find(s => s.id === sourceId)?.label || sourceId || 'source')}`;
}

export function timelineOf(messages: Msg[]): TimelineItem[] {
  const items: TimelineItem[] = []; const byCall = new Map<string, TimelineItem>();
  for (const m of messages) {
    if (m.type === 'ai') {
      const said = textOf(m.content).trim();
      if (said) items.push({ id: `${m.id}:say`, kind: 'say', detail: cut(said, 1500), status: 'done' });
      for (const call of m.tool_calls || []) {
        const task = call.name === 'task';
        const item: TimelineItem = { id: call.id || `${m.id}:${items.length}`, kind: task ? 'task' : 'tool', name: call.name, status: 'running',
          subagent: task ? String(call.args?.subagent_type ?? 'subagent') : undefined,
          detail: task ? cut(String(call.args?.description ?? ''), 600)
            : call.name === 'write_todos' && Array.isArray(call.args?.todos) ? `${call.args.todos.length} items`
            : compact(call.args) };
        items.push(item); if (call.id) byCall.set(call.id, item);
      }
    } else if (m.type === 'tool' && m.tool_call_id) {
      const item = byCall.get(m.tool_call_id);
      if (item) { item.status = m.status === 'error' ? 'error' : 'done'; item.result = cut(textOf(m.content), 1200); }
    }
  }
  return items;
}
const str = (v: unknown) => typeof v === 'string' && v.length <= 500 ? v : undefined;
function approvalMeta(raw: unknown): ApprovalMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  const relay = (c.relayArguments && typeof c.relayArguments === 'object' ? c.relayArguments : {}) as Record<string, unknown>;
  const source = (relay.source && typeof relay.source === 'object' ? relay.source : {}) as Record<string, unknown>;
  return { checks: str(c.checks), typecheck: str(c.typecheck), role: str(c.role), deliveryId: str(c.deliveryId), eventId: str(c.eventId),
    topic: str(c.eventTopic) ?? str(relay.topic), sourceUri: str(source.uri), revision: str(source.revision), idempotencyKey: str(relay.idempotency_key),
    patchPath: str(c.patchPath), notesPath: str(c.notesPath), copyDir: str(c.copyDir) };
}
function approvalOf(thread: Pick<Thread, 'interrupts'> | undefined, values: Record<string, unknown>): Approval | null {
  const list = [...Object.values(thread?.interrupts || {}).flat(), ...(Array.isArray(values.__interrupt__) ? values.__interrupt__ : [])] as { id?: string; value?: unknown }[];
  for (const entry of list) {
    const v = entry?.value as Record<string, unknown> | undefined;
    if (!v || typeof v !== 'object') continue;
    if (Array.isArray(v.actionRequests)) {
      const configs = Array.isArray(v.reviewConfigs) ? v.reviewConfigs as { allowedDecisions?: string[] }[] : [];
      return { interruptId: entry.id, shape: 'batched', allowed: configs[0]?.allowedDecisions || ['approve', 'reject'], civitas: approvalMeta(v.civitas),
        actions: (v.actionRequests as Record<string, unknown>[]).map(a => ({ name: String(a.name ?? a.action ?? 'action'), args: (a.args && typeof a.args === 'object' ? a.args : {}) as Record<string, unknown>, description: typeof a.description === 'string' ? a.description : undefined })) };
    }
    if (v.type === 'tool_approval' || (typeof v.name === 'string' && v.args && typeof v.args === 'object')) {
      return { interruptId: entry.id, shape: 'per_call', allowed: ['approve', 'reject'], actions: [{ name: String(v.name), args: v.args as Record<string, unknown>, description: typeof v.description === 'string' ? v.description : undefined }] };
    }
  }
  return null;
}
function filesOf(raw: unknown) {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [file, data] of Object.entries(raw as Record<string, unknown>).slice(0, 40)) {
    const content = data && typeof data === 'object' ? (data as { content?: unknown }).content : data;
    out[file] = cut(Array.isArray(content) ? content.map(String).join('\n') : typeof content === 'string' ? content : '', 100_000);
  }
  return out;
}
const parseJson = (text: string) => { try { return JSON.parse(text) as Record<string, unknown>; } catch { return null; } };
export function summarize(thread: Thread, valuesOverride?: Record<string, unknown>, live = false): RunDetail {
  const meta = (thread.metadata || {}) as Record<string, unknown>;
  const values = (valuesOverride ?? thread.values ?? {}) as Record<string, unknown>;
  const messages = (Array.isArray(values.messages) ? values.messages : []) as Msg[];
  const kind = meta.kind === 'adapter' ? 'adapter' : 'analyst';
  const role = typeof meta.role === 'string' ? meta.role : undefined;
  const sourceId = typeof meta.sourceId === 'string' ? meta.sourceId : undefined;
  const gated = gatedTool(kind);
  const approval = live ? null : thread.status === 'interrupted' ? approvalOf(thread, values) : null;
  const toolResult = [...messages].reverse().find(m => m.type === 'tool' && m.name === gated);
  const resultText = toolResult ? textOf(toolResult.content) : '';
  const parsed = resultText ? parseJson(resultText) : null;
  const stopped = meta.stopped === true && !toolResult;
  let status: RunStatus;
  if (live || thread.status === 'busy') status = 'running';
  else if (thread.status === 'interrupted') status = 'waiting';
  else if (thread.status === 'error' || stopped) status = 'failed';
  else if (toolResult?.status === 'error') status = meta.decision === 'rejected' || parsed?.outcome === 'rejected' ? 'rejected' : 'failed';
  else if (toolResult) status = kind === 'analyst' ? 'published' : parsed ? (parsed.applied === true ? 'applied' : 'completed') : /"?applied"?\s*:\s*true/i.test(resultText) ? 'applied' : 'completed';
  else status = meta.decision === 'rejected' ? 'rejected' : 'completed';
  const firstHuman = messages.find(m => m.type === 'human');
  const event = parsed?.event && typeof parsed.event === 'object' ? parsed.event as Record<string, unknown> : undefined;
  let deliveryIds: string[] | undefined;
  if (kind === 'adapter') {
    const found = new Set<string>();
    for (const m of messages) {
      const text = m.type === 'ai' ? JSON.stringify(m.tool_calls ?? []) : m.type === 'tool' ? textOf(m.content) : '';
      for (const id of text.match(/dlv_[A-Za-z0-9_-]{4,120}/g) || []) found.add(id);
    }
    deliveryIds = [...found].slice(0, 20);
  }
  const action = approval?.actions[0];
  const consumerLabel = shortLabel(agentsConfig().consumers.find(c => c.role === role)?.label || role || 'consumer');
  const ask = approval ? kind === 'analyst' ? `Publish context: ${cut(String(action?.args.title ?? 'context packet'), 160)}` : `Apply patch to ${consumerLabel}` : undefined;
  return {
    threadId: thread.thread_id, kind, role, sourceId,
    runId: typeof meta.runId === 'string' ? meta.runId : undefined, goal: firstHuman ? cut(textOf(firstHuman.content), 600) : undefined,
    createdAt: thread.created_at, updatedAt: thread.updated_at, status, threadStatus: thread.status,
    result: resultText ? cut(resultText, 2000) : undefined, decision: typeof meta.decision === 'string' ? meta.decision : undefined,
    decidedBy: typeof meta.decidedBy === 'string' ? meta.decidedBy : undefined, decidedAt: typeof meta.decidedAt === 'string' ? meta.decidedAt : undefined,
    title: runTitle(kind, role, sourceId), ask, stopped: stopped || undefined,
    eventId: typeof event?.eventId === 'string' ? event.eventId : undefined, deliveryIds,
    todos: (Array.isArray(values.todos) ? values.todos : []).filter((t: unknown) => t && typeof t === 'object').map((t: { content?: unknown; status?: unknown }) => ({ content: cut(String(t.content ?? ''), 500), status: String(t.status ?? 'pending') })),
    files: filesOf(values.files), timeline: timelineOf(messages), approval,
    error: thread.status === 'error' && thread.error ? cut(typeof thread.error === 'string' ? thread.error : JSON.stringify(thread.error), 600) : undefined,
  };
}
export function brief(detail: RunDetail): RunSummary {
  const { todos: _t, files: _f, timeline: _l, approval: _a, error: _e, ...rest } = detail;
  return rest;
}

/** First-seen time of each message (from checkpoint history), for step timings. Keys: tool call ids and `<msgId>:say`. */
export async function runTimings(threadId: string) {
  const out: Record<string, { at?: string; end?: string }> = {};
  const history = await lg().threads.getHistory(threadId, { limit: 300 });
  const seen = new Set<string>();
  for (const state of [...history].reverse()) {
    const at = state.created_at; if (!at) continue;
    const messages = (state.values as Record<string, unknown> | undefined)?.messages as Msg[] | undefined;
    if (!Array.isArray(messages)) continue;
    for (const m of messages) {
      const key = m.id || (m.type === 'tool' ? `tool:${m.tool_call_id}` : '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (m.type === 'ai') {
        if (textOf(m.content).trim()) out[`${m.id}:say`] = { at };
        for (const call of m.tool_calls || []) if (call.id) out[call.id] = { ...out[call.id], at };
      } else if (m.type === 'tool' && m.tool_call_id) out[m.tool_call_id] = { ...out[m.tool_call_id], end: at };
    }
  }
  return out;
}

/**
 * Subagent activity seen while this web server streamed a run (namespaced `tools:<id>` updates),
 * keyed by thread then namespace. In-process memory only: lost on web restart, and runs nobody
 * watched live have no nested steps.
 */
export type SubagentTrace = { subagent?: string; timeline: TimelineItem[] };
const cacheState = globalThis as typeof globalThis & { civitasSubagents?: Map<string, Record<string, SubagentTrace>> };
export const subagentCache: Map<string, Record<string, SubagentTrace>> = cacheState.civitasSubagents ??= new Map();
/** Which subagent produced a namespace's messages (createAgent names its AI messages after the subagent). */
export function subagentOf(messages: Msg[]) {
  return messages.find(m => m.type === 'ai' && typeof m.name === 'string' && m.name)?.name;
}

export const STREAM_OPTIONS = { streamMode: ['values', 'updates'] as ('values' | 'updates')[], streamSubgraphs: true, streamResumable: true, onDisconnect: 'continue' as const };
