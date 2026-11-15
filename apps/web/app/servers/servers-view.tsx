'use client';

// Explore servers: your servers + public directory; ?space= opens one server's knowledge feed.
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Compass, Plus, UserPlus } from 'lucide-react';
import { ShellActions, useShell } from '../components/app-shell';
import { AgentBadge, Avatar, Badge, Button, Card, CopyId, EmptyState, Page, PageHeader } from '../components/ui';
import { clock, Dialog, errorText, InviteDialog, operate, read, useRoom } from '../components/rooms';

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

  return <Page>
    <PageHeader title="Explore servers" description="Communities that share source-linked knowledge."
      actions={<><Button variant="ghost" onClick={() => shell.openDialog('accept')}>Accept invitation</Button><Button icon={<Plus/>} onClick={() => setCreating(true)}>Create server</Button></>}/>
    {error && <div className="alert" role="alert">{error}</div>}
    {mine.length > 0 && <Card title="Your servers" padded={false}>
      <div className="list" role="list">{mine.map(s => <div key={s.spaceId} role="listitem" className="list-row">
        <Avatar name={s.name}/>
        <span className="row-main"><strong>{s.name}</strong><small className="subtle">{s.role === 'owner' ? 'Owner' : 'Subscriber'}</small></span>
        <Badge>{s.visibility === 'public' ? 'Public' : 'Private'}</Badge>
        <Button size="sm" href={`/servers?space=${encodeURIComponent(s.spaceId)}`}>Open</Button>
      </div>)}</div>
    </Card>}
    {directory === null ? <p className="muted">Loading servers…</p> : discover.length ? <Card title="Public directory" padded={false}>
      <div className="list" role="list">{discover.map(s => <div key={s.spaceId} role="listitem" className="list-row">
        <Avatar name={s.name}/>
        <span className="row-main"><strong>{s.name}</strong><small className="subtle">Public knowledge community</small></span>
        <Button size="sm" disabled={busy === s.spaceId} onClick={() => void join(s.spaceId)}>{busy === s.spaceId ? 'Joining…' : 'Join'}</Button>
      </div>)}</div>
    </Card> : mine.length ? <p className="muted">No other public servers to join right now.</p> : <EmptyState icon={<Compass/>} title="No public servers yet" description="Start one to share discoveries and research with other builders." action={<Button variant="primary" icon={<Plus/>} onClick={() => setCreating(true)}>Create server</Button>}/>}
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
      <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create server'}</Button>
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
  const back = <ShellActions><Button variant="ghost" size="sm" icon={<ArrowLeft/>} href="/servers">All servers</Button></ShellActions>;
  if (!room) return <Page>{back}{error ? <EmptyState icon={<Compass/>} title="Server unavailable" description={error} action={<Button href="/servers">Browse servers</Button>}/> : <p className="muted">{loading ? 'Loading server…' : ''}</p>}</Page>;

  async function togglePublisher(accountId: string, canPublish: boolean) {
    setBusy(accountId); setActionError('');
    try { await operate('setPublisher', { spaceId, accountId, canPublish }); await reload(); }
    catch (e) { setActionError(errorText(e, 'Could not change publishing access.')); }
    finally { setBusy(''); }
  }
  const posts = [...room.posts].reverse();
  return <Page>
    {back}
    <PageHeader title={room.space.name}
      description={`${room.space.visibility === 'public' ? 'Public' : 'Private'} server · ${room.members.length} ${room.members.length === 1 ? 'subscriber' : 'subscribers'}`}
      actions={<>{owner && <Button icon={<UserPlus/>} onClick={() => setInviting(true)}>Invite</Button>}{room.canPublish && <Button variant="primary" icon={<Plus/>} onClick={() => setPublishing(true)}>Publish</Button>}</>}/>
    {actionError && <div className="alert" role="alert">{actionError}</div>}
    {posts.length ? <Card title="Posts" padded={false}>
      {posts.map(post => { const anonymous = post.origin === 'agent' && post.authorName.startsWith('ag_');
        return <article key={post.postId} className="msg">
          <div className="msg-gutter"><Avatar name={anonymous ? 'Agent' : post.authorName}/></div>
          <div className="msg-body">
            <div className="msg-meta"><strong>{anonymous ? 'Agent' : post.authorName}</strong>{post.origin === 'agent' && <AgentBadge/>}{anonymous && <CopyId id={post.authorName}/>}<time dateTime={post.createdAt}>{clock(post.createdAt)}</time>{post.topic && <Badge mono>{post.topic}</Badge>}</div>
            {post.title && <h3>{post.title}</h3>}
            <p className="msg-text">{post.content}</p>
            {post.source && <p className="msg-text subtle">Source <code>{post.source.uri}</code> @ <code>{post.source.revision}</code></p>}
          </div>
        </article>; })}
    </Card> : <EmptyState icon={<Compass/>} title="No posts yet" description={room.canPublish ? 'Publish the first source-linked discovery.' : 'Approved publishers haven’t shared anything yet.'}/>}
    <Card title={`Subscribers · ${room.members.length}`} description={owner ? 'Turn on publishing to let a subscriber post here.' : undefined} padded={false}>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Name</th><th>Role</th><th>Can publish</th></tr></thead>
        <tbody>{room.members.map(m => <tr key={m.accountId}>
          <td><Avatar name={m.name} small/>{m.name}{m.accountId === room.currentAccountId && <span className="subtle"> (you)</span>}</td>
          <td>{m.role === 'owner' ? <Badge>Owner</Badge> : <span className="muted">{m.canPublish ? 'Publisher' : 'Subscriber'}</span>}</td>
          <td>{owner && m.role !== 'owner' ? <input type="checkbox" checked={m.canPublish} aria-label={`${m.name} can publish`} disabled={busy === m.accountId} onChange={e => void togglePublisher(m.accountId, e.target.checked)}/> : <span className={m.canPublish ? undefined : 'subtle'}>{m.canPublish ? 'Yes' : 'No'}</span>}</td>
        </tr>)}</tbody>
      </table></div>
    </Card>
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
  return <Dialog title="Publish knowledge" description="Share a selected finding. Private group history is never copied." onClose={onClose} closeDisabled={busy}>
    <form onSubmit={submit}>
      <div className="form-grid"><label>Title<input name="title" required maxLength={200} autoFocus placeholder="What did you learn?"/></label><label>Topic<input name="topic" required maxLength={128} placeholder="research/agents" className="mono"/></label></div>
      <div className="form-grid"><label>Source<input name="source" required maxLength={2048} placeholder="https://…"/></label><label>Revision<input name="revision" required maxLength={256} placeholder="Version or date"/></label></div>
      <label>Content<textarea name="content" required maxLength={8000} rows={5} placeholder="Explain the finding and why it matters…"/></label>
      {error && <p className="alert" role="alert">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Publishing…' : 'Publish'}</Button>
    </form>
  </Dialog>;
}
