'use client';

// Activity: the group's home. One chronological feed (oldest at the top, composer at the bottom)
// that merges people's messages, agent replies and agent runs (analysis → approval → rollout →
// patches). Polls the room (1s), agent runs (3s while active) and the shared-update feed (5s).
// Everything that came from a model, an agent or another person is rendered as plain text.
// Approve / reject / start are owner-only in the UI and enforced again server-side.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { Room } from '@civitas/contracts';
import { FileText, MessageSquare, Plus, Send, Sparkles, UserPlus } from 'lucide-react';
import type { Receiver, RunDetail, RunSummary, Stage } from '../../lib/agents';
import { useShell } from '../components/app-shell';
import { AgentAvatar, Avatar, Badge, Button, EmptyState, StatusPill, type Status } from '../components/ui';
import { dayLabel, errorText, InviteDialog, operate, useRoom } from '../components/rooms';
import { agentActions, call, fullTime, relTime, runStatus, shortLabel, useAgentsOverview, useNow, type AgentsOverview } from '../agents/client';
import { AnalystReview, NewAnalysisDialog, PatchReview, PatchDownload, ReportDrawer, packetTitle, summaryBullets } from '../agents/review';
import '../styles/agents.css';
import '../styles/activity.css';

type Post = Room['posts'][number];
type FeedEvent = {
  eventId: string; version: number; title: string; topic: string; content: string; tags: string[]; breaking: boolean | null;
  publishedAt: string; publisher: { agentId: string; label: string }; analystThreadId?: string; receivers: Receiver[];
};
type ContextFeed = { enabled: boolean; storage?: 'memory' | 'postgres'; events: FeedEvent[] };
type Detail = { run: RunDetail; canControl: boolean; impact: { subscribers: number; topic: string } | null };
type Item =
  | { kind: 'post'; at: string; key: string; post: Post }
  | { kind: 'analysis' | 'analysis-decision' | 'patch' | 'patch-decision'; at: string; key: string; run: RunSummary }
  | { kind: 'shared'; at: string; key: string; event: FeedEvent; run?: RunSummary };

const GROUP_GAP_MS = 5 * 60 * 1000;
const anchor = (threadId: string) => `item-${threadId}`;

function useContextFeed(spaceId: string) {
  const [feed, setFeed] = useState<ContextFeed | null>(null);
  const load = useCallback(async () => {
    if (!spaceId) return;
    try { setFeed(await call<ContextFeed>(`/api/context?space=${encodeURIComponent(spaceId)}`)); } catch { /* keep the last feed */ }
  }, [spaceId]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 5000); return () => clearInterval(t); }, [load]);
  return { feed, load };
}

/** Full run detail (approval args, diff) for runs waiting on a decision; refetched when the run changes. */
function useWaitingDetails(runs: RunSummary[]) {
  const [details, setDetails] = useState<Record<string, { key: string; data: Detail }>>({});
  const inflight = useRef(new Set<string>());
  useEffect(() => {
    for (const run of runs) {
      if (run.status !== 'waiting') continue;
      const key = `${run.threadId}:${run.updatedAt}`;
      if (details[run.threadId]?.key === key || inflight.current.has(key)) continue;
      inflight.current.add(key);
      call<Detail>(`/api/agents/runs/${encodeURIComponent(run.threadId)}`)
        .then(data => setDetails(prev => ({ ...prev, [run.threadId]: { key, data } })))
        .catch(() => undefined).finally(() => inflight.current.delete(key));
    }
  }, [runs, details]);
  return details;
}

export default function ActivityView() {
  const shell = useShell();
  const { spaceId, space } = shell;
  const now = useNow(30_000);
  const { room, error: roomError, reload: reloadRoom } = useRoom(spaceId, 'group', 1000);
  const { overview, error: agentsError, load: reloadAgents } = useAgentsOverview(spaceId);
  const { feed, load: reloadFeed } = useContextFeed(spaceId);
  const runs = useMemo(() => overview?.runs ?? [], [overview]);
  const workspaceAgents = useMemo(() => new Set(overview?.workspace.map(r => r.agentId).filter((id): id is string => !!id) ?? []), [overview]);
  const details = useWaitingDetails(runs);
  const [recipient, setRecipient] = useState('');
  const [dialog, setDialog] = useState<'' | 'analysis' | 'invite'>('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const owner = (room?.space.role ?? space?.role) === 'owner';

  const refreshAll = useCallback(() => { void reloadAgents(); void reloadFeed(); void reloadRoom(); }, [reloadAgents, reloadFeed, reloadRoom]);
  useEffect(() => { if (recipient && room && !room.agents.some(a => a.agentId === recipient && a.canReply)) setRecipient(''); }, [room, recipient]);

  const items = useMemo(() => buildItems(room?.posts ?? [], runs, feed?.events ?? []), [room?.posts, runs, feed?.events]);

  async function act(label: string, work: () => Promise<unknown>) {
    setBusy(label); setError('');
    try { await work(); refreshAll(); } catch (e) { setError(errorText(e, 'Action failed.')); } finally { setBusy(''); }
  }
  const sample = () => act('sample', () => agentActions.sample(spaceId));
  const startAdapters = (roles: string[]) => act(`adapt:${roles.join(',')}`, async () => { for (const role of roles) await agentActions.startAdapter(spaceId, role); });

  if (!spaceId) return <div className="page"><EmptyState icon={<MessageSquare/>} title="Start a group" description="A private space for your people and their agents." action={<div className="page-actions"><Button variant="primary" onClick={() => shell.openDialog('create')}>Create group</Button><Button onClick={() => shell.openDialog('accept')}>Accept invitation</Button></div>}/></div>;

  const name = room?.space.name || space?.name || 'this group';
  const serverUp = overview?.agentServer.up ?? false;
  const ready = !!room && (!!overview || !!agentsError);
  const noAgentWork = ready && !runs.length && !feed?.events.length;
  const empty = noAgentWork && !room!.posts.length;
  const sampleButton = <Button variant="primary" size={empty ? 'md' : 'sm'} icon={<Sparkles/>} disabled={!serverUp || !!busy} onClick={() => void sample()}>{busy === 'sample' ? 'Starting…' : 'Analyze API change'}</Button>;
  const ctx: Ctx = { overview, details, members: room?.members ?? [], owner, now, spaceId, serverUp, runs, busy, onChanged: refreshAll, onAdapt: startAdapters, newestByTopic: newestEvents(feed?.events ?? []) };

  return <div className="activity">
    <header className="activity-head">
      <div><h1>Activity</h1><p>Messages and agent updates in {name}.</p></div>
      {owner && overview && <Button variant="secondary" icon={<Plus/>} disabled={!serverUp} title={serverUp ? undefined : 'Agents are offline'} onClick={() => setDialog('analysis')}>New analysis</Button>}
    </header>
    {(error || roomError) && <div className="activity-col"><p className="alert" role="alert">{error || roomError}</p></div>}
    <Feed items={items} room={room} ctx={ctx} onAsk={setRecipient}
      empty={empty ? <EmptyState icon={<Sparkles/>} title="Nothing here yet"
        description={owner ? 'Watch an API change flow to your services: an agent analyzes it, you approve, each service gets a patch.' : 'Messages and agent updates in this group will appear here.'}
        action={owner && <div className="page-actions">{sampleButton}<Button variant="secondary" icon={<UserPlus/>} onClick={() => setDialog('invite')}>Invite teammates</Button></div>}/>
        : noAgentWork && owner ? <div className="starter"><AgentAvatar/><p><strong>Try the agents.</strong> <span className="muted">Compare API contracts and prepare updates for three services.</span></p>{sampleButton}</div> : null}
      offline={owner && !!overview && !serverUp}/>
    {room && <Composer room={room} spaceId={spaceId} recipient={recipient} setRecipient={setRecipient} onSent={reloadRoom} hidden={workspaceAgents}/>}
    {dialog === 'analysis' && overview && <NewAnalysisDialog spaceId={spaceId} sources={overview.sources} onClose={() => setDialog('')} onStarted={() => { setDialog(''); refreshAll(); }}/>}
    {dialog === 'invite' && <InviteDialog spaceId={spaceId} spaceName={name} onClose={() => setDialog('')}/>}
  </div>;
}

function newestEvents(events: FeedEvent[]) {
  const newest = new Map<string, FeedEvent>();
  for (const e of events) { const cur = newest.get(e.topic); if (!cur || cur.publishedAt < e.publishedAt) newest.set(e.topic, e); }
  return new Set([...newest.values()].map(e => e.eventId));
}

function buildItems(posts: Post[], runs: RunSummary[], events: FeedEvent[]): Item[] {
  // A shared update is also mirrored into the room as an agent post; the shared item replaces it.
  const mirrored = new Set(events.map(e => `${e.topic}\n${e.title}`));
  const items: Item[] = posts.filter(p => !(p.topic && p.title && mirrored.has(`${p.topic}\n${p.title}`)))
    .map(post => ({ kind: 'post', at: post.createdAt, key: post.postId, post }));
  const shared = new Set(events.map(e => e.analystThreadId).filter(Boolean));
  for (const run of runs) {
    const decided = run.decidedAt ?? run.updatedAt;
    if (run.kind === 'analyst') {
      items.push({ kind: 'analysis', at: run.createdAt, key: run.threadId, run });
      if (run.decision && !shared.has(run.threadId)) items.push({ kind: 'analysis-decision', at: decided, key: `${run.threadId}:d`, run });
    } else {
      items.push({ kind: 'patch', at: run.createdAt, key: run.threadId, run });
      if (run.decision) items.push({ kind: 'patch-decision', at: decided, key: `${run.threadId}:d`, run });
    }
  }
  for (const event of events) items.push({ kind: 'shared', at: event.publishedAt, key: event.eventId, event, run: runs.find(r => r.threadId === event.analystThreadId) });
  return items.sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
}

type Ctx = {
  overview: AgentsOverview | null; details: Record<string, { data: Detail }>; members: Room['members']; owner: boolean; now: number;
  spaceId: string; serverUp: boolean; runs: RunSummary[]; busy: string; newestByTopic: Set<string>;
  onChanged: () => void; onAdapt: (roles: string[]) => void;
};

function Feed({ items, room, ctx, onAsk, empty, offline }: { items: Item[]; room: Room | null; ctx: Ctx; onAsk: (id: string) => void; empty: ReactNode; offline: boolean }) {
  const stream = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const focused = useRef('');
  const last = items.at(-1)?.key;
  useLayoutEffect(() => { const el = stream.current; if (el && nearBottom.current) el.scrollTop = el.scrollHeight; }, [last, items.length]);
  useEffect(() => {
    const el = stream.current; const col = el?.firstElementChild;
    if (!el || !col || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (nearBottom.current) el.scrollTop = el.scrollHeight; });
    ro.observe(col); return () => ro.disconnect();
  }, []);
  // ?item=<threadId> (from Inbox): scroll to that run once it is rendered.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('item');
    if (!id || focused.current === id) return;
    const el = document.getElementById(anchor(id));
    if (el) { focused.current = id; nearBottom.current = false; el.scrollIntoView({ block: 'center' }); el.classList.add('fe-focus'); setTimeout(() => el.classList.remove('fe-focus'), 2400); }
  }, [items]);
  const replyable = new Set(room?.agents.filter(a => a.canReply).map(a => a.agentId) ?? []);
  const byId = new Map((room?.posts ?? []).map(p => [p.postId, p]));

  return <div className="activity-feed" ref={stream} role="log" aria-label="Activity" aria-live="polite" tabIndex={0}
    onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}>
    <div className="activity-col">
      {offline && <p className="activity-note"><span className="dot" aria-hidden="true"/>Agents are offline. Start them with <code>npm run agents</code>.</p>}
      {!room ? <p className="subtle activity-loading">Loading…</p> : empty}
      {items.map((item, i) => {
        const prev = items[i - 1];
        const newDay = !prev || new Date(prev.at).toDateString() !== new Date(item.at).toDateString();
        let node: ReactNode;
        if (item.kind === 'post') {
          const p = prev?.kind === 'post' ? prev.post : undefined;
          const continued = !newDay && !!p && p.authorId === item.post.authorId && p.origin === item.post.origin && !item.post.targetAgentId && !p.targetAgentId && !item.post.replyTo && Date.parse(item.post.createdAt) - Date.parse(p.createdAt) < GROUP_GAP_MS;
          node = <Message post={item.post} continued={continued} own={item.post.authorId === room?.currentAccountId} parent={item.post.replyTo ? byId.get(item.post.replyTo) : undefined} canReply={replyable.has(item.post.authorId)} receiver={room?.agents.find(a => a.agentId === item.post.targetAgentId)} onAsk={onAsk} now={ctx.now}/>;
        } else if (item.kind === 'shared') node = <SharedItem event={item.event} run={item.run} ctx={ctx}/>;
        else node = <RunItem kind={item.kind} run={item.run} ctx={ctx}/>;
        return <Fragment key={item.key}>{newDay && <div className="day-divider" role="separator"><span>{dayLabel(item.at)}</span></div>}{node}</Fragment>;
      })}
    </div>
  </div>;
}

// ---------- rows ----------
function Row({ id, avatar, who, text, pill, at, now, children, className }: { id?: string; avatar: ReactNode; who: ReactNode; text: ReactNode; pill?: ReactNode; at: string; now: number; children?: ReactNode; className?: string }) {
  return <article id={id} className={`fe ${className ?? ''}`}>
    <div className="fe-gutter">{avatar}</div>
    <div className="fe-body">
      <p className="fe-line"><span className="fe-text"><strong>{who}</strong> {text}</span>{pill}<time dateTime={at} title={fullTime(at)}>{relTime(at, now)}</time></p>
      {children}
    </div>
  </article>;
}

function Message({ post, continued, own, parent, canReply, receiver, onAsk, now }: { post: Post; continued: boolean; own: boolean; parent?: Post; canReply: boolean; receiver?: Room['agents'][number]; onAsk: (id: string) => void; now: number }) {
  const agent = post.origin === 'agent';
  return <article className={`fe msg ${continued ? 'continued' : ''}`}>
    <div className="fe-gutter">{continued ? null : agent ? <AgentAvatar/> : <Avatar name={post.authorName}/>}</div>
    <div className="fe-body">
      {!continued && <p className="fe-line"><span className="fe-text"><strong>{post.authorName}</strong>{own && <span className="subtle"> (you)</span>}{post.targetAgentName && <span className="muted"> → {post.targetAgentName}</span>}</span>
        {post.targetAgentId && <Delivery post={post} receiver={receiver}/>}<time dateTime={post.createdAt} title={fullTime(post.createdAt)}>{relTime(post.createdAt, now)}</time></p>}
      {parent && <div className="msg-reply-to">Replying to <strong>{parent.authorName}:</strong> <span>{parent.content}</span></div>}
      <p className="msg-text">{post.content}</p>
      {agent && canReply && <button type="button" className="msg-action" onClick={() => onAsk(post.authorId)}>Reply to agent</button>}
    </div>
  </article>;
}

function Delivery({ post, receiver }: { post: Post; receiver?: Room['agents'][number] }) {
  if (post.repliedAt) return <StatusPill status="done" label="Replied"/>;
  if (receiver?.receiverState === 'error') return <span title="Check the receiver terminal for login or usage-limit errors"><StatusPill status="failed" label="Reply failed"/></span>;
  if (receiver?.receiverState === 'responding' && receiver.respondingTo === post.postId) return <StatusPill status="working" label="Replying…"/>;
  if (receiver?.receiverState === 'listening' || receiver?.receiverState === 'responding') return <StatusPill status="working" label="Sending…"/>;
  return <span title="The agent owner must start their local receiver for automatic replies"><StatusPill status="idle" label="Receiver offline"/></span>;
}

const roleName = (ctx: Ctx, role: string) => ctx.overview?.workspace.find(r => r.role === role)?.name ?? (role === 'analyst' ? 'Analyst agent' : `${role} adapter`);
const serviceName = (ctx: Ctx, role?: string) => shortLabel(ctx.overview?.consumers.find(c => c.role === role)?.label || role || 'service');
const sourceName = (ctx: Ctx, run: RunSummary) => shortLabel(ctx.overview?.sources.find(s => s.id === run.sourceId)?.label || run.title.replace(/^Analysis · /, ''));
const memberName = (ctx: Ctx, accountId?: string) => ctx.members.find(m => m.accountId === accountId)?.name || 'The owner';
const runLink = (ctx: Ctx, run: RunSummary) => `/agents?space=${encodeURIComponent(ctx.spaceId)}&run=${encodeURIComponent(run.threadId)}`;

function RunItem({ kind, run, ctx }: { kind: 'analysis' | 'analysis-decision' | 'patch' | 'patch-decision'; run: RunSummary; ctx: Ctx }) {
  const detail = ctx.details[run.threadId]?.data;
  const approval = run.status === 'waiting' ? detail?.run.approval : null;
  const waiting = runStatus(run, ctx.owner);
  const base = { at: kind.endsWith('decision') ? (run.decidedAt ?? run.updatedAt) : run.createdAt, now: ctx.now };
  const watch = <Button variant="ghost" size="sm" href={runLink(ctx, run)}>Watch live</Button>;

  if (kind === 'analysis') {
    const source = sourceName(ctx, run);
    const props = { ...base, id: anchor(run.threadId), avatar: <AgentAvatar/>, who: roleName(ctx, 'analyst') };
    if (run.status === 'running' && !run.decision) return <Row {...props} text={`is analyzing ${source}…`} pill={<StatusPill status="working" label="Analyzing"/>}><div className="fe-actions">{watch}</div></Row>;
    if (run.status === 'waiting') {
      const args = approval?.actions[0]?.args ?? {};
      const breaking = (args.change as { breaking?: boolean } | undefined)?.breaking;
      return <Row {...props} text={breaking ? <>found a breaking change in {source}</> : <>finished analyzing {source}</>} pill={<StatusPill status="waiting" label={waiting.label}/>}>
        {approval ? <AnalystReview threadId={run.threadId} args={args} canControl={ctx.owner && !!detail?.canControl} services={detail?.impact?.subscribers ?? ctx.overview?.consumers.length ?? 0} onDecided={ctx.onChanged}/> : <p className="subtle fe-pad">Loading the proposed update…</p>}
      </Row>;
    }
    if (run.status === 'published' || (run.decision === 'approved' && run.status !== 'failed')) return <Row {...props} text={<>found changes in {source}</>}/>;
    if (run.status === 'rejected' || run.decision === 'rejected') return <Row {...props} text={`proposed an update for ${source}`} pill={<StatusPill status="idle" label="Rejected"/>}/>;
    if (run.status === 'failed') return <Row {...props} text={run.stopped ? `stopped analyzing ${source}` : `couldn’t finish analyzing ${source}`} pill={<StatusPill status={run.stopped ? 'idle' : 'failed'} label={run.stopped ? 'Stopped' : 'Failed'}/>}><div className="fe-actions"><Button variant="ghost" size="sm" href={runLink(ctx, run)}>See what happened</Button></div></Row>;
    return <Row {...props} text={`finished analyzing ${source}`}/>;
  }

  if (kind === 'analysis-decision') {
    const props = { ...base, avatar: <Avatar name={memberName(ctx, run.decidedBy)}/>, who: memberName(ctx, run.decidedBy) };
    if (run.decision === 'rejected') return <Row {...props} text="rejected the proposed update"/>;
    if (run.status === 'running') return <Row {...props} text="approved the update" pill={<StatusPill status="working" label="Sharing"/>}/>;
    return <Row {...props} text="approved the update, but sharing it failed" pill={<StatusPill status="failed" label="Failed"/>}/>;
  }

  const service = serviceName(ctx, run.role);
  if (kind === 'patch') {
    const props = { ...base, id: anchor(run.threadId), avatar: <AgentAvatar/>, who: roleName(ctx, run.role || '') };
    if (run.status === 'running' && !run.decision) return <Row {...props} text={`is preparing a patch for ${service}…`} pill={<StatusPill status="working" label="Working"/>}><div className="fe-actions">{watch}</div></Row>;
    if (run.status === 'waiting') {
      const meta = approval?.civitas ?? {};
      const files = detail?.run.files ?? {};
      return <Row {...props} text={`prepared a patch for ${service}`} pill={<StatusPill status="waiting" label={waiting.label}/>}>
        {approval ? <PatchReview threadId={run.threadId} service={service} summary={typeof approval.actions[0]?.args.summary === 'string' ? approval.actions[0].args.summary : undefined}
          diff={files[meta.patchPath || `/patches/${run.role}.diff`]} notes={files[meta.notesPath || `/notes/${run.role}.md`]} canControl={ctx.owner && !!detail?.canControl} onDecided={ctx.onChanged}/>
          : <p className="subtle fe-pad">Loading the patch…</p>}
      </Row>;
    }
    if (run.decision) return null; // the decision row below tells the rest
    if (run.status === 'failed') return <Row {...props} text={run.stopped ? `stopped working on ${service}` : `couldn’t prepare a patch for ${service}`} pill={<StatusPill status={run.stopped ? 'idle' : 'failed'} label={run.stopped ? 'Stopped' : 'Failed'}/>}/>;
    return <Row {...props} text={`finished without a patch for ${service}`}/>;
  }

  const props = { ...base, id: anchor(run.threadId), avatar: <Avatar name={memberName(ctx, run.decidedBy)}/>, who: memberName(ctx, run.decidedBy),
    children: <div className="fe-actions"><Button variant="ghost" size="sm" icon={<FileText/>} href={runLink(ctx, run)}>View diff</Button>{run.status === 'applied' && <PatchDownload threadId={run.threadId}/>}</div> };
  if (run.decision === 'rejected') return <Row {...props} text={`rejected the patch for ${service}`}/>;
  if (run.status === 'applied') return <Row {...props} className="fe-done" text={<>applied the patch · <strong>{service} workspace copy updated</strong></>} pill={<StatusPill status="done" label="Applied to workspace copy"/>}/>;
  if (run.status === 'running') return <Row {...props} text={`approved the patch for ${service}`} pill={<StatusPill status="working" label="Applying"/>}/>;
  if (run.status === 'failed') return <Row {...props} text={`approved the patch for ${service}, but applying it failed`} pill={<StatusPill status="failed" label="Failed"/>}/>;
  return <Row {...props} text={`approved the patch for ${service}`}/>;
}

// ---------- shared update + rollout ----------
const STAGE: Record<Stage, { status: Status; label: string }> = {
  pending: { status: 'idle', label: 'Not started' }, delivered: { status: 'idle', label: 'Not started' }, retrieved: { status: 'idle', label: 'Not started' },
  adapting: { status: 'working', label: 'Updating' }, patch_ready: { status: 'waiting', label: 'Needs your review' },
  applied: { status: 'done', label: 'Workspace copy updated' }, acknowledged: { status: 'done', label: 'Acknowledged' }, dismissed: { status: 'idle', label: 'Dismissed' },
  rejected: { status: 'failed', label: 'Patch rejected' }, failed: { status: 'failed', label: 'Failed' },
};
const STARTABLE = new Set<Stage>(['pending', 'delivered', 'retrieved', 'rejected', 'failed']);

function SharedItem({ event, run, ctx }: { event: FeedEvent; run?: RunSummary; ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  const n = event.receivers.length;
  const who = run?.decidedBy ? memberName(ctx, run.decidedBy) : event.publisher.label;
  const latest = ctx.newestByTopic.has(event.eventId);
  const live = (r: Receiver): Stage => {
    const run = ctx.runs.find(x => x.kind === 'adapter' && x.role === r.role && x.createdAt >= event.publishedAt);
    if (!run || !latest) return r.stage;
    if (run.status === 'applied') return 'applied';
    if (run.status === 'waiting') return 'patch_ready';
    if (run.status === 'running') return 'adapting';
    if (run.status === 'rejected') return 'rejected';
    if (run.status === 'failed') return 'failed';
    return r.stage;
  };
  const receivers = event.receivers.map(r => { const run = ctx.runs.find(x => x.kind === 'adapter' && x.role === r.role && x.createdAt >= event.publishedAt); return { ...r, stage: live(r), run: r.run ?? (run && latest ? { threadId: run.threadId, status: run.status, stopped: run.stopped } : undefined) }; });
  const inflight = (role?: string) => ctx.runs.some(r => r.kind === 'adapter' && r.role === role && (r.status === 'running' || r.status === 'waiting'));
  const enabled = (role?: string) => !!ctx.overview?.workspace.find(w => w.role === role)?.present;
  const startable = ctx.owner && ctx.serverUp && latest ? receivers.filter(r => r.role && STARTABLE.has(r.stage) && !inflight(r.role) && enabled(r.role)) : [];
  const updated = receivers.filter(r => r.stage === 'applied').length;
  const label = (r: Receiver) => r.stage === 'failed' && r.run?.stopped ? { status: 'idle' as Status, label: 'Stopped' } : r.stage === 'patch_ready' && !ctx.owner ? { status: 'waiting' as Status, label: 'Waiting for owner' } : STAGE[r.stage];
  const bullets = summaryBullets(event.content, event.tags);
  return <Row id={run ? `${anchor(run.threadId)}-shared` : undefined} avatar={run?.decidedBy ? <Avatar name={who}/> : <AgentAvatar/>} who={who} at={event.publishedAt} now={ctx.now}
    text={<>{run?.decidedBy ? 'approved and shared' : 'shared'} an update with {n} service{n === 1 ? '' : 's'}</>}>
    <div className="rv-card">
      <div className="rv-title"><strong>{packetTitle(event.title)}</strong>{event.breaking && <Badge tone="failed">Breaking</Badge>}</div>
      <ul className="rv-bullets">{bullets.slice(0, 3).map(b => <li key={b}>{b}</li>)}</ul>
      <div className="rv-foot"><Button variant="ghost" size="sm" icon={<FileText/>} onClick={() => setOpen(true)}>View full report</Button></div>
      <section className="rollout" aria-label="Rollout">
        <p className="subtle">Hosted patches update workspace copies. Download a patch to use it in your project.</p>
        <header><h3>Rollout</h3><span className="subtle">{n ? `${updated} of ${n} updated` : 'No services'}</span>
          {startable.length > 1 && <Button size="sm" variant="secondary" className="rollout-all" disabled={!!ctx.busy} onClick={() => ctx.onAdapt(startable.map(r => r.role!))}>{ctx.busy.startsWith('adapt:') ? 'Starting…' : 'Update all services'}</Button>}
        </header>
        {!n && <p className="subtle">No services were listening when this was shared.</p>}
        <ul>{receivers.map(r => { const s = label(r); const canStart = startable.includes(r);
          return <li key={r.key}>
            <span className="rollout-name">{r.label}</span>
            <StatusPill status={s.status} label={s.label}/>
            <span className="rollout-act">
              {canStart && <Button size="sm" variant="ghost" disabled={!!ctx.busy} onClick={() => ctx.onAdapt([r.role!])}>{r.stage === 'rejected' || r.stage === 'failed' ? 'Retry' : 'Update'}</Button>}
              {r.stage === 'patch_ready' && r.run && <Button size="sm" variant="ghost" onClick={() => document.getElementById(anchor(r.run!.threadId))?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Review</Button>}
            </span>
          </li>; })}</ul>
      </section>
    </div>
    {open && <ReportDrawer title={packetTitle(event.title)} content={event.content} breaking={event.breaking} tags={event.tags} onClose={() => setOpen(false)}/>}
  </Row>;
}

// ---------- composer ----------
function Composer({ room, spaceId, recipient, setRecipient, onSent, hidden }: { room: Room; spaceId: string; recipient: string; setRecipient: (id: string) => void; onSent: () => Promise<void>; hidden: Set<string> }) {
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sendKey = useRef<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  // Workspace agents (analyst, adapters) run on the agent server and never read group messages.
  const agents = room.agents.filter(a => a.canReply && !hidden.has(a.agentId));
  const target = agents.find(a => a.agentId === recipient);
  useEffect(() => { if (recipient) input.current?.focus(); }, [recipient]);
  useLayoutEffect(() => { const el = input.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; } }, [content]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (busy || !content.trim()) return;
    const sent = content;
    setBusy(true); setError('');
    sendKey.current ??= crypto.randomUUID();
    try {
      await operate('post', { spaceId, post: { content: sent, idempotencyKey: sendKey.current, ...(recipient ? { targetAgentId: recipient } : {}) } });
      sendKey.current = null; setContent(current => current === sent ? '' : current); await onSent();
    } catch (e) { setError(errorText(e, 'Message not sent. Try again.')); }
    finally { setBusy(false); input.current?.focus(); }
  }
  function key(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
  }
  if (!room.canPublish) return <div className="activity-composer"><p className="subtle">You can read this group but not post.</p></div>;
  return <form className="activity-composer" onSubmit={send}>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className={`composer-box ${target ? 'to-agent' : ''}`}>
      <label className="sr-only" htmlFor="composer-input">Message</label>
      <textarea id="composer-input" ref={input} rows={1} value={content} maxLength={8000}
        placeholder={target ? `Ask ${target.name}…` : `Message ${room.space.name}`}
        onChange={e => { setContent(e.target.value); sendKey.current = null; }} onKeyDown={key}/>
      <div className="composer-footer">
        {agents.length > 0 && <label className="composer-to">To
          <select value={recipient} onChange={e => { setRecipient(e.target.value); sendKey.current = null; }} aria-label="Send to">
            <option value="">People</option>
            {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name} ({a.receiverState === 'listening' || a.receiverState === 'responding' ? 'online' : 'receiver offline'})</option>)}
          </select>
        </label>}
        {target && <span className="composer-hint">{['listening','responding'].includes(target.receiverState) ? `${target.name} replies automatically.` : `Ask ${target.ownerName} to start this agent’s receiver from Members.`}</span>}
        <Button type="submit" variant="ghost" size="sm" iconOnly className="composer-send" icon={<Send/>} aria-label="Send" disabled={busy || !content.trim()}/>
      </div>
    </div>
  </form>;
}
