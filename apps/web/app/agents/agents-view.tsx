'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountOverview } from '@civitas/contracts';
import type { RoleStatus, RunDetail, RunStatus, RunSummary, TimelineItem } from '../../lib/agents';
import { useShell } from '../components/app-shell';
import { PageHeader } from '../components/ui';

// Everything shown here is model output or remote context: it is rendered as plain text
// (React escapes it). Never switch any of it to HTML injection.

type Space = AccountOverview['spaces'][number];
type Overview = {
  space: Space; accountId: string;
  sources: { id: string; label: string; topic: string }[];
  consumers: { role: string; label: string; topic: string }[];
  workspace: RoleStatus[]; agentServer: { url: string; up: boolean; message: string };
  runs: RunSummary[]; runsError: string;
};
const STATUS_LABEL: Record<RunStatus, string> = { running: 'running', waiting: 'waiting for approval', published: 'published', applied: 'applied', rejected: 'rejected', failed: 'failed', completed: 'completed' };
const DEFAULT_GOAL = 'Analyze the Maintenance API change from v1 to v2. Identify breaking changes for consumers, cite evidence, and flag anything the sources leave unresolved. Propose one context packet for review.';
const clock = (value: string) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  if (response.status === 401) { window.location.assign('/'); throw new Error('Please sign in.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { data, status: response.status });
  return data as T;
}

export default function AgentsView() {
  const { spaceId, groups: spaces } = useShell();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [existsPrompt, setExistsPrompt] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const owner = overview?.space.role === 'owner';

  useEffect(() => { const run = new URLSearchParams(window.location.search).get('run'); if (run) setSelected(run); }, []);
  const load = useCallback(async () => {
    if (!spaceId) return;
    try { const data = await call<Overview>('/api/agents?space=' + encodeURIComponent(spaceId)); setOverview(data); setSourceId(p => p || data.sources[0]?.id || ''); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load agents.'); }
  }, [spaceId]);
  useEffect(() => {
    if (!spaceId) return;
    const url = new URL(window.location.href); url.searchParams.set('space', spaceId);
    if (selected) url.searchParams.set('run', selected); else url.searchParams.delete('run');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [spaceId, selected]);
  useEffect(() => { void load(); }, [load]);
  const anyActive = overview?.runs.some(r => r.status === 'running') ?? false;
  useEffect(() => { const t = setInterval(() => void load(), anyActive ? 3000 : 10000); return () => clearInterval(t); }, [load, anyActive]);

  async function act(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { setBusy(false); }
  }
  const enable = (mode: 'create' | 'reuse' | 'recreate') => act(async () => {
    try {
      const result = await call<{ created: string[]; reused: string[] }>('/api/agents', { method: 'POST', body: JSON.stringify({ spaceId, mode }) });
      setExistsPrompt(false);
      setNotice(`Workspace agents ready${result.created.length ? ` · created ${result.created.join(', ')}` : ''}${result.reused.length ? ` · reused ${result.reused.join(', ')}` : ''}. Credentials stay on this computer.`);
    } catch (e) { if ((e as { data?: { exists?: boolean } }).data?.exists) { setExistsPrompt(true); return; } throw e; }
    await load();
  });
  const start = (body: Record<string, unknown>) => act(async () => {
    const result = await call<{ threadId: string }>('/api/agents/runs', { method: 'POST', body: JSON.stringify({ spaceId, ...body }) });
    setSelected(result.threadId); await load();
  });

  const enabled = overview?.workspace.every(r => r.present) ?? false;
  const published = overview?.runs.some(r => r.kind === 'analyst' && r.status === 'published') ?? false;
  const server = overview?.agentServer;

  return <div className="shell agents-shell"><div className="agents-main">
    <div className="agents-page">
      <PageHeader title="Agents" description="Analyze a change, publish reviewed context, adapt each consumer — nothing ships without owner approval." actions={server && <span className={`agent-server ${server.up ? 'up' : 'down'}`}><span className="status-dot"/>{server.up ? 'Agent server online' : 'Agent server offline'}</span>}/>
      {error && <div className="alert" role="alert">{error}</div>}
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}>×</button></div>}
      {server && !server.up && <div className="alert" role="status">Agent server not running — start it with <code>npm run agents</code>. Expected at {server.url}.</div>}
      {!spaces.length && !error ? <p className="muted">Create a group first.</p> : !overview ? <p className="muted">Loading agents…</p> : <div className="agents-layout">
        <div className="agents-controls">
          <section className="card agents-card"><h2>1 · Workspace agents</h2>
            <p className="muted">One analyst (read + publish) and one adapter per consumer (read only, subscribed to its topic). Credentials are saved privately on this computer for the local agent server; the browser never sees them.</p>
            <ul className="role-list">{overview.workspace.map(r => <li key={r.role}><span className={`role-dot ${r.present && r.tokenValid !== false ? 'ok' : ''}`}/><div><strong>{r.name}</strong><small>{!r.present ? 'Not enabled' : r.tokenValid === false ? 'Saved credential rejected by relay' : `${r.role === 'analyst' ? 'read + publish' : r.subscribed ? `read · subscribed` : 'read · not subscribed'}`}{r.agentId ? ` · ${r.agentId}` : ''}</small></div></li>)}</ul>
            {owner ? existsPrompt ? <div className="agents-confirm"><p>Workspace agents already exist for this group.</p><div className="button-row"><button className="primary" disabled={busy} onClick={() => void enable('reuse')}>Reuse and repair</button><button className="secondary" disabled={busy} onClick={() => void enable('recreate')}>Re-create credentials</button><button className="text-button" onClick={() => setExistsPrompt(false)}>Cancel</button></div><small className="muted">Re-creating revokes the old agents’ access to this group.</small></div>
              : <button className={enabled ? 'secondary' : 'primary'} disabled={busy} onClick={() => void enable('create')}>{enabled ? 'Re-enable workspace agents' : 'Enable workspace agents'}</button>
              : <p className="muted">Only the group owner can enable agents.</p>}
          </section>
          <section className="card agents-card"><h2>2 · Analyze a change</h2>
            <form onSubmit={e => { e.preventDefault(); void start({ kind: 'analyst', sourceId, goal }); }}>
              <label>Connected source<select value={sourceId} onChange={e => setSourceId(e.target.value)}>{overview.sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
              <label>Goal<textarea value={goal} onChange={e => setGoal(e.target.value)} rows={4} maxLength={4000} required/></label>
              <button className="primary full" disabled={busy || !owner || !enabled || !server?.up || !sourceId}>Start analysis</button>
              {!owner ? <small className="muted">Only the owner can start runs.</small> : !enabled ? <small className="muted">Enable workspace agents first.</small> : null}
            </form>
          </section>
          <section className="card agents-card"><h2>3 · Consumers</h2>
            {!published && <p className="muted">Adapters unlock once an analyst run has published context.</p>}
            {overview.consumers.map(c => { const last = overview.runs.find(r => r.kind === 'adapter' && r.role === c.role); return <div className="consumer-row" key={c.role}>
              <div><strong>{c.label}</strong><small>{c.topic}{last ? <> · <button className="link-like" onClick={() => setSelected(last.threadId)}>last run <StatusPill status={last.status}/></button></> : ''}</small></div>
              <button className="secondary" disabled={busy || !owner || !published || !server?.up || !overview.workspace.find(r => r.role === c.role)?.present || last?.status === 'running' || last?.status === 'waiting'} onClick={() => void start({ kind: 'adapter', role: c.role })}>Adapt with agent</button></div>; })}
          </section>
          <section className="card agents-card"><h2>4 · Run history</h2>
            {overview.runsError && <p className="muted">{overview.runsError}</p>}
            {!overview.runs.length ? <p className="muted">No runs yet.</p> : <ul className="run-history">{overview.runs.map(r => <li key={r.threadId}><button className={selected === r.threadId ? 'selected' : ''} onClick={() => setSelected(r.threadId)}>
              <span>{r.kind === 'analyst' ? `Analyst · ${r.sourceId || ''}` : `Adapter · ${r.role}`}</span><StatusPill status={r.status}/><small>{clock(r.createdAt)} · {r.runId}</small></button></li>)}</ul>}
          </section>
        </div>
        <section className="agents-run" aria-label="Run">{selected ? <RunView key={selected} threadId={selected} onChange={load}/> : <div className="room-empty"><span aria-hidden="true">⌘</span><h2>No run selected.</h2><p>Start an analysis or open a past run to watch the plan, subagent delegations, evidence files and approvals live.</p></div>}</section>
      </div>}
    </div>
  </div></div>;
}

function StatusPill({ status }: { status: RunStatus }) { return <span className={`run-pill ${status}`}>{STATUS_LABEL[status]}</span>; }

function useRun(threadId: string, onSettled: () => void) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [canControl, setCanControl] = useState(false);
  const [subagents, setSubagents] = useState<Record<string, TimelineItem[]>>({});
  const [live, setLive] = useState(false);
  const [streamError, setStreamError] = useState('');
  const source = useRef<EventSource | null>(null);
  const settled = useRef(onSettled); settled.current = onSettled;
  const connect = useCallback(() => {
    source.current?.close();
    const es = new EventSource(`/api/agents/runs/${encodeURIComponent(threadId)}/stream`);
    source.current = es; setLive(true); setStreamError('');
    let last: RunDetail | null = null;
    es.addEventListener('snapshot', e => { last = JSON.parse((e as MessageEvent).data); setRun(last); });
    es.addEventListener('subagent', e => { const { ns, timeline } = JSON.parse((e as MessageEvent).data); setSubagents(p => ({ ...p, [ns]: timeline })); });
    es.addEventListener('failure', e => { setStreamError(JSON.parse((e as MessageEvent).data).error); });
    es.addEventListener('end', () => {
      es.close(); setLive(false); settled.current();
      if ((last as RunDetail | null)?.status === 'running') setTimeout(() => { if (source.current === es) connect(); }, 1200);
    });
    es.onerror = () => { if (es.readyState !== EventSource.CLOSED) { es.close(); setLive(false); } };
  }, [threadId]);
  useEffect(() => {
    call<{ run: RunDetail; canControl: boolean }>(`/api/agents/runs/${encodeURIComponent(threadId)}`).then(d => { setRun(r => r ?? d.run); setCanControl(d.canControl); }).catch(e => setStreamError(e.message));
    connect();
    return () => { source.current?.close(); source.current = null; };
  }, [threadId, connect]);
  return { run, canControl, subagents, live, streamError, reconnect: connect };
}

function RunView({ threadId, onChange }: { threadId: string; onChange: () => void }) {
  const { run, canControl, subagents, live, streamError, reconnect } = useRun(threadId, onChange);
  const [tab, setTab] = useState('');
  const files = run ? Object.keys(run.files) : [];
  const activeTab = files.includes(tab) ? tab : files[0] || '';
  if (!run) return <div className="room-empty"><p>{streamError || 'Opening run…'}</p></div>;
  const tasks = run.timeline.filter(i => i.kind === 'task');
  const namespaces = Object.keys(subagents);
  return <div className="run-view">
    <header className="run-header"><div><h2>{run.kind === 'analyst' ? 'Change analysis' : `Adapter · ${run.role}`}</h2><small>{run.runId} · started {clock(run.createdAt)}{run.decision ? ` · ${run.decision}` : ''}</small></div>
      <div className="run-header-status">{live && <span className="live-indicator"><span className="status-dot"/>live</span>}<StatusPill status={run.status}/></div></header>
    {streamError && <div className="alert" role="alert">{streamError}</div>}
    {run.error && <div className="alert" role="alert">Run failed: {run.error}</div>}
    {run.goal && <p className="run-goal"><span>Goal</span>{run.goal}</p>}
    {run.approval && <ApprovalCard run={run} canControl={canControl} onDecided={() => { reconnect(); onChange(); }}/>}
    {run.result && (run.status === 'published' || run.status === 'applied' || run.status === 'completed' || run.status === 'rejected' || run.status === 'failed') && <div className={`run-result ${run.status}`}><strong>{run.status === 'published' ? 'Published to Civitas' : run.status === 'applied' ? 'Patch applied · delivery acknowledged' : run.status === 'rejected' ? 'Rejected — nothing published or applied' : run.status === 'failed' ? 'Tool reported an error' : 'Result'}</strong><pre>{run.result}</pre></div>}
    <div className="run-grid">
      <section className="run-panel"><h3>Plan</h3>{run.todos.length ? <ol className="todo-list">{run.todos.map((t, i) => <li key={i} className={t.status}><span aria-hidden="true">{t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '›' : '○'}</span>{t.content}</li>)}</ol> : <p className="muted">No plan yet.</p>}</section>
      <section className="run-panel"><h3>Activity</h3>{run.timeline.length ? <ol className="timeline">{run.timeline.map(item => <TimelineRow key={item.id} item={item} sub={item.kind === 'task' ? subagents[namespaces[tasks.indexOf(item)]] : undefined}/>)}</ol> : <p className="muted">Waiting for the first step…</p>}
        {namespaces.length === 0 && tasks.length > 0 && <small className="muted">Subagent internals stream only while a run is live.</small>}</section>
    </div>
    <section className="run-panel files-panel"><h3>Files</h3>{files.length ? <>
      <div className="file-tabs" role="tablist">{files.map(f => <button key={f} role="tab" aria-selected={f === activeTab} className={f === activeTab ? 'selected' : ''} onClick={() => setTab(f)}>{f}</button>)}</div>
      {activeTab.endsWith('.diff') || activeTab.endsWith('.patch') ? <Diff text={run.files[activeTab]}/> : <pre className="file-body">{run.files[activeTab]}</pre>}
    </> : <p className="muted">No evidence or patch files yet.</p>}</section>
  </div>;
}

function TimelineRow({ item, sub }: { item: TimelineItem; sub?: TimelineItem[] }) {
  if (item.kind === 'say') return <li className="tl-say"><span className="tl-icon">“</span><p>{item.detail}</p></li>;
  return <li className={`tl-${item.kind} ${item.status}`}><span className="tl-icon">{item.kind === 'task' ? '⇢' : '▸'}</span><div>
    <div className="tl-head">{item.kind === 'task' ? <strong>Delegated to {item.subagent}</strong> : <code>{item.name}</code>}<span className={`tl-status ${item.status}`}>{item.status === 'running' ? 'running' : item.status === 'error' ? 'error' : 'done'}</span></div>
    {item.detail && <p className="tl-detail">{item.detail}</p>}
    {sub && sub.length > 0 && <ol className="timeline sub">{sub.map(s => <TimelineRow key={s.id} item={s}/>)}</ol>}
    {item.result && (item.kind === 'task' || item.status === 'error') && <details><summary>{item.kind === 'task' ? 'Subagent result' : 'Error'}</summary><pre>{item.result}</pre></details>}
  </div></li>;
}

function Diff({ text }: { text?: string }) {
  if (!text) return <p className="muted">No patch file.</p>;
  return <pre className="diff-view">{text.split('\n').map((line, i) => <span key={i} className={line.startsWith('+++') || line.startsWith('---') ? 'meta' : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : line.startsWith('@@') ? 'hunk' : ''}>{line}{'\n'}</span>)}</pre>;
}

function ApprovalCard({ run, canControl, onDecided }: { run: RunDetail; canControl: boolean; onDecided: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const approval = run.approval!;
  async function decide(decision: 'approve' | 'reject') {
    setBusy(true); setError('');
    try { await call(`/api/agents/runs/${encodeURIComponent(run.threadId)}`, { method: 'POST', body: JSON.stringify({ decision, message: reason }) }); onDecided(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Decision failed.'); } finally { setBusy(false); }
  }
  return <section className="approval-card" aria-label="Approval required">
    <div className="approval-head"><strong>Approval required</strong><small>The run is paused. Review the exact arguments below.</small></div>
    {approval.actions.map((action, i) => <div key={i} className="approval-action">
      <p className="approval-tool"><code>{action.name}</code>{action.description ? ` — ${action.description}` : ''}</p>
      {action.name === 'publish_context' ? <PublishArgs args={action.args}/> : action.name === 'submit_patch' ? <PatchArgs args={action.args} run={run}/> : <pre className="file-body">{JSON.stringify(action.args, null, 2)}</pre>}
    </div>)}
    {error && <p className="alert" role="alert">{error}</p>}
    {canControl ? <div className="approval-controls">
      <label>Reason (optional, sent to the agent on reject)<input value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} placeholder="What should change?"/></label>
      <div className="button-row"><button className="primary" disabled={busy} onClick={() => void decide('approve')}>{run.kind === 'analyst' ? 'Approve and publish' : 'Approve and apply'}</button><button className="secondary danger" disabled={busy} onClick={() => void decide('reject')}>Reject</button></div>
    </div> : <p className="muted">Waiting for the group owner to approve or reject.</p>}
  </section>;
}

function PublishArgs({ args }: { args: Record<string, unknown> }) {
  const { title, content, tags, change, ...rest } = args;
  return <dl className="approval-fields">
    <dt>Title</dt><dd>{String(title ?? '')}</dd>
    <dt>Tags</dt><dd>{Array.isArray(tags) && tags.length ? tags.map(t => <span className="topic" key={String(t)}>{String(t)}</span>) : '—'}</dd>
    {change !== undefined && <><dt>Change</dt><dd><pre>{JSON.stringify(change, null, 2)}</pre></dd></>}
    <dt>Content</dt><dd><pre className="file-body">{String(content ?? '')}</pre></dd>
    {Object.keys(rest).length > 0 && <><dt>Other</dt><dd><pre>{JSON.stringify(rest, null, 2)}</pre></dd></>}
  </dl>;
}

function PatchArgs({ args, run }: { args: Record<string, unknown>; run: RunDetail }) {
  const role = run.role || String(args.role ?? '');
  const diff = run.files[`/patches/${role}.diff`]; const notes = run.files[`/notes/${role}.md`];
  return <div className="approval-fields">
    {Object.keys(args).length > 0 && <pre>{JSON.stringify(args, null, 2)}</pre>}
    <h4>Patch · /patches/{role}.diff</h4><Diff text={diff}/>
    <h4>Notes · /notes/{role}.md</h4>{notes ? <pre className="file-body">{notes}</pre> : <p className="muted">No notes file.</p>}
  </div>;
}
