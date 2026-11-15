'use client';

// Run detail: header, approval panel, plan, timeline (with nested subagent steps) and files.
// All of it is model output or remote context: rendered as plain text only.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, CircleDashed, CircleDot, FileText, GitBranch, ListChecks, MessageSquare, Square, Wrench, X } from 'lucide-react';
import type { RunDetail, SubagentTrace, TimelineItem } from '../../lib/agents';
import { AgentBadge, Badge, Button, CopyId, InfoTip, StatusPill } from '../components/ui';
import { call, duration, fullTime, relTime, runStatus, useNow } from './client';
import { DiffView } from './diff';

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
  const { run, canControl, timings, subagents, impact, live, streamError, reconnect, refetch } = useRun(threadId, onChange);
  const now = useNow();
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  if (!run) return <div className="ag-detail-empty"><p className="subtle">{streamError || 'Opening run…'}</p></div>;
  const { status, label } = runStatus(run, canControl);
  async function stop() {
    setStopping(true); setError('');
    try { await call(`/api/agents/runs/${encodeURIComponent(threadId)}/cancel`, { method: 'POST', body: '{}' }); onChange(); await refetch(); reconnect(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not stop the run.'); } finally { setStopping(false); }
  }
  const done = run.todos.filter(t => t.status === 'completed').length;
  return <article className="card ag-detail" aria-label={run.title}>
    <header className="ag-detail-head">
      <div className="ag-detail-title">
        {onBack && <Button variant="ghost" size="sm" className="ag-back" onClick={onBack} icon={<ChevronRight style={{ transform: 'rotate(180deg)' }}/>}>Runs</Button>}
        <h2>{run.title}</h2>
        <StatusPill status={status} label={label}/>
      </div>
      <div className="page-actions">
        {canControl && run.status === 'running' && <Button variant="danger" size="sm" icon={<Square/>} disabled={stopping} onClick={() => void stop()}>{stopping ? 'Stopping…' : 'Stop'}</Button>}
      </div>
    </header>
    <p className="ag-meta"><span title={fullTime(run.createdAt)}>Started {relTime(run.createdAt, now)}</span>{run.runId && <CopyId id={run.runId}/>}{live && <span className="ag-live"><span className="live-dot" aria-hidden="true"/>Live</span>}{run.decision && <span>· {run.decision}</span>}{run.goal && <InfoTip text={`Goal: ${run.goal}`}/>}</p>
    {(error || streamError) && <div className="alert" role="alert">{error || streamError}</div>}
    {run.error && <div className="alert" role="alert">Run failed: {run.error}</div>}
    {run.approval && <ApprovalPanel run={run} canControl={canControl} impact={impact} onDecided={() => { reconnect(); onChange(); }}/>}
    {!run.approval && run.result && <ResultRow run={run}/>}

    {run.todos.length > 0 && <section className="ag-section" aria-label="Plan">
      <div className="ag-section-head"><h3>Plan</h3><span className="subtle">{done}/{run.todos.length}</span><span className="ag-progress" aria-hidden="true"><span style={{ width: `${(done / run.todos.length) * 100}%` }}/></span></div>
      <ul className="ag-plan">{run.todos.map((t, i) => <li key={i} className={t.status}>{t.status === 'completed' ? <Check aria-label="Done"/> : t.status === 'in_progress' ? <CircleDot aria-label="In progress"/> : <CircleDashed aria-label="Pending"/>}<span>{t.content}</span></li>)}</ul>
    </section>}

    <section className="ag-section" aria-label="Timeline">
      <div className="ag-section-head"><h3>Timeline</h3><span className="subtle">{run.timeline.filter(i => i.kind !== 'say').length} steps</span></div>
      {run.timeline.length ? <ol className="ag-timeline">{run.timeline.map(item => <Step key={item.id} item={item} timings={timings} sub={item.kind === 'task' ? subFor(item, run.timeline, subagents) : undefined}/>)}</ol>
        : <p className="subtle">Waiting for the first step…</p>}
    </section>

    <Files run={run}/>
  </article>;
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
function Step({ item, timings, sub }: { item: TimelineItem; timings: Timings; sub?: TimelineItem[] }) {
  const time = timings[item.id];
  const plan = item.name === 'write_todos';
  const file = !!item.name && /^(write_file|edit_file|read_file|ls|glob|grep)$/.test(item.name);
  const Icon = item.kind === 'say' ? STEP_ICON.say : item.kind === 'task' ? STEP_ICON.task : plan ? STEP_ICON.plan : file ? STEP_ICON.file : STEP_ICON.tool;
  const took = duration(time?.at, time?.end);
  if (item.kind === 'say') return <li className="ag-step say"><span className="ag-step-icon"><Icon aria-hidden="true"/></span><div className="ag-step-body"><p className="ag-say">{item.detail}</p></div></li>;
  const title = item.kind === 'task' ? <>Delegated to <strong>{item.subagent}</strong></> : plan ? 'Updated plan' : <span className="mono">{item.name}</span>;
  const hasMore = item.kind === 'task' || !!item.result || item.detail.length > 80;
  const head = <>
    <span className="ag-step-icon"><Icon aria-hidden="true"/></span>
    <span className="ag-step-title">{title}{item.kind === 'task' && <AgentBadge label="Subagent"/>}</span>
    {item.kind !== 'task' && !plan && <span className="ag-step-args mono">{item.detail}</span>}
    {plan && <span className="ag-step-args">{item.detail}</span>}
    <span className="ag-step-end">{took && <span className="subtle">{took}</span>}<StepStatus status={item.status}/></span>
  </>;
  if (!hasMore) return <li className={`ag-step ${item.status}`}><div className="ag-step-row">{head}</div></li>;
  return <li className={`ag-step ${item.status}`}><details open={item.kind === 'task' && item.status === 'running'}>
    <summary className="ag-step-row">{head}</summary>
    <div className="ag-step-more">
      {item.kind === 'task' && item.detail && <p className="ag-say">{item.detail}</p>}
      {item.kind !== 'task' && item.detail.length > 80 && <pre className="ag-pre">{item.detail}</pre>}
      {sub && sub.length > 0 && <ol className="ag-timeline nested">{sub.map(s => <Step key={s.id} item={s} timings={{}}/>)}</ol>}
      {item.kind === 'task' && !sub?.length && <p className="subtle">Nested steps are shown only for runs this web server streamed live.</p>}
      {item.result && <><p className="ag-label">{item.status === 'error' ? 'Error' : 'Result'}</p><pre className="ag-pre">{item.result}</pre></>}
    </div>
  </details></li>;
}
function StepStatus({ status }: { status: TimelineItem['status'] }) {
  if (status === 'running') return <span className="ag-dot working" aria-label="Running"/>;
  if (status === 'error') return <X className="ag-step-err" aria-label="Error"/>;
  return <Check className="ag-step-ok" aria-label="Done"/>;
}

function ResultRow({ run }: { run: RunDetail }) {
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(run.result || ''); } catch { /* plain text */ }
  const event = parsed?.event as Record<string, unknown> | undefined;
  const text = run.status === 'published' && event ? `Published v${event.version} to ${event.topic}`
    : run.status === 'applied' ? `Patch applied to a private copy${parsed?.copyDir ? ` (${parsed.copyDir})` : ''} · delivery acknowledged`
    : run.status === 'rejected' ? `Rejected${parsed?.reviewerMessage ? `: ${parsed.reviewerMessage}` : ''} — nothing was published or applied`
    : run.status === 'failed' ? 'The final tool call reported an error' : 'Finished';
  return <div className={`ag-result ${run.status}`}>
    <span>{text}</span>
    {event?.eventId ? <CopyId id={String(event.eventId)}/> : null}
    <details><summary className="text-button">Raw result</summary><pre className="ag-pre">{run.result}</pre></details>
  </div>;
}

function Files({ run }: { run: RunDetail }) {
  const files = Object.keys(run.files);
  const [tab, setTab] = useState('');
  const active = files.includes(tab) ? tab : files.find(f => f.endsWith('.diff')) || files[0] || '';
  return <section className="ag-section" aria-label="Files">
    <div className="ag-section-head"><h3>Files</h3><span className="subtle">{files.length}</span></div>
    {!files.length ? <p className="subtle">No evidence or patch files yet.</p> : <>
      <div className="ag-tabs" role="tablist">{files.map(f => <button key={f} type="button" role="tab" aria-selected={f === active} onClick={() => setTab(f)}>{f.split('/').pop()}</button>)}</div>
      <p className="ag-path mono">{active}</p>
      {/\.(diff|patch)$/.test(active) ? <DiffView text={run.files[active]}/> : <pre className="ag-pre ag-file">{run.files[active]}</pre>}
    </>}
  </section>;
}

function ApprovalPanel({ run, canControl, impact, onDecided }: { run: RunDetail; canControl: boolean; impact: Impact; onDecided: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const approval = run.approval!;
  const action = approval.actions[0];
  const meta = approval.civitas ?? {};
  async function decide(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !reason.trim()) { setError('Give a reason for rejecting.'); return; }
    setBusy(true); setError('');
    try { await call(`/api/agents/runs/${encodeURIComponent(run.threadId)}`, { method: 'POST', body: JSON.stringify({ decision, message: reason }) }); onDecided(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Decision failed.'); } finally { setBusy(false); }
  }
  const analyst = run.kind === 'analyst';
  const role = run.role || meta.role || '';
  const summary = analyst ? <>Publish <strong>“{String(action?.args.title ?? 'context packet')}”</strong> to <span className="mono">{meta.topic || 'its topic'}</span></>
    : <>Apply the patch to <strong>{run.title.replace(/^Adapt · /, '')}</strong> and acknowledge the delivery</>;
  const impactText = analyst
    ? impact ? `Publishes to ${impact.subscribers} subscribed agent${impact.subscribers === 1 ? '' : 's'}` : 'Publishes to every agent subscribed to this topic'
    : `Changes a private copy${meta.copyDir ? ` (${meta.copyDir})` : ''}; examples stay unchanged`;
  const checks: { ok: boolean; text: string }[] = [];
  if (meta.checks) checks.push({ ok: meta.checks === 'passed', text: `Automatic checks ${meta.checks}` });
  if (!analyst) checks.push({ ok: meta.checks === 'passed', text: 'git apply --check' });
  if (meta.typecheck) checks.push({ ok: meta.typecheck === 'OK', text: `TypeScript: ${meta.typecheck}` });
  const change = action?.args.change as { breaking?: boolean; kind?: string } | undefined;
  return <section className="ag-approval" aria-label="Approval required">
    <div className="ag-approval-head">
      <StatusPill status="waiting" label={canControl ? 'Waiting for you' : 'Waiting for owner'}/>
      <p className="ag-approval-summary">{summary}</p>
    </div>
    <dl className="ag-facts">
      <div><dt>Impact</dt><dd>{impactText}</dd></div>
      <div><dt>Checks</dt><dd className="ag-checks">{checks.length ? checks.map(c => <span key={c.text}>{c.ok ? <Check className="ag-step-ok" aria-hidden="true"/> : <X className="ag-step-err" aria-hidden="true"/>}{c.text}</span>) : <span className="subtle">No check results reported</span>}</dd></div>
      {analyst && meta.sourceUri && <div><dt>Source</dt><dd><span className="mono">{meta.sourceUri}</span> @ <span className="mono">{meta.revision}</span></dd></div>}
      {!analyst && meta.deliveryId && <div><dt>Delivery</dt><dd><CopyId id={meta.deliveryId}/></dd></div>}
    </dl>
    {canControl ? <div className="ag-approval-actions">
      {rejecting ? <div className="ag-reject">
        <label>Reason for rejecting (sent to the agent)<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} autoFocus placeholder="What is wrong with this?"/></label>
        <div className="page-actions"><Button variant="danger" disabled={busy || !reason.trim()} onClick={() => void decide('reject')}>{busy ? 'Rejecting…' : 'Reject and stop run'}</Button><Button variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>Cancel</Button>
          <InfoTip text="The agent does not re-propose after a rejection: the run stops and nothing is published or applied. Start a new run to try again."/></div>
      </div> : <div className="page-actions">
        <Button variant="primary" disabled={busy} icon={<Check/>} onClick={() => void decide('approve')}>{busy ? 'Approving…' : analyst ? 'Approve and publish' : 'Approve and apply'}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>Reject…</Button>
      </div>}
    </div> : <p className="subtle">Only the group owner can approve or reject.</p>}
    {error && <div className="alert" role="alert">{error}</div>}
    <details className="ag-approval-content" open>
      <summary className="ag-label">{analyst ? 'Full packet' : 'Full diff and notes'}</summary>
      {analyst ? <div className="ag-packet">
        <div className="ag-packet-tags">{change && <Badge tone={change.breaking ? 'failed' : 'neutral'}>{change.breaking ? 'Breaking' : 'Non-breaking'}{change.kind ? ` · ${change.kind}` : ''}</Badge>}{Array.isArray(action?.args.tags) && (action.args.tags as unknown[]).map(t => <Badge key={String(t)} mono>{String(t)}</Badge>)}</div>
        <pre className="ag-pre ag-file">{String(action?.args.content ?? '')}</pre>
        {change && <details><summary className="text-button">Structured change</summary><pre className="ag-pre">{JSON.stringify(change, null, 2)}</pre></details>}
      </div> : <div className="ag-packet">
        {typeof action?.args.summary === 'string' && <p>{action.args.summary}</p>}
        <DiffView text={run.files[meta.patchPath || `/patches/${role}.diff`]}/>
        {run.files[meta.notesPath || `/notes/${role}.md`] && <><p className="ag-label">Notes</p><pre className="ag-pre ag-file">{run.files[meta.notesPath || `/notes/${role}.md`]}</pre></>}
      </div>}
    </details>
  </section>;
}
