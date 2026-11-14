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

// ---------- LangGraph thread summaries (plain data, rendered as text in the browser) ----------
type Msg = { type?: string; id?: string; content?: unknown; tool_calls?: { id?: string; name?: string; args?: Record<string, unknown> }[]; tool_call_id?: string; name?: string; status?: string };
export type TimelineItem = { id: string; kind: 'tool' | 'task' | 'say'; name?: string; detail: string; subagent?: string; status: 'running' | 'done' | 'error'; result?: string };
export type Approval = { interruptId?: string; shape: 'batched' | 'per_call'; actions: { name: string; args: Record<string, unknown>; description?: string }[]; allowed: string[] };
export type RunStatus = 'running' | 'waiting' | 'published' | 'applied' | 'rejected' | 'failed' | 'completed';
export type RunSummary = {
  threadId: string; kind: 'analyst' | 'adapter'; role?: string; sourceId?: string; runId?: string; goal?: string;
  createdAt: string; updatedAt: string; status: RunStatus; threadStatus: string; result?: string; decision?: string;
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
            : call.name === 'write_todos' && Array.isArray(call.args?.todos) ? `Updated plan · ${call.args.todos.length} items`
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
function approvalOf(thread: Pick<Thread, 'interrupts'> | undefined, values: Record<string, unknown>): Approval | null {
  const list = [...Object.values(thread?.interrupts || {}).flat(), ...(Array.isArray(values.__interrupt__) ? values.__interrupt__ : [])] as { id?: string; value?: unknown }[];
  for (const entry of list) {
    const v = entry?.value as Record<string, unknown> | undefined;
    if (!v || typeof v !== 'object') continue;
    if (Array.isArray(v.actionRequests)) {
      const configs = Array.isArray(v.reviewConfigs) ? v.reviewConfigs as { allowedDecisions?: string[] }[] : [];
      return { interruptId: entry.id, shape: 'batched', allowed: configs[0]?.allowedDecisions || ['approve', 'reject'],
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
export function summarize(thread: Thread, valuesOverride?: Record<string, unknown>, live = false): RunDetail {
  const meta = (thread.metadata || {}) as Record<string, unknown>;
  const values = (valuesOverride ?? thread.values ?? {}) as Record<string, unknown>;
  const messages = (Array.isArray(values.messages) ? values.messages : []) as Msg[];
  const kind = meta.kind === 'adapter' ? 'adapter' : 'analyst';
  const gated = gatedTool(kind);
  const approval = live ? null : thread.status === 'interrupted' ? approvalOf(thread, values) : null;
  const toolResult = [...messages].reverse().find(m => m.type === 'tool' && m.name === gated);
  const resultText = toolResult ? textOf(toolResult.content) : '';
  let status: RunStatus;
  if (live || thread.status === 'busy') status = 'running';
  else if (thread.status === 'interrupted') status = 'waiting';
  else if (thread.status === 'error') status = 'failed';
  else if (toolResult?.status === 'error') status = meta.decision === 'rejected' ? 'rejected' : 'failed';
  else if (toolResult) status = kind === 'analyst' ? 'published' : /"?applied"?\s*:\s*true|\bapplied\b/i.test(resultText) && !/not applied/i.test(resultText) ? 'applied' : 'completed';
  else status = meta.decision === 'rejected' ? 'rejected' : 'completed';
  const firstHuman = messages.find(m => m.type === 'human');
  return {
    threadId: thread.thread_id, kind, role: typeof meta.role === 'string' ? meta.role : undefined, sourceId: typeof meta.sourceId === 'string' ? meta.sourceId : undefined,
    runId: typeof meta.runId === 'string' ? meta.runId : undefined, goal: firstHuman ? cut(textOf(firstHuman.content), 600) : undefined,
    createdAt: thread.created_at, updatedAt: thread.updated_at, status, threadStatus: thread.status,
    result: resultText ? cut(resultText, 2000) : undefined, decision: typeof meta.decision === 'string' ? meta.decision : undefined,
    todos: (Array.isArray(values.todos) ? values.todos : []).filter((t: unknown) => t && typeof t === 'object').map((t: { content?: unknown; status?: unknown }) => ({ content: cut(String(t.content ?? ''), 500), status: String(t.status ?? 'pending') })),
    files: filesOf(values.files), timeline: timelineOf(messages), approval,
    error: thread.status === 'error' && thread.error ? cut(typeof thread.error === 'string' ? thread.error : JSON.stringify(thread.error), 600) : undefined,
  };
}
export function brief(detail: RunDetail): RunSummary {
  const { todos: _t, files: _f, timeline: _l, approval: _a, error: _e, ...rest } = detail;
  return rest;
}
export const STREAM_OPTIONS = { streamMode: ['values', 'updates'] as ('values' | 'updates')[], streamSubgraphs: true, streamResumable: true, onDisconnect: 'continue' as const };
