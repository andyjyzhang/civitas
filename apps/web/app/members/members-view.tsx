'use client';

// Members: people, agents (read / publish grants) and invitations for the selected group.
// Agent IDs stay behind each row's ⋯ menu.
import { useMemo, useState, type FormEvent } from 'react';
import { KeyRound, UserPlus, Users } from 'lucide-react';
import { useShell } from '../components/app-shell';
import ConnectAgent from '../components/connect-agent';
import { AgentAvatar, Avatar, Badge, Button, Card, CopyId, EmptyState, Page, PageHeader } from '../components/ui';
import { DetailRows, DetailsMenu } from '../components/overlays';
import { clock, CopyButton, Dialog, errorText, InviteDialog, operate, timeAgo, useRoom, type CreatedInvite } from '../components/rooms';

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

  if (!spaceId) return <Page><PageHeader title="Members"/><EmptyState icon={<Users/>} title="No group selected" description="Create or join a group to manage its members and agents." action={<Button variant="primary" onClick={() => shell.openDialog('create')}>Create group</Button>}/></Page>;

  return <Page>
    <PageHeader title="Members" description={`People and agents in ${space?.name || 'this group'}.`}
      actions={owner ? <Button variant="primary" icon={<UserPlus/>} onClick={() => setInviting(true)}>Invite people</Button> : undefined}/>
    {(error || roomError) && <div className="alert" role="alert">{error || roomError}</div>}

    <Card title={room ? `People · ${room.members.length}` : 'People'} padded={false}>
      <div className="table-wrap"><table className="table people-table">
        <thead><tr><th>Name</th><th>Role</th></tr></thead>
        <tbody>{room ? room.members.map(m => <tr key={m.accountId}>
          <td><Avatar name={m.name} small/>{m.name}{m.accountId === room.currentAccountId && <span className="subtle"> (you)</span>}</td>
          <td>{m.role === 'owner' ? <Badge>Owner</Badge> : <span className="muted">Member</span>}</td>
        </tr>) : <tr><td colSpan={2} className="muted">Loading…</td></tr>}</tbody>
      </table></div>
    </Card>

    <Card title={`Agents · ${agents.filter(a => a.granted).length}`} description={owner ? 'Choose what each agent can read and share here.' : 'Only the group owner can change agent access.'} padded={false}
      actions={<><ConnectAgent spaceId={spaceId} onLinked={async () => { await Promise.all([shell.refresh(), reload()]); }} size="sm"/><Button size="sm" icon={<KeyRound/>} onClick={() => setCreating(true)}>Create agent key</Button></>}>
      {agents.length ? <div className="table-wrap"><table className="table agents-table">
        <thead><tr><th>Agent</th><th>Owner</th><th>Read</th><th>Share</th><th>Last seen</th><th><span className="sr-only">More</span></th></tr></thead>
        <tbody>{agents.map(a => <tr key={a.agentId}>
          <td className="nowrap"><AgentAvatar small/>{a.name}{a.mine && <span className="subtle"> (yours)</span>}</td>
          <td>{a.owner || <span className="subtle">—</span>}</td>
          <td>{owner ? <input type="checkbox" checked={a.read} aria-label={`${a.name} can read`} disabled={pending === a.agentId} onChange={e => void setGrant(a, { read: e.target.checked, ...(e.target.checked ? {} : { publish: false }) })}/> : <Access on={a.read}/>}</td>
          <td>{owner ? <input type="checkbox" checked={a.publish} aria-label={`${a.name} can publish`} disabled={pending === a.agentId} onChange={e => void setGrant(a, { publish: e.target.checked })}/> : <Access on={a.publish}/>}</td>
          <td className="nowrap">{a.lastSeenAt ? <span className="muted" title={new Date(a.lastSeenAt).toLocaleString()}>{timeAgo(a.lastSeenAt)}</span> : <span className="subtle">{a.granted ? 'Not connected yet' : 'No access'}</span>}</td>
          <td className="actions-cell"><DetailsMenu label={`${a.name} details`}><DetailRows rows={[['Agent ID', <CopyId key="id" id={a.agentId}/>], ['Provider', a.provider === 'claude' ? 'Claude Code' : a.provider === 'codex' ? 'Codex' : a.provider]]}/></DetailsMenu></td>
        </tr>)}</tbody>
      </table></div> : <div className="card-body"><p className="muted">No agents yet. Connect Claude Code or Codex to bring your coding agent into this group.</p></div>}
    </Card>

    {owner && invites.length > 0 && <Card title="Invitations" description="Each token is shown once. Invitations expire after 24 hours." padded={false}>
      {invites.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Email</th><th>Created</th><th>Expires</th></tr></thead>
        <tbody>{invites.map(i => <tr key={i.inviteId}><td>{maskEmail(i.email)}</td><td className="muted">This session</td><td className="muted">{clock(i.expiresAt)}</td></tr>)}</tbody>
      </table></div> : null}
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
  return <span className={on ? undefined : 'subtle'}>{on ? 'Yes' : 'No'}</span>;
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
  return <Dialog title={credential ? `${credential.name} created` : 'Create agent key'} description={credential ? 'Save this credential now. It is shown only once.' : 'For custom MCP clients. Claude Code and Codex users can use Connect agent instead.'} onClose={onClose} closeDisabled={busy}>
    {!credential ? <form onSubmit={submit}>
      <label>Agent name<input name="name" required maxLength={100} autoFocus placeholder="Frontend agent"/></label>
      {error && <p className="alert" role="alert">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create key'}</Button>
    </form> : <form onSubmit={e => { e.preventDefault(); onClose(); }}>
      <p className="muted">Agent ID <CopyId id={credential.agentId}/></p>
      <label>Agent credential<input type="password" value={credential.token} readOnly autoComplete="off" className="mono" onFocus={e => e.currentTarget.select()}/></label>
      <div className="page-actions"><CopyButton value={credential.token} label="Copy credential"/><Button size="sm" onClick={download}>Download .env</Button></div>
      <p className="subtle">Keep the .env file outside your repository, then print an MCP setup command (use <code>codex</code> or <code>json</code> for other clients):</p>
      <pre className="setup-command">node packages/cli/dist/index.js configure claude /absolute/path/agent.env</pre>
      <p className="subtle">{owner ? 'Turn on Read and Share for this agent in the Agents table to give it access to this group.' : 'Ask the group owner to grant this agent access.'}</p>
      {error && <p className="alert" role="alert">{error}</p>}
      <Button type="submit" variant="primary">Done</Button>
    </form>}
  </Dialog>;
}
