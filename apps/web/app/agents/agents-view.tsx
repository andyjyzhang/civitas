'use client';

// Agents: the detailed view of agent runs — runs list + services (left), run detail (right).
// Activity is the everyday view; this page is for following a run step by step.
// Everything shown here that came from a model or the relay is rendered as plain text.
import { useCallback, useEffect, useState } from 'react';
import { Bot, FlaskConical, GitPullRequestArrow, Plus, Sparkles } from 'lucide-react';
import { useShell } from '../components/app-shell';
import { Button, Card, EmptyState, Page, PageHeader, StatusPill } from '../components/ui';
import { DetailRows, DetailsMenu } from '../components/overlays';
import { agentActions, call, relTime, runStatus, shortLabel, useAgentsOverview, useNow } from './client';
import { NewAnalysisDialog } from './review';
import RunView from './run-view';
import '../styles/agents.css';

export default function AgentsView() {
  const { spaceId, groups } = useShell();
  const now = useNow();
  const { overview, error: loadError, load } = useAgentsOverview(spaceId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [existsPrompt, setExistsPrompt] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [storage, setStorage] = useState('');
  const owner = overview?.space.role === 'owner';

  useEffect(() => { const run = new URLSearchParams(window.location.search).get('run'); if (run) setSelected(run); }, []);
  useEffect(() => {
    if (!spaceId) return;
    const url = new URL(window.location.href); url.searchParams.set('space', spaceId);
    if (selected) url.searchParams.set('run', selected); else url.searchParams.delete('run');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [spaceId, selected]);
  // Relay storage (memory vs PostgreSQL) for the Details menu.
  useEffect(() => { if (spaceId) call<{ storage?: string }>(`/api/context?space=${encodeURIComponent(spaceId)}`).then(d => setStorage(d.storage ?? '')).catch(() => undefined); }, [spaceId]);

  const act = useCallback(async (work: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { setBusy(false); }
  }, []);
  const enable = (mode: 'create' | 'reuse' | 'recreate') => act(async () => {
    try { await call('/api/agents', { method: 'POST', body: JSON.stringify({ spaceId, mode }) }); setExistsPrompt(false); }
    catch (e) { if ((e as { data?: { exists?: boolean } }).data?.exists) { setExistsPrompt(true); return; } throw e; }
    await load();
  });
  const adapt = (role: string) => act(async () => { const r = await agentActions.startAdapter(spaceId, role); setSelected(r.threadId); await load(); });
  const sample = () => act(async () => { const r = await agentActions.sample(spaceId); setSelected(r.threadId); await load(); });

  if (!groups.length) return <Page><PageHeader title="Agents"/><EmptyState icon={<Bot/>} title="Create a group first" description="Agents work inside a group." action={<Button href="/demo" variant="secondary">Watch demo</Button>}/></Page>;

  const server = overview?.agentServer;
  const enabled = overview?.workspace.every(r => r.present && r.tokenValid !== false) ?? false;
  const shared = overview?.runs.some(r => r.kind === 'analyst' && r.status === 'published') ?? false;
  const canStart = owner && !!server?.up;

  return <Page wide>
    <PageHeader title="Agents" description="Follow each run step by step: plan, evidence, patches and approvals."
      actions={overview && <>
        {owner && <Button variant="secondary" icon={<Plus/>} disabled={!server?.up} onClick={() => setDialog(true)}>New analysis</Button>}
        <DetailsMenu label="Agent details">
          <DetailRows rows={[
            ...overview.workspace.map(r => [r.name, !r.present ? 'Not set up' : r.tokenValid === false ? 'Credential rejected' : r.role === 'analyst' ? 'Can read and share' : r.subscribed ? 'Listening for updates' : 'Not listening'] as [string, string]),
            ['Agent server', server?.up ? 'Online' : 'Offline'],
            ['Relay storage', storage === 'memory' ? 'In memory (cleared on restart)' : storage === 'postgres' ? 'PostgreSQL' : ''],
          ]}/>
          {owner && enabled && <><hr className="divider"/><Button variant="ghost" size="sm" disabled={busy} onClick={() => void enable('reuse')}>Repair agent access</Button></>}
        </DetailsMenu>
      </>}/>
    {(error || loadError) && <div className="alert" role="alert">{error || loadError}</div>}
    {server && !server.up && <div className="alert" role="status"><span>Agents are offline. Start them with <code>npm run agents</code>.</span></div>}
    {!overview ? <p className="subtle">Loading agents…</p> : <>
      {owner && !enabled && <Card padded={false}><div className="ag-setup">
        <Bot aria-hidden="true" className="ag-row-icon"/>
        <p>{existsPrompt ? 'Agents were set up before. Reuse them, or create new ones (the old ones lose access).' : 'Set up an analyst and one agent per service for this group.'}</p>
        {existsPrompt ? <><Button size="sm" disabled={busy} onClick={() => void enable('reuse')}>Reuse</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void enable('recreate')}>Create new</Button></>
          : <Button size="sm" disabled={busy} onClick={() => void enable('create')}>Set up agents</Button>}
      </div></Card>}

      <div className={`ag-split ${selected ? 'has-run' : ''}`}>
        <div className="ag-side">
          <Card title="Runs" padded={false}>
            {overview.runsError && <p className="ag-pad subtle">{overview.runsError}</p>}
            {!overview.runs.length ? <p className="ag-pad subtle">No runs yet.</p> : <div className="list" role="list">{overview.runs.map(r => {
              const s = runStatus(r, owner);
              return <button key={r.threadId} type="button" role="listitem" className="list-row ag-run-row" aria-current={selected === r.threadId ? 'true' : undefined} onClick={() => setSelected(r.threadId)}>
                {r.kind === 'analyst' ? <Sparkles aria-hidden="true" className="ag-row-icon"/> : <GitPullRequestArrow aria-hidden="true" className="ag-row-icon"/>}
                <span className="ag-run-text"><span className="ag-run-title">{r.title.replace(/^Analysis · /, 'Analyze ').replace(/^Adapt · /, 'Update ')}</span><span className="subtle">{relTime(r.createdAt, now)}</span></span>
                <StatusPill status={s.status} label={s.label}/>
              </button>;
            })}</div>}
          </Card>
          <Card title="Services" description={shared ? undefined : 'Available after an update is shared.'} padded={false}>
            <div className="list">{overview.consumers.map(c => {
              const last = overview.runs.find(r => r.kind === 'adapter' && r.role === c.role);
              const role = overview.workspace.find(r => r.role === c.role);
              const inFlight = last?.status === 'running' || last?.status === 'waiting';
              return <div className="list-row" key={c.role}>
                <span className="ag-run-text"><span className="ag-run-title">{shortLabel(c.label)}</span>
                  {last ? <button type="button" className="text-button" onClick={() => setSelected(last.threadId)}>{runStatus(last, owner).label} · {relTime(last.createdAt, now)}</button> : <span className="subtle">No patches yet</span>}</span>
                {owner && <Button size="sm" variant="secondary" disabled={busy || !shared || !canStart || !role?.present || inFlight} onClick={() => void adapt(c.role)}>Adapt</Button>}
              </div>;
            })}</div>
          </Card>
        </div>
        <section aria-label="Run detail">
          {selected ? <RunView key={selected} threadId={selected} onChange={load} onBack={() => setSelected('')}/>
            : overview.runs.length ? <EmptyState icon={<Bot/>} title="Select a run" description="See its plan, steps, files and approvals."/>
            : <EmptyState icon={<FlaskConical/>} title="No runs yet" description={owner ? 'Try the sample: the analyst reads a Maintenance API change and proposes one update for your approval.' : 'The group owner starts analyses. Runs appear here as they happen.'}
                action={<><Button href={`/demo?space=${encodeURIComponent(spaceId)}`} variant="secondary">Watch demo</Button>{owner && <Button variant="primary" icon={<Sparkles/>} disabled={busy || !canStart} onClick={() => void sample()}>{busy ? 'Starting…' : 'Run sample analysis'}</Button>}</>}/>}
        </section>
      </div>
    </>}
    {dialog && overview && <NewAnalysisDialog spaceId={spaceId} sources={overview.sources} onClose={() => setDialog(false)} onStarted={id => { setDialog(false); setSelected(id); void load(); }}/>}
  </Page>;
}
