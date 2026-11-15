'use client';

// Review cards shared by Activity and the Agents run page: the analyst's "share this update?"
// card, the adapter's "apply this patch?" card, the drawers with the full report / diff, and the
// New analysis dialog. Everything shown came from a model: rendered as plain text only.
// Approve / reject are owner-only and enforced again by POST /api/agents/runs/:id.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Check, FileText, Sparkles, X } from 'lucide-react';
import { Badge, Button } from '../components/ui';
import { Drawer } from '../components/overlays';
import { agentActions } from './client';
import { DiffView, parseDiff } from './diff';

// ---------- plain-English summary from a Markdown packet ----------
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/;
const clean = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/^#+\s*/, '').replace(BULLET, '').replace(/\s+/g, ' ').trim();
const sentences = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-Z])/).map(x => x.trim()).filter(x => x.length > 12);
const cap = (s: string, n = 170) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
function sections(md: string) {
  const out: [string, string[]][] = []; let cur: string[] = [];
  out.push(['', cur]);
  for (const line of md.split('\n')) {
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h) { cur = []; out.push([clean(h[1]).toLowerCase(), cur]); } else if (line.trim()) cur.push(line);
  }
  return out;
}
/** 2–4 short bullets: the packet's Summary, unresolved values, a deprecation note. */
export function summaryBullets(content: string, tags: string[] = []) {
  const secs = sections(content || '');
  const find = (name: string) => secs.find(([k]) => k.includes(name))?.[1] ?? [];
  const pick = (lines: string[], n: number) => {
    const items = lines.filter(l => BULLET.test(l)).map(clean);
    return (items.length ? items : sentences(lines.map(clean).join(' '))).filter(Boolean).slice(0, n);
  };
  const out = pick(find('summary'), 2);
  const unresolved = tags.filter(t => t.startsWith('unresolved:')).map(t => t.slice('unresolved:'.length));
  if (unresolved.length) out.push(`${unresolved.join(', ')} ${unresolved.length === 1 ? 'has' : 'have'} no documented mapping — needs manual review`);
  const deprecated = pick(find('deprecat'), 1)[0];
  if (deprecated && out.length < 4) out.push(deprecated);
  if (out.length < 2) out.push(...pick(find('recommend'), 2 - out.length));
  if (!out.length) out.push(...sentences(clean(content || '')).slice(0, 2));
  return [...new Set(out)].slice(0, 4).map(b => cap(b));
}
export const packetTitle = (title: string) => title.trim() || 'Update';

/** The first few changed lines of a unified diff, plus totals. */
export function diffPreview(text: string | undefined, max = 6) {
  const files = parseDiff(text || '');
  const lines = files.flatMap(f => f.lines.filter(l => l.kind === 'add' || l.kind === 'del')).slice(0, max);
  return { lines, files: files.length, added: files.reduce((n, f) => n + f.added, 0), removed: files.reduce((n, f) => n + f.removed, 0) };
}

// ---------- approve / reject ----------
function Decision({ threadId, approveLabel, onDecided, extra }: { threadId: string; approveLabel: string; onDecided: () => void; extra?: ReactNode }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'' | 'approve' | 'reject'>('');
  const [error, setError] = useState('');
  async function decide(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !reason.trim()) { setError('Give a reason for rejecting.'); return; }
    setBusy(decision); setError('');
    try { await agentActions.decide(threadId, decision, reason.trim()); onDecided(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Decision failed.'); setBusy(''); }
  }
  return <div className="rv-decision">
    {rejecting ? <form className="rv-reject" onSubmit={(e: FormEvent) => { e.preventDefault(); void decide('reject'); }}>
      <label>Why are you rejecting this? <span className="subtle">The agent stops; nothing is shared or applied.</span>
        <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} autoFocus required placeholder="What is wrong with it?"/></label>
      <div className="page-actions"><Button type="submit" variant="danger" size="sm" disabled={!!busy || !reason.trim()}>{busy === 'reject' ? 'Rejecting…' : 'Reject'}</Button><Button variant="ghost" size="sm" disabled={!!busy} onClick={() => { setRejecting(false); setError(''); }}>Cancel</Button></div>
    </form> : <div className="page-actions">
      <Button variant="primary" size="sm" icon={<Check/>} disabled={!!busy} onClick={() => void decide('approve')}>{busy === 'approve' ? 'Working…' : approveLabel}</Button>
      <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => setRejecting(true)}>Reject…</Button>
      {extra}
    </div>}
    {error && <p className="alert" role="alert">{error}</p>}
  </div>;
}

type PacketArgs = { title?: unknown; content?: unknown; tags?: unknown; change?: unknown };
const asTags = (v: unknown) => Array.isArray(v) ? v.map(String) : [];

/** Analyst approval: bullets + "Share this update with N services?" */
export function AnalystReview({ threadId, args, canControl, services, onDecided }: { threadId: string; args: PacketArgs; canControl: boolean; services: number; onDecided: () => void }) {
  const [open, setOpen] = useState(false);
  const content = String(args.content ?? ''); const tags = asTags(args.tags);
  const breaking = (args.change as { breaking?: boolean } | undefined)?.breaking;
  const full = <Button variant="ghost" size="sm" icon={<FileText/>} onClick={() => setOpen(true)}>View full report</Button>;
  return <div className="rv-card rv-waiting">
    <div className="rv-title"><strong>{packetTitle(String(args.title ?? ''))}</strong>{breaking && <Badge tone="failed">Breaking</Badge>}</div>
    <ul className="rv-bullets">{summaryBullets(content, tags).map(b => <li key={b}>{b}</li>)}</ul>
    {canControl ? <>
      <p className="rv-question">Share this update with {services} service{services === 1 ? '' : 's'}?</p>
      <Decision threadId={threadId} approveLabel="Approve and share" onDecided={onDecided} extra={full}/>
    </> : <div className="rv-foot"><span className="subtle">Waiting for the group owner to review.</span>{full}</div>}
    {open && <ReportDrawer title={packetTitle(String(args.title ?? ''))} content={content} breaking={breaking} tags={tags} onClose={() => setOpen(false)}/>}
  </div>;
}

/** Adapter approval: small diff preview + "Apply patch". */
export function PatchReview({ threadId, service, summary, diff, notes, canControl, onDecided }: { threadId: string; service: string; summary?: string; diff?: string; notes?: string; canControl: boolean; onDecided: () => void }) {
  const [open, setOpen] = useState(false);
  const preview = diffPreview(diff);
  const full = <Button variant="ghost" size="sm" icon={<FileText/>} onClick={() => setOpen(true)}>View full diff</Button>;
  return <div className="rv-card rv-waiting">
    {summary && <p className="rv-summary">{cap(summary, 220)}</p>}
    {preview.lines.length > 0 ? <div className="rv-diff" aria-label="Diff preview">
      {preview.lines.map((l, i) => <div key={i} className={l.kind}><span aria-hidden="true">{l.kind === 'add' ? '+' : '−'}</span>{l.text || ' '}</div>)}
    </div> : <p className="subtle">No diff was attached.</p>}
    {preview.lines.length > 0 && <p className="rv-stat"><span className="add">+{preview.added}</span> <span className="del">−{preview.removed}</span> in {preview.files} file{preview.files === 1 ? '' : 's'}</p>}
    {canControl ? <Decision threadId={threadId} approveLabel="Apply patch" onDecided={onDecided} extra={full}/>
      : <div className="rv-foot"><span className="subtle">Waiting for the group owner to review.</span>{full}</div>}
    {open && <Drawer title={`Patch for ${service}`} onClose={() => setOpen(false)}>
      {summary && <p className="prose-text">{summary}</p>}
      <DiffView text={diff}/>
      {notes && <><h3 className="rv-h">Notes</h3><p className="prose-text">{notes}</p></>}
    </Drawer>}
  </div>;
}

export function ReportDrawer({ title, content, breaking, tags = [], onClose }: { title: string; content: string; breaking?: boolean | null; tags?: string[]; onClose: () => void }) {
  const unresolved = tags.filter(t => t.startsWith('unresolved:')).map(t => t.slice(11));
  return <Drawer title={title} onClose={onClose}>
    {(breaking || unresolved.length > 0) && <div className="page-actions">{breaking && <Badge tone="failed">Breaking</Badge>}{unresolved.length > 0 && <Badge tone="waiting">Needs review: {unresolved.join(', ')}</Badge>}</div>}
    <ul className="rv-bullets">{summaryBullets(content, tags).map(b => <li key={b}>{b}</li>)}</ul>
    <h3 className="rv-h">Full report</h3>
    <p className="prose-text">{content}</p>
  </Drawer>;
}

// ---------- New analysis ----------
export const DEFAULT_GOAL = 'Analyze the Maintenance API change from v1 to v2. Identify breaking changes for consumers, cite evidence, and flag anything the sources leave unresolved. Propose one context packet for review.';
export function NewAnalysisDialog({ spaceId, sources, onClose, onStarted }: { spaceId: string; sources: { id: string; label: string }[]; onClose: () => void; onStarted: (threadId: string) => void }) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [onClose, busy]);
  async function run(work: () => Promise<{ threadId: string }>) {
    setBusy(true); setError('');
    try { onStarted((await work()).threadId); } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the analysis.'); setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-analysis-title">
      <div className="section-heading"><h2 id="new-analysis-title">New analysis</h2><Button variant="ghost" size="sm" iconOnly aria-label="Close" icon={<X/>} onClick={onClose} disabled={busy}/></div>
      <p>The analyst reads a source and proposes one update for your approval.</p>
      <form onSubmit={e => { e.preventDefault(); void run(() => agentActions.startAnalyst(spaceId, sourceId, goal)); }}>
        <label>Source<select value={sourceId} onChange={e => setSourceId(e.target.value)}>{sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label>What should it look for?<textarea value={goal} onChange={e => setGoal(e.target.value)} rows={4} maxLength={4000} required/></label>
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="page-actions">
          <Button type="submit" variant="primary" disabled={busy || !sourceId || !goal.trim()}>{busy ? 'Starting…' : 'Start analysis'}</Button>
          <Button variant="ghost" icon={<Sparkles/>} disabled={busy} onClick={() => void run(() => agentActions.sample(spaceId))}>Run sample instead</Button>
        </div>
      </form>
    </section>
  </div>;
}
