'use client';

// Members & access: people, agents (grants), invitations for the selected group.
import { useMemo, useState, type FormEvent } from 'react';
import { Bot, KeyRound, UserPlus, Users } from 'lucide-react';
import { useShell } from '../components/app-shell';
import ConnectAgent from '../components/connect-agent';
import { AgentBadge, Avatar, Badge, Button, Card, CopyId, EmptyState, InfoTip, Page, PageHeader } from '../components/ui';
import { clock, CopyButton, Dialog, errorText, InviteDialog, operate, Switch, timeAgo, useRoom, type CreatedInvite } from '../components/rooms';

type Credential = { agentId: string; name: string; token: string; relayUrl: string };
type AgentRowData = { agentId: string; name: string; known: boolean; owner: string; provider: string; lastSeenAt: string | null; read: boolean; publish: boolean; granted: boolean; mine: boolean };

export default function MembersView() {
  const shell = useShell();
  const { spaceId, space, overview } = shell;
  const { room, error: roomError, reload } = useRoom(spaceId, 'group');
  const [inviting, setInviting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invites, setInvites] = useState<CreatedInvite[]>([]);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const owner = space?.role === 'owner';

  const agents = useMemo<AgentRowData[]>(() => {
    if (!overview) return [];
    const grants = overview.grants.filter(g => g.spaceId === spaceId);
    const ids = [...new Set([...grants.map(g => g.agentId), ...overview.agents.map(a => a.agentId)])];
    return ids.map(agentId => {
      const live = room?.agents.find(a => a.agentId === agentId);
      const mine = overview.agents.find(a => a.agentId === agentId);
      const grant = grants.find(g => g.agentId === agentId);
      return {
        agentId, name: live?.name || mine?.name || 'Agent', known: Boolean(live || mine),
        owner: live?.ownerName || (mine ? overview.account.name : ''), provider: live?.provider || '',
        lastSeenAt: live?.lastSeenAt ?? null, read: Boolean(grant?.read), publish: Boolean(grant?.publish), granted: Boolean(grant && (grant.read || grant.publish)), mine: Boolean(mine),
      };
    }).sort((a, b) => Number(b.granted) - Number(a.granted) || a.name.localeCompare(b.name));
  }, [overview, room, spaceId]);

  async function setGrant(agent: AgentRowData, change: { read?: boolean; publish?: boolean }) {
    const next = { read: change.read ?? agent.read, publish: change.publish ?? agent.publish };
    if (next.publish && !next.read && change.publish) next.read = true; // publishing needs read to reach the group
    setPending(agent.agentId); setError('');
    try { await operate('setGrant', { spaceId, agentId: agent.agentId, ...next }); await Promise.all([shell.refresh(), reload()]); }
    catch (e) { setError(errorText(e, 'Could not update access.')); }
    finally { setPending(''); }
  }

  if (!spaceId) return <Page><PageHeader title="Members & access"/><EmptyState icon={<Users/>} title="No group selected" description="Create or join a group to manage its members and agents." action={<Button variant="primary" onClick={() => shell.openDialog('create')}>Create group</Button>}/></Page>;

  return <Page className="members-page">
    <PageHeader title="Members & access" description={`People and agents in ${space?.name || 'this group'}.`}
      actions={owner ? <Button variant="primary" icon={<UserPlus/>} onClick={() => setInviting(true)}>Invite people</Button> : undefined}/>
    {(error || roomError) && <div className="alert" role="alert">{error || roomError}</div>}

    <Card title={<>People <span className="count">{room?.members.length ?? ''}</span></>} padded={false}>
      <div className="table-wrap"><table className="table people-table">
        <thead><tr><th>Name</th><th>Role</th><th>Posting <InfoTip text="Everyone in a group can post. Publisher approval applies to servers."/></th></tr></thead>
        <tbody>{room ? room.members.map(m => <tr key={m.accountId}>
          <td><span className="cell-person"><Avatar name={m.name}/><span>{m.name}{m.accountId === room.currentAccountId && <span className="msg-you">you</span>}</span></span></td>
          <td>{m.role === 'owner' ? <Badge>Owner</Badge> : <span className="muted">Member</span>}</td>
          <td><span className="muted">{m.canPublish ? 'Can post' : 'Read only'}</span></td>
        </tr>) : <tr><td colSpan={3} className="muted">Loading…</td></tr>}</tbody>
      </table></div>
    </Card>

    <Card title={<>Agents <span className="count">{agents.filter(a => a.granted).length}</span></>} description={owner ? 'Choose what each agent can read and publish in this group.' : 'Only the group owner can change agent access.'} padded={false}
      actions={<><ConnectAgent spaceId={spaceId} onLinked={async () => { await Promise.all([shell.refresh(), reload()]); }} size="sm"/><Button size="sm" icon={<KeyRound/>} onClick={() => setCreating(true)}>Create agent key</Button></>}>
      {agents.length ? <div className="table-wrap"><table className="table agents-table">
        <thead><tr><th>Agent</th><th>Owner</th><th>Provider</th><th>Read</th><th>Publish</th><th>Last contact</th><th>ID</th></tr></thead>
        <tbody>{agents.map(a => <tr key={a.agentId}>
          <td><span className="cell-person"><span className="avatar agent" aria-hidden="true"><Bot/></span><span>{a.name}</span><AgentBadge/>{a.mine && <span className="msg-you">yours</span>}</span></td>
          <td>{a.owner || <span className="subtle">—</span>}</td>
          <td>{a.provider ? <span className="muted">{a.provider === 'claude' ? 'Claude Code' : a.provider === 'codex' ? 'Codex' : a.provider.toUpperCase()}</span> : <span className="subtle">—</span>}</td>
          <td>{owner ? <Switch checked={a.read} label={`${a.name} can read`} disabled={pending === a.agentId} onChange={read => void setGrant(a, { read, ...(read ? {} : { publish: false }) })}/> : <Access on={a.read}/>}</td>
          <td>{owner ? <Switch checked={a.publish} label={`${a.name} can publish`} disabled={pending === a.agentId} onChange={publish => void setGrant(a, { publish })}/> : <Access on={a.publish}/>}</td>
          <td>{a.lastSeenAt ? <span className="muted" title={new Date(a.lastSeenAt).toLocaleString()}>{timeAgo(a.lastSeenAt)}</span> : <span className="subtle">{a.granted ? 'Awaiting setup' : 'No access'}</span>}</td>
          <td><CopyId id={a.agentId}/></td>
        </tr>)}</tbody>
      </table></div> : <div className="card-body"><p className="muted">No agents yet. Connect Claude Code or Codex to bring your coding agent into this group.</p></div>}
    </Card>

    {owner && <Card title="Invitations" description="Tokens are shown once when created. Pending invitations expire after 24 hours." padded={false}>
      {invites.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Email</th><th>Created</th><th>Expires</th></tr></thead>
        <tbody>{invites.map(i => <tr key={i.inviteId}><td>{maskEmail(i.email)}</td><td className="muted">This session</td><td className="muted">{clock(i.expiresAt)}</td></tr>)}</tbody>
      </table></div> : <div className="card-body"><p className="muted">Invitations you create here are listed for this visit.</p></div>}
    </Card>}

    {inviting && <InviteDialog spaceId={spaceId} spaceName={space?.name || 'group'} onClose={() => setInviting(false)} onCreated={i => setInvites(list => [i, ...list])}/>}
    {creating && <CreateAgentDialog spaceId={spaceId} owner={owner} onClose={() => { setCreating(false); void shell.refresh(); }}/>}
  </Page>;
}

/** Keeps addresses out of the page body: "te•••@example.com". */
function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}•••@${domain ?? ''}`;
}

function Access({ on }: { on: boolean }) {
  return <span className={on ? 'access-on' : 'subtle'}>{on ? 'Yes' : 'No'}</span>;
}

/** Manual agent credential (advanced): env file download, relay sign-in, MCP configure command. */
function CreateAgentDialog({ spaceId, owner, onClose }: { spaceId: string; owner: boolean; onClose: () => void }) {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget); setBusy(true); setError('');
    try { setCredential(await operate<Credential>('createAgent', { name: fields.get('name') })); }
    catch (e) { setError(errorText(e, 'Could not create the agent.')); }
    finally { setBusy(false); }
  }
  function download() {
    if (!credential) return;
    const body = `CIVITAS_RELAY_URL=${JSON.stringify(credential.relayUrl)}\nCIVITAS_AGENT_TOKEN=${JSON.stringify(credential.token)}\nCIVITAS_DEMO_SPACE_ID=${JSON.stringify(spaceId)}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = `${credential.agentId}.env`; link.click(); URL.revokeObjectURL(url);
  }
  async function openRelay() {
    if (!credential) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: credential.token, spaceId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not open the relay as this agent.');
      window.location.assign(`/context?space=${encodeURIComponent(spaceId)}`);
    } catch (e) { setError(errorText(e)); setBusy(false); }
  }
  return <Dialog title={credential ? `${credential.name} created` : 'Create agent key'} description={credential ? 'Save this credential now. It is shown only once.' : 'For custom MCP clients. Claude Code and Codex users can use Connect agent instead.'} onClose={onClose} closeDisabled={busy} wide>
    {!credential ? <form onSubmit={submit}>
      <label>Agent name<input name="name" required maxLength={100} autoFocus placeholder="Frontend agent"/></label>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="dialog-actions"><Button onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create key'}</Button></div>
    </form> : <div className="secret-once">
      <div className="kv"><span>Agent ID</span><CopyId id={credential.agentId}/></div>
      <label>Agent credential<input type="password" value={credential.token} readOnly autoComplete="off" className="mono" onFocus={e => e.currentTarget.select()}/></label>
      <div className="step-actions"><CopyButton value={credential.token} label="Copy credential"/><Button size="sm" onClick={download}>Download .env</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void openRelay()}>Open relay as agent</Button></div>
      <p className="form-hint">Keep the .env file outside your repository, then print an MCP setup command (use <code>codex</code> or <code>json</code> for other clients):</p>
      <pre className="code-block">node packages/cli/dist/index.js configure claude /absolute/path/agent.env</pre>
      <p className="form-hint">{owner ? 'Turn on Read and Publish for this agent in the Agents table to give it access to this group.' : 'Ask the group owner to grant this agent access.'}</p>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="dialog-actions"><Button variant="primary" onClick={onClose}>Done</Button></div>
    </div>}
  </Dialog>;
}
