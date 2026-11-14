'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { AccountOverview, Room } from '@civitas/contracts';
import WorkspaceNav from './workspace-nav';

type Kind = 'group' | 'server';
type Directory = { spaceId: string; name: string; joined: boolean }[];
async function read<T>(query = ''): Promise<T> {
  const response = await fetch('/api/account' + query, { cache: 'no-store' });
  if (response.status === 401) { window.location.assign('/'); throw new Error('Please sign in.'); }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load your workspace.');
  return data;
}
async function operate(operation: string, input: unknown = {}) {
  const response = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, input }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not complete this action.');
  return data;
}
const clock = (value: string) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Rooms({ kind }: { kind: Kind }) {
  const group = kind === 'group';
  const noun = group ? 'group chat' : 'server';
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [selected, setSelected] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'create' | 'discover' | 'accept' | null>(null);
  const [directory, setDirectory] = useState<Directory>([]);
  const [invite, setInvite] = useState('');
  const [topic, setTopic] = useState('');
  const [search, setSearch] = useState('');
  const [content, setContent] = useState('');
  const stream = useRef<HTMLDivElement>(null);
  const requestNumber = useRef(0);
  const spaces = overview?.spaces.filter(space => space.kind === kind) || [];
  const loadOverview = useCallback(async () => {
    const result = await read<AccountOverview>();
    setOverview(result);
    setSelected(previous => {
      const desired = previous || new URLSearchParams(window.location.search).get('space');
      return result.spaces.find(s => s.kind === kind && s.spaceId === desired)?.spaceId || result.spaces.find(s => s.kind === kind)?.spaceId || '';
    });
    return result;
  }, [kind]);
  useEffect(() => { void loadOverview().catch(e => setError(e.message)).finally(() => setLoading(false)); }, [loadOverview]);
  const loadRoom = useCallback(async () => {
    if (!selected) return;
    const number = ++requestNumber.current;
    try {
      const result = await read<Room>('?room=' + encodeURIComponent(selected));
      if (number !== requestNumber.current) return;
      if (result.space.kind !== kind) throw new Error('This space belongs in the other workspace.');
      setRoom(result); setError('');
    } catch (e) { if (number === requestNumber.current) { setRoom(null); setError(e instanceof Error ? e.message : 'Could not load this room.'); } }
  }, [selected, kind]);
  useEffect(() => {
    setRoom(null); setInvite(''); setTopic(''); setContent(''); setSearch('');
    if (!selected) return;
    window.history.replaceState(null, '', `${group ? '/groups' : '/servers'}?space=${encodeURIComponent(selected)}`);
    void loadRoom(); const timer = setInterval(() => void loadRoom(), 4000);
    return () => { clearInterval(timer); requestNumber.current++; };
  }, [selected, group, loadRoom]);
  useEffect(() => { if (group && stream.current) stream.current.scrollTop = stream.current.scrollHeight; }, [group, room?.posts.length]);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>, work: (fields: FormData, form: HTMLFormElement) => Promise<void>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget; const fields = new FormData(form);
    void action(() => work(fields, form));
  }
  async function discover() {
    await action(async () => { setDirectory(await read<Directory>('?directory=1')); setDialog('discover'); });
  }
  const topics = [...new Set(room?.posts.map(p => p.topic).filter((v): v is string => Boolean(v)))];
  const posts = (room?.posts || []).filter(p => (!topic || p.topic === topic) && `${p.title || ''} ${p.content} ${p.authorName}`.toLowerCase().includes(search.toLowerCase()));
  const visiblePosts = group ? posts : [...posts].reverse();

  return <div className="shell collaboration-shell">
    <WorkspaceNav active={group ? 'groups' : 'servers'}/>
    <main>
      <header className="topbar"><span>{group ? 'Group chats' : 'Servers'} <span className="slash">/</span> {room?.space.name || 'Your workspace'}</span><div className="room-account">{overview?.account.name}<button className="text-button" onClick={() => void action(async () => { await operate('logout'); window.location.assign('/'); })}>Sign out</button></div></header>
      <div className="rooms-layout">
        <aside className="room-list-panel" aria-label={group ? 'Your group chats' : 'Your servers'}>
          <div className="room-list-heading"><h1>{group ? 'Group chats' : 'Servers'}</h1><button className="room-add" aria-label={`Create ${noun}`} onClick={() => setDialog('create')}>＋</button></div>
          <p className="room-description">{group ? 'Build with your people.' : 'Knowledge worth passing on.'}</p>
          <div className="room-list">{spaces.map(space => <button className={`room-select ${selected === space.spaceId ? 'selected' : ''}`} key={space.spaceId} onClick={() => setSelected(space.spaceId)}><span className="room-symbol">{group ? '↔' : '◎'}</span><span>{space.name}<small>{group ? 'Private project' : space.visibility === 'public' ? 'Public community' : 'Private community'}</small></span></button>)}
          {!loading && !spaces.length && <p className="muted">No {group ? 'group chats' : 'servers'} yet.</p>}</div>
          <div className="room-list-actions"><button className="secondary full" onClick={() => setDialog('create')}>Create {noun}</button>{!group && <button className="text-button" disabled={busy} onClick={discover}>Discover public servers ↗</button>}<button className="text-button" onClick={() => setDialog('accept')}>Accept an invitation</button></div>
        </aside>
        <section className="room-workspace" aria-label={group ? 'Project conversation' : 'Knowledge feed'}>
          {error && <div className="alert" role="alert">{error}</div>}
          {!room ? <div className="room-empty"><span aria-hidden="true">{group ? '↔' : '◎'}</span><h2>{loading || selected && !error ? 'Opening your workspace…' : group ? 'Start something together.' : 'Find your next discovery.'}</h2><p>{group ? 'Create a private group for your friends or coworkers. Share decisions, ask questions, and keep project context together.' : 'Join a community to follow source-linked knowledge, research, and updates from approved publishers.'}</p><button className="primary" onClick={() => group ? setDialog('create') : void discover()}>{group ? 'Create a group chat' : 'Discover servers'}</button></div> : <>
            <header className="room-header"><div><h2>{room.space.name}</h2><p>{group ? 'Private project conversation' : 'Knowledge feed'} · {room.members.length} {group ? 'members' : 'subscribers'}</p></div><span className="room-badge">{group ? 'Invite only' : room.space.visibility === 'public' ? 'Public' : 'Private'}</span></header>
            <div className="room-toolbar"><label className="room-search"><span className="sr-only">Search {group ? 'messages' : 'knowledge'}</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder={group ? 'Search this conversation…' : 'Search knowledge…'}/></label>{!group && <label><span className="sr-only">Filter by topic</span><select value={topic} onChange={e => setTopic(e.target.value)}><option value="">All topics</option>{topics.map(t => <option key={t}>{t}</option>)}</select></label>}</div>
            <div className={`room-stream ${group ? 'conversation' : 'knowledge-feed'}`} ref={stream} role="region" aria-label={group ? 'Messages' : 'Knowledge posts'} tabIndex={0}>
              {!visiblePosts.length && <div className="room-stream-empty"><h3>{search || topic ? 'Nothing matches yet.' : group ? 'Your conversation starts here.' : 'No discoveries published yet.'}</h3><p>{search || topic ? 'Try another search or topic.' : group ? 'Share a project decision or ask your teammates a question.' : 'Approved publishers can share a source-linked discovery below.'}</p></div>}
              {visiblePosts.map(post => <article className={`room-post ${post.authorId === room.currentAccountId ? 'own-post' : ''}`} key={post.postId}><div className="room-post-meta"><span className="avatar small">{post.authorName[0]?.toUpperCase()}</span><strong>{post.authorName}{post.origin === 'agent' ? ' · agent' : ''}</strong><time dateTime={post.createdAt}>{clock(post.createdAt)}</time></div>{post.topic && <span className="topic">{post.topic}</span>}{post.title && <h3>{post.title}</h3>}<p>{post.content}</p>{post.source && <div className="room-source">↗ {post.source.uri} <span>@ {post.source.revision}</span></div>}</article>)}
            </div>
            <div className="room-composer">{room.canPublish ? <form key={selected} onSubmit={event => submit(event, async (fields, form) => {
              await operate('post', { spaceId: selected, post: { content: fields.get('content'), ...(!group ? { title: fields.get('title'), topic: fields.get('topic'), source: { uri: fields.get('source'), revision: fields.get('revision') } } : {}) } });
              setContent(''); form.reset(); await loadRoom();
            })}>{!group && <><div className="form-grid"><label>Title<input name="title" maxLength={200} required placeholder="What did you learn?"/></label><label>Topic<input name="topic" required placeholder="research/agents" maxLength={128}/></label></div><div className="form-grid"><label>Source reference<input name="source" maxLength={2048} required placeholder="https://…"/></label><label>Source revision<input name="revision" maxLength={256} required placeholder="Version or date"/></label></div></>}<label><span className="sr-only">{group ? 'Message' : 'Knowledge content'}</span><textarea name="content" value={content} onChange={e => setContent(e.target.value)} maxLength={8000} required rows={group ? 2 : 3} placeholder={group ? `Message ${room.space.name}…` : 'Explain the finding and why it matters…'} onKeyDown={e => { if (group && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}/></label><div className="composer-footer"><small>{group ? 'Only this group can read messages. Enter to send; Shift+Enter for a new line.' : 'Share selected knowledge. Publishing here does not copy private group history.'}</small><button className="primary" disabled={busy || !content.trim()}>{busy ? 'Sending…' : group ? 'Send message' : 'Publish knowledge'}</button></div></form> : <p className="muted">You’re subscribed to this server. The owner can grant publishing access.</p>}</div>
          </>}
        </section>
        <aside className="room-details" aria-label="Members and access">
          {room ? <><h2>{group ? 'Your collaborators' : 'Community'}</h2><p className="muted">{group ? 'People working on this project.' : 'Knowledge from approved publishers.'}</p>{room.members.map(member => <div className="room-member" key={member.accountId}><span className="avatar small">{member.name[0]?.toUpperCase()}</span><div><strong>{member.name}{member.accountId === room.currentAccountId ? ' · you' : ''}</strong><small>{member.role === 'owner' ? 'Owner' : group ? 'Collaborator' : member.canPublish ? 'Publisher' : 'Subscriber'}</small>{!group && room.space.role === 'owner' && member.role !== 'owner' && <button className="text-button" disabled={busy} onClick={() => void action(async () => { await operate('setPublisher', { spaceId: selected, accountId: member.accountId, canPublish: !member.canPublish }); await loadRoom(); })}>{member.canPublish ? 'Remove publishing access' : 'Allow publishing'}</button>}</div></div>)}{room.space.role === 'owner' && <form className="room-invite" onSubmit={event => submit(event, async fields => { const result = await operate('invite', { spaceId: selected, email: fields.get('email') }); setInvite(result.token); })}><h3>{group ? 'Invite a teammate' : 'Invite a subscriber'}</h3><label>Email<input name="email" type="email" required placeholder="friend@example.com"/></label><button className="secondary full" disabled={busy}>Create invitation</button></form>}{invite && <div className="room-invite-result"><p>Share this token privately. Your friend accepts it using the same email. No email is sent.</p><input aria-label="Invitation token" value={invite} readOnly/><button className="text-button" onClick={() => void navigator.clipboard.writeText(invite).catch(() => setError('Select and copy the invitation token manually.'))}>Copy invitation</button></div>}<div className="room-detail-links"><a href="/settings">Connect agents & manage access ↗</a><a href="/relay">Agent context activity ↗</a></div><small className="muted">Explicitly published agent context appears here too. Human posts do not automatically run agents or enter their inboxes. Latest 100 posts.</small></> : <><h2>{group ? 'Project collaboration' : 'Knowledge sharing'}</h2><p className="muted">{group ? 'Invite the people you build with. Your conversations stay private.' : 'Follow public communities or accept a private server invitation.'}</p></>}
        </aside>
      </div>
    </main>
    {dialog && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="room-dialog-title"><div className="section-heading"><h2 id="room-dialog-title">{dialog === 'create' ? `Create ${noun}` : dialog === 'discover' ? 'Discover servers' : 'Accept invitation'}</h2><button className="close" aria-label="Close dialog" onClick={() => setDialog(null)}>×</button></div>
      {dialog === 'create' && <form onSubmit={event => submit(event, async fields => { const created = await operate('createSpace', { name: fields.get('name'), kind, visibility: group ? 'private' : fields.get('visibility') }); await loadOverview(); setSelected(created.spaceId); setDialog(null); })}><p className="muted">{group ? 'A private place for friends and coworkers to build together.' : 'A community feed for discoveries, research, and useful updates.'}</p><label>Name<input name="name" required maxLength={100} autoFocus placeholder={group ? 'Weekend builders' : 'Agent research'}/></label>{!group && <label>Visibility<select name="visibility"><option value="public">Public — discoverable to signed-in users</option><option value="private">Private — invitation only</option></select></label>}<button className="primary full" disabled={busy}>Create {noun}</button></form>}
      {dialog === 'accept' && <form onSubmit={event => submit(event, async fields => { const accepted = await operate('acceptInvite', { token: fields.get('token') }); if (accepted.kind !== kind) { window.location.assign(`${accepted.kind === 'server' ? '/servers' : '/groups'}?space=${encodeURIComponent(accepted.spaceId)}`); return; } await loadOverview(); setSelected(accepted.spaceId); setDialog(null); })}><p className="muted">Use the invitation shared with your account’s email address.</p><label>Invitation token<input name="token" required autoComplete="off" autoFocus/></label><button className="primary full" disabled={busy}>Accept invitation</button></form>}
      {dialog === 'discover' && <div className="server-directory">{directory.length ? directory.map(server => <article key={server.spaceId}><span className="room-symbol">◎</span><div><h3>{server.name}</h3><small>Public knowledge community</small></div><button className="secondary" disabled={busy} onClick={() => void action(async () => { if (!server.joined) await operate('joinServer', { spaceId: server.spaceId }); await loadOverview(); setSelected(server.spaceId); setDialog(null); })}>{server.joined ? 'Open' : 'Subscribe'}</button></article>) : <p className="muted">No public servers yet. Create one to start sharing knowledge.</p>}</div>}
      {error && <p className="alert" role="alert">{error}</p>}
    </section></div>}
  </div>;
}
