'use client';

// Run detail: header (IDs behind ⋯ Details), review card, result, plan, collapsed steps
// ("Read 3 files · 2 specialists · 41s — Show steps") and files.
// All of it is model output or remote context: rendered as plain text only.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronRight, CircleDashed, CircleDot, FileText, GitBranch, ListChecks, MessageSquare, Square, Wrench, X, XCircle } from 'lucide-react';
import type { RunDetail, SubagentTrace, TimelineItem } from '../../lib/agents';
import { AgentBadge, Button, CopyId, StatusPill } from '../components/ui';
import { DetailRows, DetailsMenu } from '../components/overlays';
import { call, duration, fullTime, relTime, runStatus, useNow } from './client';
import { DiffView } from './diff';
import { AnalystReview, PatchReview } from './review';

type Timings = Record<string, { at?: string; end?: string }>;
type Impact = { subscribers: number; topic: string } | null;
type DetailResponse = { run: RunDetail; canControl: boolean; timings: Timings; subagents: Record<string, SubagentTrace>; impact: Impact };

function useRun(threadId: string, onSettled: () => void) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [extra, setExtra] = useState<Omit<DetailResponse, 'run'>>({ canControl: false, timings: {}, subagents: {}, impact: null });
  const [live, setLive] = useState(false);
  const [streamError, setStreamError] = useState('');
  const source = useRef<EventSource | null>(null);
  const settled = useRef(onSettled); settled.current = onSettled;
  const fetchDetail = useCallback(async () => {
    try { const d = await call<DetailResponse>(`/api/agents/runs/${encodeURIComponent(threadId)}`); setRun(r => r && r.status === 'running' && d.run.status === 'running' ? r : d.run); setExtra(p => ({ ...d, subagents: { ...p.subagents, ...d.subagents } })); }
    catch (e) { setStreamError(e instanceof Error ? e.message : 'Could not load this run.'); }
  }, [threadId]);
  const connect = useCallback(() => {
    source.current?.close();
    const es = new EventSource(`/api/agents/runs/${encodeURIComponent(threadId)}/stream`);
    source.current = es; setLive(true); setStreamError('');
    let last: RunDetail | null = null;
    es.addEventListener('snapshot', e => { last = JSON.parse((e as MessageEvent).data); setRun(last); });
    es.addEventListener('subagent', e => { const { ns, subagent, timeline } = JSON.parse((e as MessageEvent).data); setExtra(p => ({ ...p, subagents: { ...p.subagents, [ns]: { subagent, timeline } } })); });
    es.addEventListener('failure', e => { setStreamError(JSON.parse((e as MessageEvent).data).error); });
    es.addEventListener('end', () => {
      es.close(); setLive(false); settled.current(); void fetchDetail();
      if ((last as RunDetail | null)?.status === 'running') setTimeout(() => { if (source.current === es) connect(); }, 1200);
    });
    es.onerror = () => { if (es.readyState !== EventSource.CLOSED) { es.close(); setLive(false); } };
  }, [threadId, fetchDetail]);
  useEffect(() => {
    void fetchDetail(); connect();
    return () => { source.current?.close(); source.current = null; };
  }, [fetchDetail, connect]);
  return { run, ...extra, live, streamError, reconnect: connect, refetch: fetchDetail };
}

export default function RunView({ threadId, onChange, onBack }: { threadId: string; onChange: () => void; onBack?: () => void }) {
  const { run, canControl, subagents, impact, live, streamError, reconnect, refetch } = useRun(threadId, onChange);
  const now = useNow();
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  if (!run) return <div className="card ag-detail-empty"><p className="subtle">{streamError || 'Opening run…'}</p></div>;
  const { status, label } = runStatus(run, canControl);
  async function stop() {
    setStopping(true); setError('');
    try { await call(`/api/agents/runs/${encodeURIComponent(threadId)}/cancel`, { method: 'POST', body: '{}' }); onChange(); await refetch(); reconnect(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not stop the run.'); } finally { setStopping(false); }
  }
  const done = run.todos.filter(t => t.status === 'completed').length;
  const service = run.title.replace(/^Adapt · /, '');
  const title = run.kind === 'analyst' ? run.title.replace(/^Analysis · /, 'Analyze ') : `Update ${service}`;
  const action = run.approval?.actions[0];
  const meta = run.approval?.civitas ?? {};
  const decided = () => { reconnect(); onChange(); };
  let eventId = run.eventId;
  if (!eventId) try { eventId = (JSON.parse(run.result || '{}').event ?? {}).eventId; } catch { /* plain text */ }
  return <article className="card ag-detail" aria-label={title}>
    <header className="ag-detail-head">
      <div className="ag-detail-title">
        <div>{onBack && <Button variant="ghost" size="sm" className="ag-back" onClick={onBack} icon={<ChevronRight style={{ transform: 'rotate(180deg)' }}/>}>Runs</Button>}
          <h2>{title}</h2><StatusPill status={status} label={label}/></div>
        <p className="ag-meta"><span title={fullTime(run.createdAt)}>Started {relTime(run.createdAt, now)}</span>{live && <span className="ag-live"><span className="live-dot" aria-hidden="true"/>Live</span>}</p>
      </div>
      <div className="page-actions">
        {canControl && run.status === 'running' && <Button variant="danger" size="sm" icon={<Square/>} disabled={stopping} onClick={() => void stop()}>{stopping ? 'Stopping…' : 'Stop'}</Button>}
        <DetailsMenu label="Run details">
          <DetailRows rows={[
            ['Run', run.runId ? <CopyId id={run.runId}/> : ''], ['Thread', <CopyId key="t" id={run.threadId}/>],
            ['Event', eventId ? <CopyId id={String(eventId)}/> : ''], ['Delivery', meta.deliveryId ? <CopyId id={meta.deliveryId}/> : ''],
            ['Topic', meta.topic ? <span className="mono">{meta.topic}</span> : ''], ['Source', meta.sourceUri ? <span className="mono">{meta.sourceUri}@{meta.revision}</span> : ''],
            ['Checks', [meta.checks && `checks ${meta.checks}`, meta.typecheck && `TypeScript ${meta.typecheck}`].filter(Boolean).join(' · ')],
            ['Goal', run.goal ?? ''], ['Started', fullTime(run.createdAt)],
          ]}/>
        </DetailsMenu>
      </div>
    </header>
    {(error || streamError) && <div className="alert" role="alert">{error || streamError}</div>}
    {run.error && <div className="alert" role="alert">Run failed: {run.error}</div>}
    {run.approval && (run.kind === 'analyst'
      ? <AnalystReview threadId={run.threadId} args={action?.args ?? {}} canControl={canControl} services={impact?.subscribers ?? 0} onDecided={decided}/>
      : <PatchReview threadId={run.threadId} service={service} summary={typeof action?.args.summary === 'string' ? action.args.summary : undefined}
          diff={run.files[meta.patchPath || `/patches/${run.role}.diff`]} notes={run.files[meta.notesPath || `/notes/${run.role}.md`]} canControl={canControl} onDecided={decided}/>)}
    {!run.approval && run.result && <ResultRow run={run}/>}

    {run.todos.length > 0 && <section className="ag-section" aria-label="Plan">
      <div className="ag-section-head"><h3>Plan</h3><span className="subtle">{done}/{run.todos.length}</span><span className="ag-progress" aria-hidden="true"><span style={{ width: `${(done / run.todos.length) * 100}%` }}/></span></div>
      <ul className="ag-plan">{run.todos.map((t, i) => <li key={i} className={t.status}>{t.status === 'completed' ? <Check aria-label="Done"/> : t.status === 'in_progress' ? <CircleDot aria-label="In progress"/> : <CircleDashed aria-label="Pending"/>}<span>{t.content}</span></li>)}</ul>
    </section>}

    <section className="ag-section" aria-label="Steps">
      {run.timeline.length ? <details className="ag-steps">
        <summary><StepsSummary run={run}/><span className="more">Show steps</span><ChevronRight aria-hidden="true"/></summary>
        <ol className="ag-timeline">{run.timeline.map(item => <Step key={item.id} item={run.status === 'waiting' && item.status === 'running' ? { ...item, status: 'waiting' as TimelineItem['status'] } : item} sub={item.kind === 'task' ? subFor(item, run.timeline, subagents) : undefined}/>)}</ol>
      </details> : <p className="subtle">{run.status === 'running' ? 'Starting…' : 'No steps were recorded.'}</p>}
    </section>

    <Files run={run}/>
  </article>;
}

function StepsSummary({ run }: { run: RunDetail }) {
  const read = new Set(run.timeline.filter(i => i.name === 'read_file').map(i => i.detail));
  const specialists = new Set(run.timeline.filter(i => i.kind === 'task').map(i => i.subagent)).size;
  const steps = run.timeline.filter(i => i.kind !== 'say').length;
  const took = run.status === 'running' ? '' : duration(run.createdAt, run.updatedAt);
  const parts = [read.size ? `Read ${read.size} file${read.size === 1 ? '' : 's'}` : `${steps} step${steps === 1 ? '' : 's'}`, specialists ? `${specialists} specialist${specialists === 1 ? '' : 's'}` : '', took];
  return <span>{run.status === 'running' && <span className="ag-dot" aria-hidden="true"/>} {parts.filter(Boolean).join(' · ')}</span>;
}

/** Map a `task` call to the subagent namespace that ran it (by subagent name, then by order). */
function subFor(item: TimelineItem, timeline: TimelineItem[], subagents: Record<string, SubagentTrace>) {
  const traces = Object.values(subagents);
  if (!traces.length) return undefined;
  const sameType = timeline.filter(t => t.kind === 'task' && t.subagent === item.subagent);
  const named = traces.filter(t => t.subagent === item.subagent);
  if (named.length) return named[sameType.indexOf(item)]?.timeline;
  const tasks = timeline.filter(t => t.kind === 'task');
  return traces[tasks.indexOf(item)]?.timeline;
}

const STEP_ICON = { plan: ListChecks, task: GitBranch, tool: Wrench, say: MessageSquare, file: FileText };
function Step({ item, sub }: { item: TimelineItem; sub?: TimelineItem[] }) {
  const plan = item.name === 'write_todos';
  const file = !!item.name && /^(write_file|edit_file|read_file|ls|glob|grep)$/.test(item.name);
  const Icon = item.kind === 'say' ? STEP_ICON.say : item.kind === 'task' ? STEP_ICON.task : plan ? STEP_ICON.plan : file ? STEP_ICON.file : STEP_ICON.tool;
  if (item.kind === 'say') return <li className="ag-step say"><span className="ag-step-icon"><Icon aria-hidden="true"/></span><div className="ag-step-body"><p className="ag-say">{item.detail}</p></div></li>;
  const title = item.kind === 'task' ? <>Asked the <strong>{item.subagent}</strong> specialist</> : plan ? 'Updated plan' : <span>{humanTool(item.name)}</span>;
  const hasMore = item.kind === 'task' || !!item.result;
  const head = <>
    <span className="ag-step-icon"><Icon aria-hidden="true"/></span>
    <span className="ag-step-title">{title}{item.kind === 'task' && <AgentBadge label="Subagent"/>}</span>
    {item.kind !== 'task' && !plan && <span className="ag-step-args">{argHint(item.detail)}</span>}
    {plan && <span className="ag-step-args">{item.detail}</span>}
    <span className="ag-step-end"><StepStatus status={item.status}/></span>
  </>;
  if (!hasMore) return <li className={`ag-step ${item.status}`}><div className="ag-step-row">{head}</div></li>;
  return <li className={`ag-step ${item.status}`}><details open={item.kind === 'task' && item.status === 'running'}>
    <summary className="ag-step-row">{head}</summary>
    <div className="ag-step-more">
      {item.kind === 'task' && item.detail && <p className="ag-say">{item.detail}</p>}
      {sub && sub.length > 0 && <ol className="ag-timeline nested">{sub.map(s => <Step key={s.id} item={s}/>)}</ol>}
      {item.result && <><p className="ag-label">{item.status === 'error' ? 'Error' : 'Result'}</p><pre className="code-block">{item.result}</pre></>}
    </div>
  </details></li>;
}
function StepStatus({ status }: { status: TimelineItem['status'] }) {
  if (status === 'running') return <span className="ag-dot working" aria-label="Running"/>;
  if ((status as string) === 'waiting') return <span className="ag-step-wait">Awaiting approval</span>;
  if (status === 'error') return <X className="ag-step-err" aria-label="Error"/>;
  return <Check className="ag-step-ok" aria-label="Done"/>;
}

function ResultRow({ run }: { run: RunDetail }) {
  const ok = run.status === 'published' || run.status === 'applied';
  const text = run.status === 'published' ? 'Approved and shared with its services'
    : run.status === 'applied' ? `Patch applied · ${run.title.replace(/^Adapt · /, '')} updated`
    : run.status === 'rejected' ? 'Rejected — nothing was shared or applied'
    : run.status === 'failed' ? 'The last step reported an error' : 'Finished';
  return <p className={`ag-result ${run.status}`}>{ok ? <CheckCircle2 aria-hidden="true"/> : run.status === 'completed' ? <Check aria-hidden="true"/> : <XCircle aria-hidden="true"/>}{text}</p>;
}

function Files({ run }: { run: RunDetail }) {
  const files = Object.keys(run.files);
  const [tab, setTab] = useState('');
  const active = files.includes(tab) ? tab : files.find(f => f.endsWith('.diff')) || files[0] || '';
  return <section className="ag-section" aria-label="Files">
    <div className="ag-section-head"><h3>Files</h3><span className="subtle">{files.length}</span></div>
    {!files.length ? <p className="subtle">No evidence or patch files yet.</p> : <>
      <div className="tabs" role="tablist">{files.map(f => <button key={f} type="button" role="tab" aria-selected={f === active} onClick={() => setTab(f)}>{f.split('/').pop()}</button>)}</div>
      {/\.(diff|patch)$/.test(active) ? <DiffView text={run.files[active]}/> : <pre className="code-block ag-file">{run.files[active]}</pre>}
    </>}
  </section>;
}

const TOOL_NAMES: Record<string, string> = { read_file: 'Read', write_file: 'Wrote', edit_file: 'Edited', ls: 'Listed files', glob: 'Searched files', grep: 'Searched', publish_context: 'Proposed update', submit_patch: 'Proposed patch' };
function humanTool(name?: string) { if (!name) return 'Step'; return TOOL_NAMES[name] ?? name.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()); }
/** A short, human hint from a tool call's JSON args: a file name or the first short string. */
function argHint(detail: string) {
  try {
    const args = JSON.parse(detail) as Record<string, unknown>;
    const path = [args.file_path, args.path, args.pattern].find(v => typeof v === 'string') as string | undefined;
    if (path) return path.split('/').filter(Boolean).pop() || path;
    const first = Object.values(args).find(v => typeof v === 'string' && v.length < 80);
    return typeof first === 'string' ? first : '';
  } catch { return ''; }
}
