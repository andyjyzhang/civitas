'use client';

// Group chat: message stream + composer, slim right rail (members, agents, agent activity, invite).
import Link from 'next/link';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Room } from '@civitas/contracts';
import { MessageSquare, PanelRight, Search, Send, UserPlus, Users, X } from 'lucide-react';
import { useShell } from '../components/app-shell';
import ConnectAgent from '../components/connect-agent';
import { AgentBadge, Avatar, Badge, Button, Card, EmptyState, InfoTip, StatusPill, type Status } from '../components/ui';
import { clock, dayLabel, errorText, InviteDialog, operate, timeAgo, useRoom } from '../components/rooms';

type Post = Room['posts'][number];
type RoomAgent = Room['agents'][number];
type Run = { threadId: string; kind: 'analyst' | 'adapter'; role?: string; goal?: string; status: string; updatedAt: string; createdAt: string };

const RUN_STATUS: Record<string, { status: Status; label: string }> = {
  running: { status: 'working', label: 'Running' }, waiting: { status: 'waiting', label: 'Needs review' },
  published: { status: 'done', label: 'Published' }, applied: { status: 'done', label: 'Applied' }, completed: { status: 'done', label: 'Completed' },
  rejected: { status: 'failed', label: 'Rejected' }, failed: { status: 'failed', label: 'Failed' },
};
const GROUP_GAP_MS = 5 * 60 * 1000;

export default function GroupChat() {
  const shell = useShell();
  const { spaceId, space } = shell;
  const { room, error, loading, reload } = useRoom(spaceId, 'group');
  const [railOpen, setRailOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [search, setSearch] = useState('');
  const [recipient, setRecipient] = useState('');

  useEffect(() => {
    if (recipient && room && !room.agents.some(a => a.agentId === recipient && a.canReply)) setRecipient('');
  }, [room, recipient]);

  if (!spaceId) return <div className="page"><EmptyState icon={<MessageSquare/>} title="Start a group" description="A private space where your people and their coding agents share context." action={<div className="page-actions"><Button variant="primary" onClick={() => shell.openDialog('create')}>Create group</Button><Button onClick={() => shell.openDialog('accept')}>Accept invitation</Button></div>}/></div>;

  const owner = room?.space.role === 'owner';
  const name = room?.space.name || space?.name || 'Group';
  return <div className="chat" data-rail-open={railOpen}>
    <section className="chat-main" aria-label={`${name} conversation`}>
      <header className="chat-header">
        <div className="chat-title">
          <h1>{name}</h1>
          {room && <span className="chat-count">{room.members.length} {room.members.length === 1 ? 'member' : 'members'}</span>}
          <InfoTip text="Only this group can read messages. Messages sent to an agent go to its private MCP inbox; inactive sessions are not woken automatically. Shows the latest 100 messages."/>
        </div>
        <div className="chat-header-actions">
          <label className="chat-search"><Search aria-hidden="true"/><span className="sr-only">Search messages</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"/></label>
          <ConnectAgent key={spaceId} spaceId={spaceId} onLinked={reload} size="sm"/>
          <Button className="rail-toggle" size="sm" iconOnly variant="ghost" icon={<PanelRight/>} aria-label="Show members and agents" aria-expanded={railOpen} onClick={() => setRailOpen(o => !o)}/>
        </div>
      </header>
      {error && <div className="chat-alert"><div className="alert" role="alert">{error}</div></div>}
      {room ? <>
        <MessageStream room={room} search={search} onAsk={setRecipient}/>
        <Composer room={room} spaceId={spaceId} recipient={recipient} setRecipient={setRecipient} onSent={reload}/>
      </> : <p className="app-loading">{loading ? 'Loading messages…' : ''}</p>}
    </section>
    <aside className="chat-rail" aria-label="Members and agents">
      <div className="rail-head"><h2>Details</h2><Button size="sm" variant="ghost" iconOnly icon={<X/>} aria-label="Close details" onClick={() => setRailOpen(false)}/></div>
      {room && <Rail room={room} spaceId={spaceId} owner={owner} onAsk={id => { setRecipient(id); setRailOpen(false); }} onInvite={() => setInviting(true)}/>}
    </aside>
    {railOpen && <button type="button" className="rail-scrim" aria-label="Close details" tabIndex={-1} onClick={() => setRailOpen(false)}/>}
    {inviting && room && <InviteDialog spaceId={spaceId} spaceName={name} onClose={() => setInviting(false)}/>}
  </div>;
}

function MessageStream({ room, search, onAsk }: { room: Room; search: string; onAsk: (agentId: string) => void }) {
  const stream = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const needle = search.trim().toLowerCase();
  const posts = useMemo(() => needle ? room.posts.filter(p => `${p.content} ${p.authorName} ${p.targetAgentName || ''}`.toLowerCase().includes(needle)) : room.posts, [room.posts, needle]);
  const byId = useMemo(() => new Map(room.posts.map(p => [p.postId, p])), [room.posts]);
  const replyable = new Set(room.agents.filter(a => a.canReply).map(a => a.agentId));
  const last = posts[posts.length - 1]?.postId;
  useLayoutEffect(() => { const el = stream.current; if (el && nearBottom.current) el.scrollTop = el.scrollHeight; }, [last, posts.length]);

  return <div className="chat-stream" ref={stream} role="log" aria-label="Messages" aria-live="polite" tabIndex={0}
    onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
    {!posts.length && <div className="chat-empty">{needle ? <EmptyState title="No matches" description={`No messages match “${search}”.`}/> : <EmptyState icon={<MessageSquare/>} title="No messages yet" description="Say hello, share a decision, or ask a connected agent."/>}</div>}
    {posts.map((post, i) => {
      const prev = posts[i - 1];
      const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(post.createdAt).toDateString();
      const continued = !newDay && !!prev && prev.authorId === post.authorId && prev.origin === post.origin && !post.targetAgentId && !prev.targetAgentId && !post.replyTo && Date.parse(post.createdAt) - Date.parse(prev.createdAt) < GROUP_GAP_MS;
      const agent = post.origin === 'agent';
      const own = post.authorId === room.currentAccountId;
      const parent = post.replyTo ? byId.get(post.replyTo) : undefined;
      return <Fragment key={post.postId}>
        {newDay && <div className="day-divider" role="separator"><span>{dayLabel(post.createdAt)}</span></div>}
        <article className={`msg ${continued ? 'continued' : ''} ${agent ? 'from-agent' : ''}`}>
          <div className="msg-gutter">{continued ? <time className="msg-hover-time" dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time> : <Avatar name={post.authorName}/>}</div>
          <div className="msg-body">
            {!continued && <div className="msg-meta">
              <strong>{post.authorName}</strong>{agent && <AgentBadge/>}{own && <span className="subtle">(you)</span>}
              {post.targetAgentName && <span className="msg-target">→ {post.targetAgentName}</span>}
              <time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString()}>{clock(post.createdAt)}</time>
              {post.targetAgentId && <Delivery post={post}/>}
            </div>}
            {parent && <div className="msg-reply-to">Replying to <strong>{parent.authorName}</strong>: <span>{parent.content}</span></div>}
            <p className="msg-text">{post.content}</p>
            {agent && replyable.has(post.authorId) && <button type="button" className="msg-action" onClick={() => onAsk(post.authorId)}>Reply to agent</button>}
          </div>
        </article>
      </Fragment>;
    })}
  </div>;
}

function Delivery({ post }: { post: Post }) {
  if (post.repliedAt) return <StatusPill status="done" label="Replied"/>;
  if (post.retrievedAt) return <span title={`Retrieved ${timeAgo(post.retrievedAt)}; awaiting reply`}><StatusPill status="working" label="Retrieved"/></span>;
  return <span title="Waiting for an active agent session to fetch it"><StatusPill status="idle" label="Queued"/></span>;
}

function Composer({ room, spaceId, recipient, setRecipient, onSent }: { room: Room; spaceId: string; recipient: string; setRecipient: (id: string) => void; onSent: () => Promise<void> }) {
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sendKey = useRef<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const agents = room.agents.filter(a => a.canReply);
  const target = agents.find(a => a.agentId === recipient);
  useEffect(() => { if (recipient) input.current?.focus(); }, [recipient]);
  useLayoutEffect(() => { const el = input.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; } }, [content]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (busy || !content.trim()) return;
    setBusy(true); setError('');
    sendKey.current ??= crypto.randomUUID();
    try {
      await operate('post', { spaceId, post: { content, idempotencyKey: sendKey.current, ...(recipient ? { targetAgentId: recipient } : {}) } });
      sendKey.current = null; setContent(''); await onSent();
    } catch (e) { setError(errorText(e, 'Message not sent. Try again.')); }
    finally { setBusy(false); input.current?.focus(); }
  }
  function key(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
  }
  if (!room.canPublish) return <div className="composer"><p className="subtle">You can read this group but not post.</p></div>;
  return <form className="composer" onSubmit={send}>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className={`composer-box ${target ? 'to-agent' : ''}`}>
      <label className="sr-only" htmlFor="composer-input">Message</label>
      <textarea id="composer-input" ref={input} rows={1} value={content} maxLength={8000} disabled={busy && !content}
        placeholder={target ? `Ask ${target.name}…` : `Message ${room.space.name}`}
        onChange={e => { setContent(e.target.value); sendKey.current = null; }} onKeyDown={key}/>
      <div className="composer-footer">
        <label className="composer-to">To
          <select value={recipient} onChange={e => { setRecipient(e.target.value); sendKey.current = null; }} aria-label="Send to">
            <option value="">Everyone</option>
            {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name} · agent ({a.ownerName})</option>)}
          </select>
        </label>
        {target && <InfoTip text={`Only this message is shared with ${target.name}. It waits in the agent's inbox until its coding session fetches it.`}/>}
        <span className="composer-hint">Enter to send · Shift+Enter for a new line</span>
        <Button type="submit" variant="primary" size="sm" icon={<Send/>} disabled={busy || !content.trim()}>{busy ? 'Sending…' : 'Send'}</Button>
      </div>
    </div>
  </form>;
}

function Rail({ room, spaceId, owner, onAsk, onInvite }: { room: Room; spaceId: string; owner: boolean; onAsk: (id: string) => void; onInvite: () => void }) {
  const q = `?space=${encodeURIComponent(spaceId)}`;
  return <>
    <AgentActivity spaceId={spaceId}/>
    <Card title={`Members · ${room.members.length}`} padded={false} actions={owner ? <Button size="sm" icon={<UserPlus/>} onClick={onInvite}>Invite</Button> : undefined}>
      <ul className="list">
        {room.members.map(m => <li key={m.accountId} className="list-row"><Avatar name={m.name} small/><span className="row-main">{m.name}{m.accountId === room.currentAccountId && <span className="subtle"> (you)</span>}</span>{m.role === 'owner' && <Badge>Owner</Badge>}</li>)}
      </ul>
    </Card>
    <Card title={<>Agents · {room.agents.length} <InfoTip text="Coding agents connected to this group. Use Connect agent above to add yours."/></>} padded={false}>
      {room.agents.length ? <ul className="list">
        {room.agents.map(a => <AgentRow key={a.agentId} agent={a} onAsk={onAsk}/>)}
      </ul> : <div className="card-body"><p className="subtle">No agents yet.</p></div>}
    </Card>
    <Button variant="ghost" size="sm" icon={<Users/>} href={`/members${q}`}>Manage members & access</Button>
  </>;
}

function AgentRow({ agent, onAsk }: { agent: RoomAgent; onAsk: (id: string) => void }) {
  const recent = agent.lastSeenAt && Date.now() - Date.parse(agent.lastSeenAt) < 15 * 60 * 1000;
  const status: Status = !agent.canReply ? 'idle' : recent ? 'done' : agent.lastSeenAt ? 'idle' : 'waiting';
  const label = !agent.canReply ? 'Read only' : agent.lastSeenAt ? `Last MCP contact ${timeAgo(agent.lastSeenAt)}` : 'Awaiting setup';
  return <li className="list-row rail-agent">
    <Avatar name={agent.name} small/>
    <span className="row-main"><span>{agent.name} <AgentBadge/></span><small className="subtle">{agent.ownerName} · {agent.provider}</small><StatusPill status={status} label={label}/></span>
    {agent.canReply && <Button size="sm" variant="ghost" onClick={() => onAsk(agent.agentId)} aria-label={`Ask ${agent.name}`}>Ask</Button>}
  </li>;
}

function AgentActivity({ spaceId }: { spaceId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const response = await fetch(`/api/agents?space=${encodeURIComponent(spaceId)}`, { cache: 'no-store' });
        if (!response.ok) { if (live) setRuns([]); return; }
        const data = await response.json();
        if (live) setRuns(data.agentServer?.up && Array.isArray(data.runs) ? data.runs.slice(0, 4) : []);
      } catch { if (live) setRuns([]); }
    }
    void load(); const timer = setInterval(() => void load(), 20000);
    return () => { live = false; clearInterval(timer); };
  }, [spaceId]);
  if (!runs.length) return null;
  const q = `space=${encodeURIComponent(spaceId)}`;
  return <Card title="Agent activity" padded={false} actions={<Button size="sm" variant="ghost" href={`/agents?${q}`}>View all</Button>}>
    <ul className="list">
      {runs.map(run => { const s = RUN_STATUS[run.status] || { status: 'idle' as Status, label: run.status };
        return <li key={run.threadId}><Link href={`/agents?${q}&run=${encodeURIComponent(run.threadId)}`} className="list-row run-row">
          <span className="row-main"><span>{run.kind === 'analyst' ? 'Change analysis' : `Adapter${run.role ? ` · ${run.role}` : ''}`}</span>{run.goal && <small className="subtle">{run.goal}</small>}<time dateTime={run.updatedAt}>{timeAgo(run.updatedAt)}</time></span>
          <StatusPill status={s.status} label={s.label}/>
        </Link></li>; })}
    </ul>
  </Card>;
}
