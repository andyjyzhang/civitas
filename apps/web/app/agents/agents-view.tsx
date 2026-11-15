'use client';

// Agents: workspace status row, runs list (left) and run detail (right).
// Everything shown here that came from a model or the relay is rendered as plain text.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AccountOverview } from '@civitas/contracts';
import { Bot, FlaskConical, GitPullRequestArrow, Plus, Sparkles, X } from 'lucide-react';
import type { RoleStatus, RunSummary } from '../../lib/agents';
import { useShell } from '../components/app-shell';
import { Badge, Button, Card, EmptyState, InfoTip, Page, PageHeader, StatusPill } from '../components/ui';
import { call, relTime, runStatus, useNow } from './client';
import RunView from './run-view';
import '../styles/agents.css';

type Space = AccountOverview['spaces'][number];
type Overview = {
  space: Space; accountId: string;
  sources: { id: string; label: string; topic: string }[];
  consumers: { role: string; label: string; topic: string }[];
  workspace: RoleStatus[]; agentServer: { url: string; up: boolean; message: string };
  runs: RunSummary[]; runsError: string;
};
const DEFAULT_GOAL = 'Analyze the Maintenance API change from v1 to v2. Identify breaking changes for consumers, cite evidence, and flag anything the sources leave unresolved. Propose one context packet for review.';
const shortLabel = (label: string) => label.replace(/\s*\(.*\)\s*$/, '').trim() || label;

export default function AgentsView() {
  const { spaceId, groups } = useShell();
  const now = useNow();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [existsPrompt, setExistsPrompt] = useState(false);
  const [dialog, setDialog] = useState(false);
  const owner = overview?.space.role === 'owner';

  useEffect(() => { const run = new URLSearchParams(window.location.search).get('run'); if (run) setSelected(run); }, []);
  const load = useCallback(async () => {
    if (!spaceId) return;
    try { setOverview(await call<Overview>('/api/agents?space=' + encodeURIComponent(spaceId))); setError(''); }
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
      setNotice(`Workspace agents ready${result.created.length ? ` · created ${result.created.join(', ')}` : ''}${result.reused.length ? ` · reused ${result.reused.join(', ')}` : ''}.`);
    } catch (e) { if ((e as { data?: { exists?: boolean } }).data?.exists) { setExistsPrompt(true); return; } throw e; }
    await load();
  });
  const start = (body: Record<string, unknown>) => act(async () => {
    const result = await call<{ threadId: string }>('/api/agents/runs', { method: 'POST', body: JSON.stringify({ spaceId, ...body }) });
    setDialog(false); setSelected(result.threadId); await load();
  });
  const sample = () => act(async () => {
    const result = await call<{ threadId: string; enabled: boolean }>('/api/agents/sample', { method: 'POST', body: JSON.stringify({ spaceId }) });
    setDialog(false); setSelected(result.threadId);
    if (result.enabled) setNotice('Workspace agents enabled. Sample analysis started.');
    await load();
  });

  if (!groups.length) return <Page><PageHeader title="Agents"/><EmptyState icon={<Bot/>} title="Create a group first" description="Workspace agents run inside a group."/></Page>;

  const server = overview?.agentServer;
  const enabled = overview?.workspace.every(r => r.present && r.tokenValid !== false) ?? false;
  const published = overview?.runs.some(r => r.kind === 'analyst' && r.status === 'published') ?? false;
  const canStart = owner && !!server?.up;

  return <Page wide className="ag-page">
    <PageHeader title="Agents" description="Analyze a change, publish reviewed context, adapt each consumer."
      actions={owner && overview && <Button variant="secondary" icon={<Plus/>} disabled={!server?.up} onClick={() => setDialog(true)}>New analysis</Button>}/>
    {error && <div className="alert" role="alert">{error}</div>}
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}>×</button></div>}
    {server && !server.up && <div className="alert" role="status"><span>Agent server not running — start it with <code>npm run agents</code> ({server.url}).</span></div>}
    {!overview ? <p className="subtle">Loading agents…</p> : <>
      <Card padded={false}>
        <div className="list-row ag-workspace">
          <Bot aria-hidden="true" className="ag-row-icon"/>
          <strong>Workspace agents</strong>
          <InfoTip text="One analyst (read + publish) and one adapter per consumer (read, subscribed to its topic). Credentials stay on this computer; the browser never sees them."/>
          <span className="ag-chips">{overview.workspace.map(r => <Badge key={r.role} tone={!r.present ? 'idle' : r.tokenValid === false ? 'failed' : 'done'} title={!r.present ? 'Not enabled' : r.tokenValid === false ? 'Saved credential rejected by the relay' : r.role === 'analyst' ? 'Read + publish' : r.subscribed ? 'Read · subscribed' : 'Read · not subscribed'}>{r.name.replace(/ (agent|adapter)$/, '')}</Badge>)}</span>
          <span className="ag-row-end">
            {server && <StatusPill status={server.up ? 'done' : 'failed'} label={server.up ? 'Server online' : 'Server offline'}/>}
            {owner && (existsPrompt
              ? <><Button size="sm" variant="secondary" disabled={busy} onClick={() => void enable('reuse')}>Reuse and repair</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void enable('recreate')}>Re-create</Button><InfoTip text="Re-creating revokes the old agents’ access to this group."/></>
              : <Button size="sm" variant="secondary" disabled={busy} onClick={() => void enable('create')}>{enabled ? 'Re-enable' : 'Enable'}</Button>)}
          </span>
        </div>
      </Card>

      <div className={`ag-split ${selected ? 'has-run' : ''}`}>
        <div className="ag-side">
          <Card title="Runs" padded={false}>
            {overview.runsError && <p className="ag-pad subtle">{overview.runsError}</p>}
            {!overview.runs.length ? <p className="ag-pad subtle">No runs yet.</p> : <div className="list" role="list">{overview.runs.map(r => {
              const s = runStatus(r, owner);
              return <button key={r.threadId} type="button" role="listitem" className="list-row ag-run-row" aria-current={selected === r.threadId ? 'true' : undefined} onClick={() => setSelected(r.threadId)}>
                {r.kind === 'analyst' ? <Sparkles aria-hidden="true" className="ag-row-icon"/> : <GitPullRequestArrow aria-hidden="true" className="ag-row-icon"/>}
                <span className="ag-run-text"><span className="ag-run-title">{r.title}</span><span className="subtle">{relTime(r.createdAt, now)}</span></span>
                <StatusPill status={s.status} label={s.label}/>
              </button>;
            })}</div>}
          </Card>
          <Card title="Consumers" padded={false} actions={!published && <InfoTip text="Adapters unlock once an analysis has been approved and published."/>}>
            <div className="list">{overview.consumers.map(c => {
              const last = overview.runs.find(r => r.kind === 'adapter' && r.role === c.role);
              const role = overview.workspace.find(r => r.role === c.role);
              const inFlight = last?.status === 'running' || last?.status === 'waiting';
              return <div className="list-row" key={c.role}>
                <span className="ag-run-text"><span className="ag-run-title">{shortLabel(c.label)}</span>
                  {last ? <button type="button" className="text-button" onClick={() => setSelected(last.threadId)}>Last run {runStatus(last, owner).label.toLowerCase()} · {relTime(last.createdAt, now)}</button> : <span className="subtle mono">{c.topic}</span>}</span>
                {owner && <Button size="sm" variant="secondary" disabled={busy || !published || !canStart || !role?.present || inFlight} title={!published ? 'Publish an analysis first' : undefined} onClick={() => void start({ kind: 'adapter', role: c.role })}>Adapt</Button>}
              </div>;
            })}</div>
          </Card>
        </div>
        <section className="ag-main" aria-label="Run detail">
          {selected ? <RunView key={selected} threadId={selected} onChange={load} onBack={() => setSelected('')}/>
            : overview.runs.length ? <EmptyState icon={<Bot/>} title="Select a run" description="Open a run to follow its plan, steps, files and approvals."/>
            : <EmptyState icon={<FlaskConical/>} title="No runs yet" description={owner ? 'Try the sample: the analyst reads the Maintenance API v1→v2 change and proposes one context packet for your approval.' : 'The group owner starts analyses. Runs appear here as they happen.'}
                action={owner && <Button variant="primary" icon={<Sparkles/>} disabled={busy || !canStart} onClick={() => void sample()}>{busy ? 'Starting…' : 'Run sample analysis'}</Button>}/>}
        </section>
      </div>
    </>}
    {dialog && overview && <NewAnalysisDialog sources={overview.sources} enabled={enabled} busy={busy} error={error} onClose={() => setDialog(false)}
      onStart={(sourceId, goal) => void start({ kind: 'analyst', sourceId, goal })} onSample={() => void sample()}/>}
  </Page>;
}

function NewAnalysisDialog({ sources, enabled, busy, error, onClose, onStart, onSample }: { sources: Overview['sources']; enabled: boolean; busy: boolean; error: string; onClose: () => void; onStart: (sourceId: string, goal: string) => void; onSample: () => void }) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [onClose]);
  const submit = (e: FormEvent) => { e.preventDefault(); onStart(sourceId, goal); };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-analysis-title">
      <div className="section-heading"><h2 id="new-analysis-title">New analysis</h2><Button variant="ghost" size="sm" iconOnly aria-label="Close" icon={<X/>} onClick={onClose}/></div>
      <p>The analyst reads a connected source and proposes one context packet for your approval.</p>
      <form onSubmit={submit}>
        <label>Connected source<select value={sourceId} onChange={e => setSourceId(e.target.value)}>{sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label>Goal<textarea value={goal} onChange={e => setGoal(e.target.value)} rows={4} maxLength={4000} required/></label>
        {!enabled && <p className="subtle">Enable workspace agents first, or run the sample (it enables them).</p>}
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="page-actions">
          <Button type="submit" variant="primary" disabled={busy || !enabled || !sourceId || !goal.trim()}>{busy ? 'Starting…' : 'Start analysis'}</Button>
          <Button variant="ghost" icon={<Sparkles/>} disabled={busy} onClick={onSample}>Run sample analysis</Button>
        </div>
      </form>
    </section>
  </div>;
}
