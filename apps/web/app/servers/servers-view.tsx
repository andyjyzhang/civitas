'use client';

// Explore servers: your servers + public directory; ?space= opens one server's knowledge feed.
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Room } from '@civitas/contracts';
import { ArrowLeft, Bot, Compass, ExternalLink, Plus, UserPlus } from 'lucide-react';
import { useShell } from '../components/app-shell';
import { AgentBadge, Avatar, Badge, Button, Card, CopyId, EmptyState, InfoTip, Page, PageHeader } from '../components/ui';
import { clock, Dialog, errorText, InviteDialog, operate, read, Switch, useRoom } from '../components/rooms';

type Directory = { spaceId: string; name: string; joined: boolean }[];

export default function ServersView() {
  const params = useSearchParams();
  const selected = params.get('space') || '';
  return selected ? <ServerFeed key={selected} spaceId={selected}/> : <ServerDirectory/>;
}

function ServerDirectory() {
  const shell = useShell();
  const router = useRouter();
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [creating, setCreating] = useState(false);
  const mine = shell.overview?.spaces.filter(s => s.kind === 'server') ?? [];
  const load = useCallback(async () => { try { setDirectory(await read<Directory>('?directory=1')); } catch (e) { setError(errorText(e)); setDirectory([]); } }, []);
  useEffect(() => { void load(); }, [load]);
  const open = (id: string) => router.push(`/servers?space=${encodeURIComponent(id)}`);
  async function join(id: string) {
    setBusy(id); setError('');
    try { await operate('joinServer', { spaceId: id }); await shell.refresh(); open(id); }
    catch (e) { setError(errorText(e, 'Could not join this server.')); setBusy(''); }
  }
  const discover = (directory ?? []).filter(s => !mine.some(m => m.spaceId === s.spaceId));

  return <Page className="servers-page">
    <PageHeader title="Explore servers" description="Communities that share source-linked knowledge."
      actions={<><Button variant="ghost" onClick={() => shell.openDialog('accept')}>Accept invitation</Button><Button icon={<Plus/>} onClick={() => setCreating(true)}>Create server</Button></>}/>
    {error && <div className="alert" role="alert">{error}</div>}
    {mine.length > 0 && <Card title="Your servers" padded={false}>
      <ul className="list">{mine.map(s => <li key={s.spaceId} className="list-row server-row">
        <span className="server-mark" aria-hidden="true">{s.name.trim()[0]?.toUpperCase() || '·'}</span>
        <span className="server-name"><strong>{s.name}</strong><small>{s.role === 'owner' ? 'Owner' : 'Subscriber'}</small></span>
        <Badge>{s.visibility === 'public' ? 'Public' : 'Private'}</Badge>
        <Button size="sm" href={`/servers?space=${encodeURIComponent(s.spaceId)}`}>Open</Button>
      </li>)}</ul>
    </Card>}
    <section className="server-section" aria-labelledby="directory-title">
      <h2 id="directory-title" className="section-title">Public directory</h2>
      {directory === null ? <p className="muted">Loading servers…</p> : discover.length ? <div className="server-grid">
        {discover.map(s => <article key={s.spaceId} className="card server-card">
          <span className="server-mark" aria-hidden="true">{s.name.trim()[0]?.toUpperCase() || '·'}</span>
          <div><h3>{s.name}</h3><p>Public knowledge community</p></div>
          <Button size="sm" disabled={busy === s.spaceId} onClick={() => void join(s.spaceId)}>{busy === s.spaceId ? 'Joining…' : 'Join'}</Button>
        </article>)}
      </div> : <EmptyState icon={<Compass/>} title={mine.length ? 'You’ve joined every public server' : 'No public servers yet'} description="Start one to share discoveries and research with other builders." action={<Button variant="primary" icon={<Plus/>} onClick={() => setCreating(true)}>Create server</Button>}/>}
    </section>
    {creating && <CreateServerDialog onClose={() => setCreating(false)} onCreated={async id => { await shell.refresh(); open(id); }}/>}
  </Page>;
}

function CreateServerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget); setBusy(true); setError('');
    try { const created = await operate<{ spaceId: string }>('createSpace', { name: fields.get('name'), kind: 'server', visibility: fields.get('visibility') }); await onCreated(created.spaceId); }
    catch (e) { setError(errorText(e, 'Could not create the server.')); setBusy(false); }
  }
  return <Dialog title="Create server" description="A feed for discoveries, research and useful updates." onClose={onClose} closeDisabled={busy}>
    <form onSubmit={submit}>
      <label>Name<input name="name" required maxLength={100} autoFocus placeholder="Agent research"/></label>
      <label>Visibility<select name="visibility" defaultValue="public"><option value="public">Public · anyone signed in can find it</option><option value="private">Private · invitation only</option></select></label>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="dialog-actions"><Button onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create server'}</Button></div>
    </form>
  </Dialog>;
}

function ServerFeed({ spaceId }: { spaceId: string }) {
  const { room, error, loading, reload } = useRoom(spaceId, 'server');
  const [publishing, setPublishing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const owner = room?.space.role === 'owner';
  const back = <Link href="/servers" className="back-link"><ArrowLeft aria-hidden="true"/>All servers</Link>;
  if (!room) return <Page>{back}{error ? <EmptyState icon={<Compass/>} title="Server unavailable" description={error} action={<Button href="/servers">Browse servers</Button>}/> : <p className="muted">{loading ? 'Loading server…' : ''}</p>}</Page>;

  async function togglePublisher(accountId: string, canPublish: boolean) {
    setBusy(accountId); setActionError('');
    try { await operate('setPublisher', { spaceId, accountId, canPublish }); await reload(); }
    catch (e) { setActionError(errorText(e, 'Could not change publishing access.')); }
    finally { setBusy(''); }
  }
  const posts = [...room.posts].reverse();
  return <Page className="servers-page">
    {back}
    <PageHeader title={<span className="title-with-badge">{room.space.name}<Badge>{room.space.visibility === 'public' ? 'Public' : 'Private'}</Badge></span>}
      description={`${room.members.length} ${room.members.length === 1 ? 'subscriber' : 'subscribers'} · knowledge from approved publishers`}
      actions={<>{owner && <Button icon={<UserPlus/>} onClick={() => setInviting(true)}>Invite</Button>}{room.canPublish && <Button variant="primary" icon={<Plus/>} onClick={() => setPublishing(true)}>Publish</Button>}</>}/>
    {actionError && <div className="alert" role="alert">{actionError}</div>}
    <div className="server-layout">
      <section className="server-feed" aria-label="Knowledge posts">
        {posts.length ? posts.map(post => <article key={post.postId} className="card knowledge-post">
          <header>
            {post.origin === 'agent' ? <span className="avatar small agent" aria-hidden="true"><Bot/></span> : <Avatar name={post.authorName} small/>}
            <strong>{post.origin === 'agent' && post.authorName.startsWith('ag_') ? 'Agent' : post.authorName}</strong>
            {post.origin === 'agent' && <AgentBadge/>}
            {post.origin === 'agent' && post.authorName.startsWith('ag_') && <CopyId id={post.authorName}/>}
            <time dateTime={post.createdAt}>{clock(post.createdAt)}</time>
          </header>
          {post.title && <h3>{post.title}</h3>}
          <p className="knowledge-text">{post.content}</p>
          <footer>
            {post.topic && <Badge mono>{post.topic}</Badge>}
            {post.source && <span className="knowledge-source" title={`${post.source.uri} @ ${post.source.revision}`}><ExternalLink aria-hidden="true"/><span className="mono">{post.source.uri}</span><span className="subtle">@ {post.source.revision}</span></span>}
          </footer>
        </article>) : <EmptyState title="No posts yet" description={room.canPublish ? 'Publish the first source-linked discovery.' : 'Approved publishers haven’t shared anything yet.'}/>}
      </section>
      <aside className="card server-members" aria-label="Subscribers">
        <header className="card-header"><div><h2>Subscribers</h2></div>{owner && <InfoTip text="Turn on publishing to let a subscriber post to this server."/>}</header>
        <ul className="list">{room.members.map(m => <li key={m.accountId} className="list-row">
          <Avatar name={m.name} small/>
          <span className="server-name"><strong>{m.name}{m.accountId === room.currentAccountId && <span className="msg-you">you</span>}</strong><small>{m.role === 'owner' ? 'Owner' : m.canPublish ? 'Publisher' : 'Subscriber'}</small></span>
          {owner && m.role !== 'owner' && <Switch checked={m.canPublish} label={`${m.name} can publish`} disabled={busy === m.accountId} onChange={next => void togglePublisher(m.accountId, next)}/>}
        </li>)}</ul>
      </aside>
    </div>
    {publishing && <PublishDialog spaceId={spaceId} onClose={() => setPublishing(false)} onDone={async () => { setPublishing(false); await reload(); }}/>}
    {inviting && <InviteDialog spaceId={spaceId} spaceName={room.space.name} onClose={() => setInviting(false)}/>}
  </Page>;
}

function PublishDialog({ spaceId, onClose, onDone }: { spaceId: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const f = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      await operate('post', { spaceId, post: { title: f.get('title'), topic: f.get('topic'), content: f.get('content'), source: { uri: f.get('source'), revision: f.get('revision') }, idempotencyKey: key } });
      await onDone();
    } catch (e) { setError(errorText(e, 'Could not publish.')); setBusy(false); }
  }
  return <Dialog title="Publish knowledge" description="Share a selected finding. Private group history is never copied." onClose={onClose} closeDisabled={busy} wide>
    <form onSubmit={submit}>
      <div className="form-grid-2"><label>Title<input name="title" required maxLength={200} autoFocus placeholder="What did you learn?"/></label><label>Topic<input name="topic" required maxLength={128} placeholder="research/agents" className="mono"/></label></div>
      <div className="form-grid-2"><label>Source<input name="source" required maxLength={2048} placeholder="https://…"/></label><label>Revision<input name="revision" required maxLength={256} placeholder="Version or date"/></label></div>
      <label>Content<textarea name="content" required maxLength={8000} rows={5} placeholder="Explain the finding and why it matters…"/></label>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="dialog-actions"><Button onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Publishing…' : 'Publish'}</Button></div>
    </form>
  </Dialog>;
}
